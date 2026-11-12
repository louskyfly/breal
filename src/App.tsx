import { useCallback, useEffect, useRef, useState } from "react";
import type { Bootstrap, Comment, Post, User } from "./lib/types";
import { api, ApiError, getToken, setToken } from "./lib/api";
import { fmtTime, lateLabel } from "./lib/format";
import Onboarding from "./components/Onboarding";
import AdminAccounts from "./components/AdminAccounts";
import Consent, { CharterSheet } from "./components/Consent";
import Feed, { MomentPanel } from "./components/Feed";
import Friends from "./components/Friends";
import Memories from "./components/Memories";
import Profile from "./components/Profile";
import Capture from "./components/Capture";
import {
  CommentsSheet,
  ConfirmDeleteSheet,
  PostViewer,
  PrivacySheet,
  UserSheet,
} from "./components/Overlays";
import { Avatar, Toast, Wordmark } from "./components/ui";
import {
  ArchiveIcon,
  CameraIcon,
  HomeIcon,
  UserIcon,
  UsersIcon,
} from "./components/Icons";

type Tab = "feed" | "friends" | "memories" | "profile";
type ToastData = { message: string; tone: "plain" | "flash" | "error" };

const NAV: { id: Tab; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: "feed", label: "Le fil", icon: (p) => <HomeIcon {...p} /> },
  { id: "friends", label: "Potes", icon: (p) => <UsersIcon {...p} /> },
  { id: "memories", label: "Souvenirs", icon: (p) => <ArchiveIcon {...p} /> },
  { id: "profile", label: "Profil", icon: (p) => <UserIcon {...p} /> },
];

