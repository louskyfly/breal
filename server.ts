import index from "./index.html";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

mkdirSync("./data/uploads", { recursive: true });

const db = new Database("./data/breal.sqlite", { create: true });
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    circle TEXT NOT NULL DEFAULT 'friends',
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS moments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    notified_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    moment_id INTEGER,
    day TEXT NOT NULL,
    back_url TEXT NOT NULL,
    front_url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'friends',
    retakes INTEGER NOT NULL DEFAULT 0,
    front_main INTEGER NOT NULL DEFAULT 0,
    late_seconds INTEGER NOT NULL DEFAULT 0,
    seeded INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_posts_day ON posts(day);
  CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
`);

const LATE_WINDOW = 120;
const EMOJIS = ["😂", "😍", "🔥", "😮", "💀", "🫶", "👀", "😭"];

type Row = Record<string, any>;
const now = () => Date.now();
const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const fail = (message: string, status = 400) => json({ error: message }, status);

function getUser(req: Request): Row | null {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-token") || "";
  if (!token) return null;
  const user = db.query("SELECT * FROM users WHERE token = ?").get(token) as Row | null;
  if (user) db.query("UPDATE users SET last_seen = ? WHERE id = ?").run(now(), user.id);
  return user ?? null;
}

function getMoment(): Row {
  const today = dayKey();
  let moment = db.query("SELECT * FROM moments ORDER BY id DESC LIMIT 1").get() as Row | null;
  if (!moment || moment.day !== today) {
    const res = db
      .query("INSERT INTO moments (day, notified_at) VALUES (?, ?)")
      .run(today, now() - 7 * 60_000);
    moment = db.query("SELECT * FROM moments WHERE id = ?").get(Number(res.lastInsertRowid)) as Row;
  }
  return moment;
}

function publicUser(u: Row) {
  return { id: u.id, name: u.name, username: u.username, color: u.color };
}

function hydrate(rows: Row[], meId: number) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => "?").join(",");
  const reactions = db
    .query(
      `SELECT r.post_id, r.emoji, u.id AS user_id, u.name, u.color
       FROM reactions r JOIN users u ON u.id = r.user_id
       WHERE r.post_id IN (${marks}) ORDER BY r.created_at ASC`,
    )
    .all(...ids) as Row[];
  const comments = db
    .query(
      `SELECT c.id, c.post_id, c.text, c.created_at, u.id AS user_id, u.name, u.username, u.color
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id IN (${marks}) ORDER BY c.created_at ASC`,
    )
    .all(...ids) as Row[];

  return rows.map((p) => {
    const grouped = new Map<string, { emoji: string; count: number; users: Row[] }>();
    let myReaction: string | null = null;
    for (const r of reactions.filter((x) => x.post_id === p.id)) {
      const g = grouped.get(r.emoji) ?? { emoji: r.emoji, count: 0, users: [] };
      g.count++;
      g.users.push({ id: r.user_id, name: r.name, color: r.color });
      grouped.set(r.emoji, g);
      if (r.user_id === meId) myReaction = r.emoji;
    }
    return {
      id: p.id,
      user: { id: p.user_id, name: p.name, username: p.username, color: p.color },
      backUrl: p.back_url,
      frontUrl: p.front_url,
      caption: p.caption,
      location: p.location,
      visibility: p.visibility,
      retakes: p.retakes,
      frontMain: p.front_main === 1,
      lateSeconds: p.late_seconds,
      createdAt: p.created_at,
      reactions: [...grouped.values()],
      myReaction,
      comments: comments
        .filter((c) => c.post_id === p.id)
        .map((c) => ({
          id: c.id,
          text: c.text,
          createdAt: c.created_at,
          user: { id: c.user_id, name: c.name, username: c.username, color: c.color },
        })),
    };
  });
}

const POST_SELECT = `SELECT p.*, u.name, u.username, u.color, u.circle
  FROM posts p JOIN users u ON u.id = p.user_id`;

function feedFor(me: Row, circle: "friends" | "world") {
  const rows = db
    .query(
      `${POST_SELECT} WHERE p.day = ? AND u.circle = ?
       ORDER BY (p.user_id = ?) DESC, p.created_at DESC LIMIT 40`,
    )
    .all(dayKey(), circle, me.id) as Row[];
  return hydrate(rows, me.id);
}

function discoveryFor(me: Row) {
  const rows = db
    .query(
      `${POST_SELECT} WHERE p.day = ? AND p.visibility = 'public' AND p.user_id != ?
       ORDER BY p.created_at DESC LIMIT 40`,
    )
    .all(dayKey(), me.id) as Row[];
  return hydrate(rows, me.id);
}

function memoriesFor(me: Row) {
  const rows = db
    .query(
      `${POST_SELECT} WHERE p.day < ? AND u.circle = 'friends' ORDER BY p.created_at DESC LIMIT 80`,
    )
    .all(dayKey()) as Row[];
  return hydrate(rows, me.id);
}

function statsFor(me: Row) {
  const myPosts = db.query("SELECT day FROM posts WHERE user_id = ? ORDER BY day DESC").all(me.id) as Row[];
  const days = new Set(myPosts.map((p) => p.day));
  let streak = 0;
  const d = new Date();
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d.getTime()))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  const friends = db
    .query("SELECT COUNT(*) AS c FROM users WHERE circle = 'friends' AND id != ?")
    .get(me.id) as Row;
  return {
    streak,
    posts: myPosts.length,
    friends: friends.c,
    myDays: myPosts.slice(0, 60).map((p) => p.day),
  };
}

function friendsFor(me: Row) {
  const rows = db
    .query(
      `SELECT u.id, u.name, u.username, u.color, u.last_seen,
              p.id AS post_id, p.late_seconds, p.created_at AS post_created_at
       FROM users u
       LEFT JOIN posts p ON p.user_id = u.id AND p.day = ?
       WHERE u.circle = 'friends' AND u.id != ?
       ORDER BY p.created_at DESC, u.name ASC`,
    )
    .all(dayKey(), me.id) as Row[];
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    color: u.color,
    lastSeen: u.last_seen,
    post: u.post_id
      ? { id: u.post_id, lateSeconds: u.late_seconds, createdAt: u.post_created_at }
      : null,
  }));
}

function onlineFor(me: Row) {
  const cutoff = now() - 90_000;
  return db
    .query(
      "SELECT id, name, username, color FROM users WHERE circle = 'friends' AND id != ? AND last_seen > ?",
    )
    .all(me.id, cutoff) as Row[];
}

function bootstrap(me: Row) {
  const moment = getMoment();
  const feed = feedFor(me, "friends");
  const myToday = feed.find((p) => p.user.id === me.id) ?? null;
  return {
    me: publicUser(me),
    moment: {
      id: moment.id,
      day: moment.day,
      notifiedAt: moment.notified_at,
      lateWindow: LATE_WINDOW,
    },
    feed,
    discovery: discoveryFor(me),
    memories: memoriesFor(me),
    stats: statsFor(me),
    friends: friendsFor(me),
    online: onlineFor(me),
    myTodayPostId: myToday?.id ?? null,
    serverNow: now(),
    inviteCode: "breal",
  };
}

// ---------- seed data ----------
const SEED_USERS = [
  { name: "Léa Fontaine", username: "lea.fnt", color: "#FF6B4A" },
  { name: "Hugo Marchal", username: "hugomrch", color: "#7C9EFF" },
  { name: "Inès Bensaïd", username: "inesbsd", color: "#E9FF3F" },
  { name: "Théo Lambert", username: "theolmb", color: "#FF9ED2" },
  { name: "Camille Roux", username: "camilr", color: "#B7F0C2" },
  { name: "Noam Kessi", username: "noam.k", color: "#FFC857" },
];
const WORLD_USERS = [
  { name: "Sora Ito", username: "sora.tokyo", color: "#C9B6FF" },
  { name: "Mia Alvarez", username: "mia.nyc", color: "#FFD1A9" },
  { name: "Tom Ellis", username: "tomls", color: "#9BE5FF" },
];

const TODAY_POSTS = [
  { username: "lea.fnt", back: "back-cafe", front: "front-1", caption: "dernier café avant de rendre ce dossier de merde", location: "Paris 11e", late: 42, vis: "friends" },
  { username: "hugomrch", back: "back-gym", front: "front-2", caption: "jambes en compote, ça valait le coup", location: "Salle de la République", late: 74, vis: "friends" },
  { username: "inesbsd", back: "back-desk", front: "front-3", caption: "journée entière sur le même paragraphe", location: "Bibliothèque", late: 132, vis: "friends" },
  { username: "theolmb", back: "back-resto", front: "front-4", caption: "ramen à 16h, aucun regret", location: "Rue Sainte-Anne", late: 21, vis: "friends" },
  { username: "camilr", back: "back-store", front: "front-5", caption: "j'ai encore acheté un truc inutile", location: "Le Marais", late: 318, vis: "friends" },
  { username: "noam.k", back: "back-concert", front: "front-8", caption: "le groupe était nul mais le son était fort", location: "La Maroquinerie", late: 9, vis: "friends" },
  { username: "sora.tokyo", back: "back-street", front: "front-6", caption: "shibuya, 23:40", location: "Tokyo", late: 55, vis: "public" },
  { username: "mia.nyc", back: "back-nyc", front: "front-9", caption: "the city that never sleeps etc etc", location: "New York", late: 140, vis: "public" },
  { username: "tomls", back: "back-beach", front: "front-7", caption: "lunch break, 40 minutes de bonheur", location: "Lisbonne", late: 8, vis: "public" },
];

const PAST_POSTS = [
  { username: "lea.fnt", ago: 1, back: "back-friends", front: "front-1", caption: "soirée chez moi, 14 personnes dans 28m²", location: "Paris 20e", late: 90 },
  { username: "hugomrch", ago: 1, back: "back-desk2", front: "front-2", caption: "télétravail, jour 400", location: "Chez moi", late: 20 },
  { username: "inesbsd", ago: 2, back: "back-coffee", front: "front-3", caption: "le seul café qui me comprend", location: "Café de la Place", late: 300 },
  { username: "theolmb", ago: 2, back: "back-food", front: "front-4", caption: "j'ai cuisiné, ça se voit non ?", location: "Chez moi", late: 45 },
  { username: "camilr", ago: 3, back: "back-mountain", front: "front-5", caption: "3h de marche pour cette vue", location: "Vercors", late: 12 },
  { username: "noam.k", ago: 3, back: "back-beach", front: "front-8", caption: "week-end volé au mois de novembre", location: "Biarritz", late: 520 },
  { username: "lea.fnt", ago: 4, back: "back-resto", front: "front-1", caption: "anniv de ma sœur, je suis ruinée", location: "Rue Oberkampf", late: 170 },
  { username: "hugomrch", ago: 5, back: "back-concert", front: "front-2", caption: "ils ont joué mon morceau préféré", location: "Le Trabendo", late: 60 },
  { username: "inesbsd", ago: 6, back: "back-store", front: "front-3", caption: "librairie, je repars avec 6 livres", location: "Le Marais", late: 880 },
  { username: "theolmb", ago: 7, back: "back-friends", front: "front-4", caption: "dernier jour avant les partiels", location: "Paris 5e", late: 100 },
  { username: "camilr", ago: 8, back: "back-coffee", front: "front-5", caption: "dimanche lent", location: "Chez moi", late: 40 },
  { username: "noam.k", ago: 9, back: "back-desk", front: "front-8", caption: "j'ai enfin fini", location: "Bibliothèque", late: 240 },
  { username: "lea.fnt", ago: 18, back: "back-cafe", front: "front-1", caption: "brunch à 15h, comme il se doit", location: "Paris 11e", late: 95 },
  { username: "hugomrch", ago: 21, back: "back-nyc", front: "front-2", caption: "escale de 6h, j'ai marché 12 km", location: "New York", late: 30 },
  { username: "inesbsd", ago: 24, back: "back-mountain", front: "front-3", caption: "air pur, zéro réseau, bonheur", location: "Annecy", late: 150 },
  { username: "theolmb", ago: 30, back: "back-gym", front: "front-4", caption: "première séance depuis 4 mois", location: "Salle de la République", late: 200 },
  { username: "camilr", ago: 33, back: "back-street", front: "front-5", caption: "je me suis paumée en rentrant", location: "Lyon", late: 610 },
  { username: "noam.k", ago: 40, back: "back-food", front: "front-8", caption: "pâtes au pesto, encore", location: "Chez moi", late: 15 },
];

const SEED_REACTIONS = [
  { post: 0, from: "hugomrch", emoji: "😂" },
  { post: 0, from: "inesbsd", emoji: "🫶" },
  { post: 0, from: "theolmb", emoji: "🔥" },
  { post: 1, from: "lea.fnt", emoji: "💀" },
  { post: 1, from: "camilr", emoji: "😍" },
  { post: 2, from: "theolmb", emoji: "😂" },
  { post: 2, from: "noam.k", emoji: "🫶" },
  { post: 3, from: "inesbsd", emoji: "😍" },
  { post: 3, from: "noam.k", emoji: "🔥" },
  { post: 4, from: "lea.fnt", emoji: "💀" },
  { post: 5, from: "hugomrch", emoji: "🔥" },
  { post: 6, from: "mia.nyc", emoji: "👀" },
  { post: 7, from: "sora.tokyo", emoji: "😍" },
  { post: 8, from: "tomls", emoji: "🔥" },
];

const SEED_COMMENTS = [
  { post: 0, from: "inesbsd", text: "t'as l'air épuisée mdr" },
  { post: 0, from: "theolmb", text: "le café sauve des vies" },
  { post: 1, from: "camilr", text: "jambes en compote mais tête reposée" },
  { post: 2, from: "noam.k", text: "force à toi" },
  { post: 3, from: "lea.fnt", text: "16h le ramen c'est un mode de vie" },
  { post: 3, from: "hugomrch", text: "j'étais là aussi !! j'ai pas osé poster" },
  { post: 4, from: "lea.fnt", text: "tu m'as tué 😂" },
  { post: 6, from: "sora.tokyo", text: "cette ville est irréelle" },
  { post: 7, from: "tomls", text: "le café a l'air bon" },
];

function seedIfNeeded() {
  const existing = db.query("SELECT COUNT(*) AS c FROM users WHERE circle = 'friends'").get() as Row;
  if (existing.c === 0) {
    const ins = db.query(
      "INSERT INTO users (name, username, color, token, circle, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, 0)",
    );
    for (const u of SEED_USERS) ins.run(u.name, u.username, u.color, `seed-${u.username}`, "friends", now());
    for (const u of WORLD_USERS) ins.run(u.name, u.username, u.color, `seed-${u.username}`, "world", now());
  }

  const seededPosts = db.query("SELECT COUNT(*) AS c FROM posts WHERE seeded = 1").get() as Row;
  if (seededPosts.c === 0) {
    const moment = getMoment();
    const userByName = new Map(
      (db.query("SELECT * FROM users").all() as Row[]).map((u) => [u.username, u]),
    );
    const insPost = db.query(
      `INSERT INTO posts (user_id, moment_id, day, back_url, front_url, caption, location, visibility, retakes, late_seconds, seeded, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    );
    TODAY_POSTS.forEach((p, i) => {
      const u = userByName.get(p.username);
      if (!u) return;
      const created = moment.notified_at + p.late * 1000 + i * 1200;
      insPost.run(
        u.id, moment.id, dayKey(created), `/seed/${p.back}.jpg`, `/seed/${p.front}.jpg`,
        p.caption, p.location, p.vis, i % 3, p.late, created,
      );
    });
    PAST_POSTS.forEach((p, i) => {
      const u = userByName.get(p.username);
      if (!u) return;
      const d = new Date();
      d.setDate(d.getDate() - p.ago);
      d.setHours(18, 20 + (i % 30), 0, 0);
      insPost.run(
        u.id, null, dayKey(d.getTime()), `/seed/${p.back}.jpg`, `/seed/${p.front}.jpg`,
        p.caption, p.location, "friends", i % 4, p.late, d.getTime(),
      );
    });

    const postIds = (db.query("SELECT id FROM posts WHERE seeded = 1 AND day = ? ORDER BY id ASC").all(dayKey()) as Row[]).map((r) => r.id);
    const insReaction = db.query(
      "INSERT INTO reactions (post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)",
    );
    for (const r of SEED_REACTIONS) {
      const post = postIds[r.post];
      const user = userByName.get(r.from);
      if (post && user) insReaction.run(post, user.id, r.emoji, now() - Math.random() * 3_600_000);
    }
    const insComment = db.query(
      "INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)",
    );
    for (const c of SEED_COMMENTS) {
      const post = postIds[c.post];
      const user = userByName.get(c.from);
      if (post && user) insComment.run(post, user.id, c.text, now() - Math.random() * 3_000_000);
    }
  }
}

