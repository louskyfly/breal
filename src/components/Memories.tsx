import { useMemo, useState } from "react";
import type { Bootstrap, Post } from "../lib/types";
import { fmtDay, fmtMonth } from "../lib/format";
import { CameraIcon } from "./Icons";

export default function Memories({
  data,
  onViewPost,
  onOpenCamera,
}: {
  data: Bootstrap;
  onViewPost: (post: Post) => void;
  onOpenCamera: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const myToday = data.feed.find((p) => p.user.id === data.me.id) ?? null;

  const posts = useMemo(() => {
    if (filter === "mine") {
      const mine = data.memories.filter((p) => p.user.id === data.me.id);
      return (myToday ? [myToday, ...mine] : mine).sort((a, b) => b.createdAt - a.createdAt);
    }
    return data.memories;
  }, [filter, data.memories, data.me.id, myToday]);

  const months = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      const key = fmtMonth(post.createdAt);
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [posts]);

  return (
    <div className="memories-page">
      <header className="mobile-top">
        <span className="page-kicker">Souvenirs</span>
        <span className="mono muted">{data.memories.length} photos</span>
      </header>

      <div className="feed-desktop-head">
        <div>
          <p className="eyebrow">Tout ce qu’on a osé poster</p>
          <h1 className="page-title">Souvenirs.</h1>
        </div>
        <button type="button" className="btn btn-ghost btn-small" onClick={onOpenCamera}>
          <CameraIcon size={16} /> Prendre aujourd’hui
        </button>
      </div>

      <p className="memories-lede">
        La mémoire de la bande. Les photos restent, les bonnes excuses aussi.
      </p>

      <div className="memories-bar">
        <div className="segmented segmented-small">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            La bande <span className="tab-count">{data.memories.length}</span>
          </button>
          <button type="button" aria-pressed={filter === "mine"} onClick={() => setFilter("mine")}>
            Moi <span className="tab-count">{data.memories.filter((p) => p.user.id === data.me.id).length + (myToday ? 1 : 0)}</span>
          </button>
        </div>
        <span className="mono muted">{months.length} mois</span>
      </div>

      {posts.length === 0 ? (
        <div className="empty-feed memories-empty">
          <p className="eyebrow">{filter === "mine" ? "Page blanche" : "Rien à archiver"}</p>
          <h2 className="display-sm">
            {filter === "mine" ? (
              <>
                Rien ici.
                <br />
                Encore.
              </>
            ) : (
              <>
                Pas encore
                <br />
                de souvenirs.
              </>
            )}
          </h2>
          <p className="lede">
            {filter === "mine"
              ? "Ton premier BeReal fera partie de l’histoire. Commence maintenant."
              : "Les BeReals de la bande apparaîtront ici, classés par mois."}
          </p>
          <button type="button" className="btn btn-primary" onClick={onOpenCamera}>
            Prendre mon BeReal
          </button>
        </div>
      ) : (
        months.map(([month, list]) => (
          <section key={month} className="memory-month">
            <div className="month-head">
              <h2 className="month-title">{month}</h2>
              <span className="mono muted">{list.length} photo{list.length > 1 ? "s" : ""}</span>
            </div>
            <div className="memory-grid">
              {list.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className="memory-item"
                  onClick={() => onViewPost(post)}
                  aria-label={`Voir le BeReal de ${post.user.name} du ${fmtDay(post.createdAt)}`}
                >
                  <img className="memory-back" src={post.backUrl} alt="" loading="lazy" />
                  <img className="memory-front" src={post.frontUrl} alt="" loading="lazy" />
                  <span className="memory-overlay">
                    <span className="memory-day mono">{fmtDay(post.createdAt)}</span>
                    <span className="memory-name">
                      {filter === "mine" ? "toi" : post.user.name.split(" ")[0]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      <p className="feed-end">
        Les souvenirs ne s’effacent pas. <span className="mono">Enfin, sauf si tu supprimes.</span>
      </p>
    </div>
  );
}