export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>("feed");
  const [feedTab, setFeedTab] = useState<"friends" | "discovery">("friends");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [commentsId, setCommentsId] = useState<number | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [charterOpen, setCharterOpen] = useState(false);
  const [consent, setConsent] = useState(() => {
    try {
      return localStorage.getItem("breal.consent") === "2026-11";
    } catch {
      return false;
    }
  });
  const [toast, setToast] = useState<ToastData | null>(null);
  const [loading, setLoading] = useState(false);

  const dataRef = useRef<Bootstrap | null>(null);
  const seenPosts = useRef<Set<number> | null>(null);
  const lastMoment = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, tone: ToastData["tone"] = "plain") => {
    setToast({ message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), tone === "flash" ? 4600 : 3600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!getToken()) return null;
      if (!silent) setLoading(true);
      try {
        const next = await api.bootstrap();
        if (seenPosts.current) {
          if (lastMoment.current && next.moment.id !== lastMoment.current) {
            notify("C’EST L’HEURE DE TON BEREAL.", "flash");
            navigator.vibrate?.([35, 70, 35]);
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification("breal. — C’est l’heure", {
                  body: "Deux minutes pour prendre ton BeReal.",
                  icon: "/icon-192.png",
                  tag: "breal-moment",
                });
              } catch {
                /* some mobile browsers need a service worker */
              }
            }
          }
          const fresh = next.feed.filter(
            (p) => !seenPosts.current!.has(p.id) && p.user.id !== next.me.id,
          );
          if (fresh.length && dataRef.current) {
            const names = [...new Set(fresh.map((p) => p.user.name.split(" ")[0]))];
            notify(
              names.length === 1 ? `Nouveau BeReal de ${names[0]}.` : `${fresh.length} nouveaux BeReals.`,
            );
          }
        }
        seenPosts.current = new Set([...(seenPosts.current ?? []), ...next.feed.map((p) => p.id)]);
        lastMoment.current = next.moment.id;
        dataRef.current = next;
        setData(next);
        return next;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setToken(null);
          dataRef.current = null;
          setData(null);
          seenPosts.current = null;
          lastMoment.current = null;
        } else if (!silent) {
          notify(e instanceof ApiError ? e.message : "Impossible de charger le fil.", "error");
        }
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (getToken()) await load(true);
      if (alive) setBooting(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && !cameraOpen) void load(true);
    };
    const id = setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [data, cameraOpen, load]);

  const updatePost = useCallback((updated: Post) => {
    setData((prev) => {
      if (!prev) return prev;
      const patch = (list: Post[]) => list.map((p) => (p.id === updated.id ? updated : p));
      return {
        ...prev,
        feed: patch(prev.feed),
        discovery: patch(prev.discovery),
        memories: patch(prev.memories),
      };
    });
  }, []);

  const addComment = useCallback((postId: number, comment: Comment) => {
    setData((prev) => {
      if (!prev) return prev;
      const patch = (list: Post[]) =>
        list.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p));
      return {
        ...prev,
        feed: patch(prev.feed),
        discovery: patch(prev.discovery),
        memories: patch(prev.memories),
      };
    });
  }, []);

  async function handleJoined(user: User) {
    seenPosts.current = null;
    lastMoment.current = null;
    setBooting(true);
    const next = await load(true);
    setBooting(false);
    if (next) {
      notify(`Bienvenue ${user.name.split(" ")[0]}. À toi de jouer.`, "flash");
      setTab("feed");
    }
  }

  async function react(post: Post, emoji: string) {
    try {
      const { post: updated } = await api.react(post.id, emoji);
      updatePost(updated);
      navigator.vibrate?.(6);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Réaction non envoyée", "error");
    }
  }

  async function sharePost(post: Post) {
    const url = typeof location !== "undefined" ? location.origin : "";
    const text = `Le BeReal de ${post.user.name} sur breal.${post.caption ? ` « ${post.caption} »` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "breal.", text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} — ${url}`);
      notify("Lien copié. Balance-le.", "flash");
    } catch {
      notify("Copie ce lien : " + url);
    }
  }

  async function shareInvite() {
    const url = typeof location !== "undefined" ? location.origin : "";
    const text = "Viens prendre ton BeReal sur breal. Un par jour, deux minutes, zéro filtre.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "breal.", text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify("Lien copié. Balance-le à tes potes.", "flash");
    } catch {
      notify("Copie ce lien : " + url);
    }
  }

  function handlePublished(post: Post) {
    setCameraOpen(false);
    setTab("feed");
    setFeedTab("friends");
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        myTodayPostId: post.id,
        feed: [post, ...prev.feed.filter((p) => p.id !== post.id)],
      };
    });
    seenPosts.current?.add(post.id);
    notify(
      post.lateSeconds > 120 ? `Publié. ${lateLabel(post.lateSeconds)}.` : "Publié. Dans les temps.",
      "flash",
    );
    void load(true).then(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function handleDeleted() {
    notify("Supprimé. Tu peux reprendre ton BeReal.", "plain");
    void load(true);
  }

  async function confirmDelete() {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      await api.deletePost(deleteId);
      notify("Supprimé. Tu peux reprendre.", "plain");
      setDeleteId(null);
      setViewerId(null);
      setCommentsId(null);
      await load(true);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Suppression impossible", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function triggerMoment() {
    try {
      await api.triggerMoment();
      await load(true);
      setTab("feed");
      setFeedTab("friends");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Impossible de relancer le moment", "error");
    }
  }

  function openProfile(user: User) {
    if (data && user.id === data.me.id) {
      setTab("profile");
      setViewUser(null);
    } else {
      setViewUser(user);
    }
  }

  function openCamera() {
    setViewerId(null);
    setCommentsId(null);
    setViewUser(null);
    setCameraOpen(true);
  }

  function showMine() {
    const id = data?.myTodayPostId;
    setTab("feed");
    setFeedTab("friends");
    setViewerId(null);
    setTimeout(() => {
      if (id) document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function changeTab(next: Tab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function stopSite() {
    const ok = window.confirm(
      "Arrêter totalement le site ?\n\nToutes les pages afficheront « Cette page n’existe pas » jusqu’au redémarrage du serveur.",
    );
    if (!ok) return;
    try {
      await api.stopSite();
      window.location.reload();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Impossible d’arrêter le site", "error");
    }
  }

  function logout() {    setToken(null);
    dataRef.current = null;
    seenPosts.current = null;
    lastMoment.current = null;
    setData(null);
    setAdminOpen(false);
    setCameraOpen(false);
    setTab("feed");
    setFeedTab("friends");
    window.scrollTo({ top: 0 });
  }

  if (!consent) return <Consent onAccept={() => setConsent(true)} />;

  if (booting) {
    return (
      <div className="boot">
        <Wordmark />
        <div className="boot-line"><span /></div>
        <p className="mono">On ouvre le fil.</p>
      </div>
    );
  }

  if (!data) {
    return <Onboarding onJoined={handleJoined} />;
  }

  const allPosts = [...data.feed, ...data.discovery, ...data.memories];
  const viewerPost = viewerId != null ? allPosts.find((p) => p.id === viewerId) ?? null : null;
  const commentsPost = commentsId != null ? allPosts.find((p) => p.id === commentsId) ?? null : null;
  const deletePost = deleteId != null ? allPosts.find((p) => p.id === deleteId) ?? null : null;
  const myPost = data.feed.find((p) => p.user.id === data.me.id) ?? null;

  return (
    <div className="app">
      <div className="shell">
        <aside className="rail-left">
          <button type="button" className="rail-brand" onClick={() => changeTab("feed")}>
            <Wordmark />
          </button>
          <p className="rail-tag">La vraie vie, en retard.</p>

          <button type="button" className="rail-camera" onClick={openCamera}>
            <span className="rail-shutter"><CameraIcon size={20} /></span>
            <span>
              {myPost ? "Déjà posté" : "Prendre mon BeReal"}
              <small>{myPost ? "Tu peux le revoir" : "2 minutes, pas plus"}</small>
            </span>
          </button>

          <nav className="rail-nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? "is-active" : ""}
                onClick={() => changeTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
              >
                <span className="rail-nav-icon">{item.icon({ size: 19 })}</span>
                {item.label}
                {item.id === "friends" && data.online.length > 0 && (
                  <span className="rail-online">{data.online.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="rail-status">
            <p className="eyebrow">Aujourd’hui</p>
            {myPost ? (
              <p className="rail-status-main">Posté à {fmtTime(myPost.createdAt)}.</p>
            ) : (
              <p className="rail-status-main">Pas encore posté.</p>
            )}
            <p className="rail-status-sub mono">
              {data.stats.streak > 0
                ? `Série de ${data.stats.streak} ${data.stats.streak === 1 ? "jour" : "jours"}`
                : "Lance ta série aujourd’hui"}
            </p>
          </div>

          <button type="button" className="rail-me" onClick={() => changeTab("profile")}>
            <Avatar user={data.me} size={36} />
            <span>
              <b>{data.me.name}</b>
              <small>@{data.me.username}</small>
            </span>
          </button>
        </aside>

        <main className="main">
          {tab === "feed" && (
            <Feed
              data={data}
              loading={loading}
              feedTab={feedTab}
              setFeedTab={setFeedTab}
              onOpenCamera={openCamera}
              onShowMine={showMine}
              onReact={react}
              onComment={(post) => setCommentsId(post.id)}
              onShare={sharePost}
              onDelete={(post) => setDeleteId(post.id)}
              onView={(post) => setViewerId(post.id)}
              onOpenProfile={openProfile}
              onOpenFriends={() => changeTab("friends")}
              onToast={(message) => notify(message)}
            />
          )}
          {tab === "friends" && (
            <Friends
              data={data}
              onInvite={shareInvite}
              onOpenProfile={openProfile}
              onViewPost={(post) => setViewerId(post.id)}
            />
          )}
          {tab === "memories" && (
            <Memories
              data={data}
              onViewPost={(post) => setViewerId(post.id)}
              onOpenCamera={openCamera}
            />
          )}
          {tab === "profile" && (
            <Profile
              data={data}
              onOpenCamera={openCamera}
              onViewPost={(post) => setViewerId(post.id)}
              onTriggerMoment={triggerMoment}
              onInvite={shareInvite}
              onLogout={logout}
              onPrivacy={() => setPrivacyOpen(true)}
              onAdmin={() => setAdminOpen(true)}
              onCharter={() => setCharterOpen(true)}
              onStopSite={stopSite}
              onDeletePost={(post) => setDeleteId(post.id)}
              notify={notify}
            />
          )}
        </main>

        <aside className="rail-right">
          <MomentPanel
            data={data}
            variant="rail"
            onOpenCamera={openCamera}
            onShowMine={showMine}
          />

          <section className="rail-card">
            <div className="rail-card-head">
              <span className="eyebrow">En ligne</span>
              <span className="mono muted">{data.online.length}</span>
            </div>
            {data.online.length === 0 ? (
              <div className="rail-empty">
                <p>Personne en ligne pour l’instant.</p>
                <button type="button" className="text-link" onClick={shareInvite}>
                  Invite tes potes
                </button>
              </div>
            ) : (
              <ul className="online-list">
                {data.online.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => openProfile(u)}>
                      <Avatar user={u} size={30} />
                      <span>{u.name}</span>
                      <span className="online-pip" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rail-rules">
            <p className="eyebrow">Le règlement</p>
            <p className="rail-rule"><span>01</span> Un BeReal par jour.</p>
            <p className="rail-rule"><span>02</span> Deux minutes pour le prendre.</p>
            <p className="rail-rule"><span>03</span> Ni filtre, ni mise en scène.</p>
          </section>

          <p className="rail-foot">Prototype — les photos restent sur ce serveur. Pas de pub, pas de tracker.</p>
        </aside>
      </div>

      <nav className="bottom-nav" aria-label="Navigation">
        {NAV.slice(0, 2).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bottom-item ${tab === item.id ? "is-active" : ""}`}
            onClick={() => changeTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.icon({ size: 22 })}
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" className="bottom-camera" onClick={openCamera} aria-label="Prendre mon BeReal">
          <span className="bottom-camera-ring">
            <CameraIcon size={23} />
          </span>
        </button>
        {NAV.slice(2).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bottom-item ${tab === item.id ? "is-active" : ""}`}
            onClick={() => changeTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.icon({ size: 22 })}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {cameraOpen && (
        <Capture
          me={data.me}
          moment={data.moment}
          myPost={myPost}
          onClose={() => setCameraOpen(false)}
          onPublished={handlePublished}
          onDeleted={handleDeleted}
          onViewPost={(post) => setViewerId(post.id)}
          notify={notify}
        />
      )}

      {viewerPost && (
        <PostViewer
          post={viewerPost}
          me={data.me}
          onClose={() => setViewerId(null)}
          onComment={(post) => setCommentsId(post.id)}
          onShare={sharePost}
          onReact={react}
        />
      )}

      {commentsPost && (
        <CommentsSheet
          post={commentsPost}
          me={data.me}
          onClose={() => setCommentsId(null)}
          onSent={addComment}
          notify={notify}
        />
      )}

      {viewUser && (
        <UserSheet
          user={viewUser}
          data={data}
          onClose={() => setViewUser(null)}
          onViewPost={(post) => {
            setViewUser(null);
            setViewerId(post.id);
          }}
        />
      )}

      <ConfirmDeleteSheet
        post={deletePost}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        busy={deleting}
      />

      <PrivacySheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} />

      {charterOpen && <CharterSheet onClose={() => setCharterOpen(false)} />}

      {adminOpen && <AdminAccounts onClose={() => setAdminOpen(false)} notify={notify} />}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