seedIfNeeded();

// ---------- routes ----------
const server = Bun.serve({
  port: Number(process.env.PORT || 4000),
  development: process.env.NODE_ENV !== "production",
  maxRequestBodySize: 30 * 1024 * 1024,
  routes: {
    "/": index,
    "/icon.svg": () => new Response(Bun.file("./public/icon.svg"), { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } }),
    "/icon-192.png": () => new Response(Bun.file("./public/icon-192.png"), { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } }),
    "/icon-512.png": () => new Response(Bun.file("./public/icon-512.png"), { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } }),
    "/manifest.webmanifest": () => new Response(Bun.file("./public/manifest.webmanifest"), { headers: { "content-type": "application/manifest+json" } }),
    "/seed/:file": (req) => {
      const file = (req as any).params.file as string;
      if (!/^[a-z0-9-]+\.jpg$/.test(file)) return new Response("not found", { status: 404 });
      return new Response(Bun.file(`./public/seed/${file}`), { headers: { "cache-control": "public, max-age=31536000, immutable" } });
    },
    "/uploads/:file": (req) => {
      const file = (req as any).params.file as string;
      if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(file)) return new Response("not found", { status: 404 });
      return new Response(Bun.file(`./data/uploads/${file}`), { headers: { "cache-control": "public, max-age=31536000, immutable" } });
    },
    "/api/health": { GET: () => json({ ok: true }) },

    "/api/join": {
      POST: async (req) => {
        const body = (await req.json().catch(() => null)) as Row | null;
        if (!body) return fail("Requête invalide");
        const name = String(body.name || "").trim().slice(0, 30);
        let username = String(body.username || "").trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9._]/g, "").slice(0, 20);
        const color = /^#[0-9a-f]{6}$/i.test(String(body.color || "")) ? String(body.color) : "#E9FF3F";
        if (name.length < 2) return fail("Ton prénom, au moins deux lettres");
        if (username.length < 3) return fail("Ton @ doit faire au moins 3 caractères");
        if (db.query("SELECT id FROM users WHERE username = ?").get(username)) return fail("Ce @ est déjà pris", 409);
        const token = crypto.randomUUID();
        const res = db
          .query("INSERT INTO users (name, username, color, token, circle, created_at, last_seen) VALUES (?, ?, ?, ?, 'friends', ?, ?)")
          .run(name, username, color, token, now(), now());
        const user = db.query("SELECT * FROM users WHERE id = ?").get(Number(res.lastInsertRowid)) as Row;
        return json({ token, user: publicUser(user) });
      },
    },

    "/api/bootstrap": {
      GET: (req) => {
        const me = getUser(req);
        if (!me) return fail("Session expirée", 401);
        getMoment();
        return json(bootstrap(me));
      },
    },

    "/api/state": {
      GET: (req) => {
        const me = getUser(req);
        if (!me) return fail("Session expirée", 401);
        getMoment();
        return json(bootstrap(me));
      },
    },

    "/api/upload": {
      POST: async (req) => {
        const me = getUser(req);
        if (!me) return fail("Session expirée", 401);
        const form = await req.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof Blob)) return fail("Fichier manquant");
        if (file.size > 9 * 1024 * 1024) return fail("Image trop lourde");
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return fail("Format non supporté");
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const filename = `${crypto.randomUUID()}.${ext}`;
        await Bun.write(`./data/uploads/${filename}`, file);
        return json({ url: `/uploads/${filename}` });
      },
    },

    "/api/posts": {
      POST: async (req) => {
        const me = getUser(req);
        if (!me) return fail("Session expirée", 401);
        const body = (await req.json().catch(() => null)) as Row | null;
        if (!body) return fail("Requête invalide");
        const backUrl = String(body.backUrl || "");
        const frontUrl = String(body.frontUrl || "");
        if (!/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/.test(backUrl) || !/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/.test(frontUrl)) {
          return fail("Photos manquantes");
        }
        const today = dayKey();
        const existing = db.query("SELECT id FROM posts WHERE user_id = ? AND day = ?").get(me.id, today);
        if (existing) return fail("Tu as déjà posté ton BeReal aujourd'hui", 409);
        const moment = getMoment();
        const lateSeconds = Math.max(0, Math.round((now() - moment.notified_at) / 1000));
        const caption = String(body.caption || "").trim().slice(0, 180);
        const location = String(body.location || "").trim().slice(0, 40);
        const visibility = body.visibility === "public" ? "public" : "friends";
        const retakes = Math.max(0, Math.min(99, Number(body.retakes) || 0));
        const frontMain = body.frontMain ? 1 : 0;
        const res = db
          .query(
            `INSERT INTO posts (user_id, moment_id, day, back_url, front_url, caption, location, visibility, retakes, front_main, late_seconds, seeded, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          )
          .run(me.id, moment.id, today, backUrl, frontUrl, caption, location, visibility, retakes, frontMain, lateSeconds, now());
        const row = db.query(`${POST_SELECT} WHERE p.id = ?`).get(Number(res.lastInsertRowid)) as Row;
        return json({ post: hydrate([row], me.id)[0] });
      },
    },

    "/api/posts/:id": {
      DELETE: (req) => {
        const me = getUser(req);
        if (!me) return fail("Session expirée", 401);
        const id = Number((req as any).params.id);
        const post = db.query("SELECT * FROM posts WHERE id = ? AND user_id = ?").get(id, me.id) as Row | null;
        if (!post) return fail("Introuvable", 404);
        db.query("DELETE FROM reactions WHERE post_id = ?").run(id);
        db.query("DELETE FROM comments WHERE post_id = ?").run(id);
        db.query("DELETE FROM posts WHERE id = ?").run(id);
        return json({ ok: true });
      },
    },

    "/api/posts/:id/reactions": {
      POST: async (req) => {
        const me = getUser(req);
        if (!me) return fail("Session expirée", 401);
        const id = Number((req as any).params.id);
        const body = (await req.json().catch(() => null)) as Row | null;
        const emoji = String(body?.emoji || "");
        if (!EMOJIS.includes(emoji)) return fail("Emoji inconnu");
        if (!db.query("SELECT id FROM posts WHERE id = ?").get(id)) return fail("Introuvable", 404);
        const existing = db.query("SELECT * FROM reactions WHERE post_id = ? AND user_id = ?").get(id, me.id) as Row | null;
        if (existing && existing.emoji === emoji) {
          db.query("DELETE FROM reactions WHERE id = ?").run(existing.id);
        } else {
          db.query("DELETE FROM reactions WHERE post_id = ? AND user_id = ?").run(id, me.id);
          db.query("INSERT INTO reactions (post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)").run(id, me.id, emoji, now());
        }
        const row = db.query(`${POST_SELECT} WHERE p.id = ?`).get(id) as Row;
        return json({ post: hydrate([row], me.id)[0] });
      },
    },

    "/api/posts/:id/comments": {
      POST: async (req) => {
        const me = getUser(req);
        if (!me) return fail("Session expirée", 401);
        const id = Number((req as any).params.id);
        const body = (await req.json().catch(() => null)) as Row | null;
        const text = String(body?.text || "").trim().slice(0, 280);
        if (!text) return fail("Message vide");
        if (!db.query("SELECT id FROM posts WHERE id = ?").get(id)) return fail("Introuvable", 404);
        const res = db
          .query("INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)")
          .run(id, me.id, text, now());
        return json({
          comment: {
            id: Number(res.lastInsertRowid),
            text,
            createdAt: now(),
            user: publicUser(me),
          },
        });
      },
    },

    "/api/demo/moment": {
      POST: (req) => {
        const me = getUser(req);
        if (!me) return fail("Session expirée", 401);
        const res = db.query("INSERT INTO moments (day, notified_at) VALUES (?, ?)").run(dayKey(), now());
        return json({ ok: true, momentId: Number(res.lastInsertRowid) });
      },
    },
  },
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return fail("Route inconnue", 404);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`\n  breal. → ${server.url.href}\n`);
