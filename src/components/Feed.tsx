import { useState } from "react";
import type { Bootstrap, Post, User } from "../lib/types";
import { countdown, fmtTime, lateLabel } from "../lib/format";
import { Avatar, Duo, EMOJIS, LateBadge, Wordmark, useNow } from "./ui";
import {
  CheckIcon,
  CommentIcon,
  GlobeIcon,
  MoreIcon,
  PinIcon,
  PlusIcon,
  ShareIcon,
} from "./Icons";

type ReactFn = (post: Post, emoji: string) => void;

export function MomentPanel({
  data,
  variant,
  onOpenCamera,
  onShowMine,
}: {
  data: Bootstrap;
  variant: "banner" | "rail";
  onOpenCamera: () => void;
  onShowMine: () => void;
}) {
  const now = useNow();
  const { moment, myTodayPostId, feed } = data;
  const posted = myTodayPostId != null;
  const myPost = feed.find((p) => p.id === myTodayPostId) ?? null;
  const elapsed = Math.max(0, now - moment.notifiedAt);
  const lateSeconds = Math.floor(elapsed / 1000);
  const live = !posted && elapsed <= moment.lateWindow * 1000;

  if (posted) {
    return (
      <section className={`moment-panel is-posted ${variant}`}>
        <div className="moment-status">
          <span className="moment-dot is-done">
            <CheckIcon size={13} />
          </span>
          <p className="eyebrow">C’est fait</p>
        </div>
        <h2 className="moment-title">Ton BeReal est en ligne.</h2>
        <p className="moment-sub">
          Posté à {myPost ? fmtTime(myPost.createdAt) : "—"} ·{" "}
          {myPost ? lateLabel(myPost.lateSeconds) : "aujourd’hui"}
        </p>
        <div className="moment-foot">
          <button type="button" className="text-link" onClick={onShowMine}>
            Voir mon BeReal
          </button>
          <span className="mono muted">Prochain : demain, à l’improviste</span>
        </div>
      </section>
    );
  }

  return (
    <section className={`moment-panel ${live ? "is-live" : "is-late"} ${variant}`}>
      <div className="moment-status">
        <span className={`moment-dot ${live ? "is-live" : ""}`} />
        <p className="eyebrow">{live ? "C’est l’heure" : "Tu es en retard"}</p>
        {live && <span className="moment-count">{countdown(moment.lateWindow * 1000 - elapsed)}</span>}
      </div>
      <h2 className="moment-title">{live ? "Prends ton BeReal." : "Rattrape le coup."}</h2>
      <p className="moment-sub">
        {live
          ? "Deux minutes. Ce que tu as devant toi. Pas de préparation."
          : `${lateLabel(lateSeconds)}. Les autres ont déjà posté, mais rien ne t’empêche de les rejoindre.`}
      </p>
      <div className="moment-foot">
        <button type="button" className="btn btn-primary" onClick={onOpenCamera}>
          Prendre mon BeReal
        </button>
        <span className="mono muted">2 min pour le prendre</span>
      </div>
    </section>
  );
}

export function PostCard({
  post,
  me,
  onReact,
  onComment,
  onShare,
  onDelete,
  onView,
  onOpenProfile,
  onToast,
}: {
  post: Post;
  me: User;
  onReact: ReactFn;
  onComment: (post: Post) => void;
  onShare: (post: Post) => void;
  onDelete: (post: Post) => void;
  onView: (post: Post) => void;
  onOpenProfile: (user: User) => void;
  onToast: (message: string) => void;
}) {
  const [tray, setTray] = useState(false);
  const [menu, setMenu] = useState(false);
  const mine = post.user.id === me.id;
  const firstName = (name: string) => name.split(" ")[0];

  return (
    <article className="post" id={`post-${post.id}`}>
      <header className="post-head">
        <button type="button" className="avatar-btn" onClick={() => onOpenProfile(post.user)} aria-label={`Profil de ${post.user.name}`}>
          <Avatar user={post.user} size={42} />
        </button>
        <div className="post-id">
          <div className="post-name-row">
            <span className="post-name">{post.user.name}</span>
            {post.visibility === "public" && (
              <span className="public-mark" title="Public">
                <GlobeIcon size={12} />
              </span>
            )}
          </div>
          <p className="post-meta">
            @{post.user.username} · {fmtTime(post.createdAt)}
            {post.retakes > 0 && ` · ${post.retakes} reprise${post.retakes > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="post-head-right">
          <LateBadge seconds={post.lateSeconds} compact />
          {mine && (
            <div className="menu-wrap">
              <button
                type="button"
                className="icon-btn icon-btn-small"
                aria-label="Options"
                onClick={() => setMenu((m) => !m)}
              >
                <MoreIcon size={18} />
              </button>
              {menu && (
                <>
                  <div className="menu-backdrop" onClick={() => setMenu(false)} />
                  <div className="menu-pop">
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(false);
                        onDelete(post);
                      }}
                    >
                      Supprimer ce BeReal
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="post-media">
        <Duo
          backUrl={post.backUrl}
          frontUrl={post.frontUrl}
          frontMain={post.frontMain}
          onOpen={() => onView(post)}
          alt={`Le BeReal de ${post.user.name}`}
        />
        {post.location && (
          <span className="loc-chip">
            <PinIcon size={12} />
            {post.location}
          </span>
        )}
      </div>

      <div className="post-body">
        {post.caption && <p className="post-caption">{post.caption}</p>}

        <div className="reactions-row">
          {post.reactions.map((g) => (
            <button
              key={g.emoji}
              type="button"
              className={`reaction-chip ${post.myReaction === g.emoji ? "is-mine" : ""}`}
              onClick={() => onReact(post, g.emoji)}
              title={g.users.map((u) => u.name).join(", ")}
            >
              <span className="reaction-emoji">{g.emoji}</span>
              <span className="reaction-count">{g.count}</span>
            </button>
          ))}
          <button
            type="button"
            className={`reaction-add ${tray ? "is-open" : ""}`}
            onClick={() => setTray((t) => !t)}
            aria-label="Réagir"
            aria-expanded={tray}
          >
            <PlusIcon size={14} />
            {post.reactions.length === 0 && <span>Réagir</span>}
          </button>
          <span className="reactions-spacer" />
          <button type="button" className="post-tool" onClick={() => onComment(post)} aria-label="Commenter">
            <CommentIcon size={19} />
            {post.comments.length > 0 && <span>{post.comments.length}</span>}
          </button>
          <button type="button" className="post-tool" onClick={() => onShare(post)} aria-label="Partager">
            <ShareIcon size={18} />
          </button>
        </div>

        {tray && (
          <div className="emoji-tray">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`emoji-btn ${post.myReaction === emoji ? "is-mine" : ""}`}
                onClick={() => {
                  onReact(post, emoji);
                  setTray(false);
                }}
                aria-label={`Réagir avec ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {post.comments.length > 0 && (
          <div className="comment-preview">
            {post.comments.slice(-2).map((c) => (
              <button key={c.id} type="button" className="comment-line" onClick={() => onComment(post)}>
                <b>{firstName(c.user.name)}</b> {c.text}
              </button>
            ))}
            {post.comments.length > 2 && (
              <button type="button" className="comment-more" onClick={() => onComment(post)}>
                Voir les {post.comments.length} commentaires
              </button>
            )}
          </div>
        )}
        {post.comments.length === 0 && (
          <button
            type="button"
            className="comment-empty"
            onClick={() => {
              onComment(post);
              onToast("Sois le premier. Sois drôle.");
            }}
          >
            Ajouter un commentaire…
          </button>
        )}
      </div>
    </article>
  );
}

export default function Feed({
  data,
  loading,
  feedTab,
  setFeedTab,
  onOpenCamera,
  onShowMine,
  onReact,
  onComment,
  onShare,
  onDelete,
  onView,
  onOpenProfile,
  onOpenFriends,
  onToast,
}: {
  data: Bootstrap;
  loading: boolean;
  feedTab: "friends" | "discovery";
  setFeedTab: (tab: "friends" | "discovery") => void;
  onOpenCamera: () => void;
  onShowMine: () => void;
  onReact: ReactFn;
  onComment: (post: Post) => void;
  onShare: (post: Post) => void;
  onDelete: (post: Post) => void;
  onView: (post: Post) => void;
  onOpenProfile: (user: User) => void;
  onOpenFriends: () => void;
  onToast: (message: string) => void;
}) {
  const posts = feedTab === "friends" ? data.feed : data.discovery;
  const tabLabel = feedTab === "friends" ? "Mes potes" : "Découvrir";
  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="feed">
      <header className="mobile-top">
        <Wordmark />
        <div className="mobile-top-right">
          {data.stats.streak > 0 && (
            <span className="streak-pill" title="Jours d’affilée">
              <span className="streak-dot" />
              {data.stats.streak} j
            </span>
          )}
          <button type="button" className="avatar-btn" onClick={() => onOpenProfile(data.me)} aria-label="Ton profil">
            <Avatar user={data.me} size={34} />
          </button>
        </div>
      </header>

      <div className="feed-desktop-head">
        <div>
          <p className="eyebrow">Aujourd’hui · {todayLabel}</p>
          <h1 className="page-title">Le fil.</h1>
        </div>
        <button type="button" className="btn btn-primary btn-small" onClick={onOpenCamera}>
          Prendre mon BeReal
        </button>
      </div>

      <div className="feed-tabs" role="tablist" aria-label="Fil">
        <button
          type="button"
          role="tab"
          aria-selected={feedTab === "friends"}
          className={feedTab === "friends" ? "is-active" : ""}
          onClick={() => setFeedTab("friends")}
        >
          Mes potes <span className="tab-count">{data.feed.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={feedTab === "discovery"}
          className={feedTab === "discovery" ? "is-active" : ""}
          onClick={() => setFeedTab("discovery")}
        >
          Découvrir <span className="tab-count">{data.discovery.length}</span>
        </button>
      </div>

      {feedTab === "friends" && (
        <MomentPanel data={data} variant="banner" onOpenCamera={onOpenCamera} onShowMine={onShowMine} />
      )}

      {feedTab === "discovery" && (
        <p className="discovery-note">
          Les BeReals publics, partout. Pas d’algorithme, juste l’ordre d’arrivée.
        </p>
      )}

      <div className={`post-list ${loading ? "is-loading" : ""}`}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            me={data.me}
            onReact={onReact}
            onComment={onComment}
            onShare={onShare}
            onDelete={onDelete}
            onView={onView}
            onOpenProfile={onOpenProfile}
            onToast={onToast}
          />
        ))}

        {posts.length === 0 && (
          <div className="empty-feed">
            {feedTab === "friends" ? (
              <>
                <p className="eyebrow">Silence radio</p>
                <h2 className="display-sm">Personne n’a<br />encore posté.</h2>
                <p className="lede">
                  Sois le premier à montrer ta vraie vie. Même si elle est un peu nulle aujourd’hui.
                </p>
                <div className="empty-actions">
                  <button type="button" className="btn btn-primary" onClick={onOpenCamera}>
                    Prendre mon BeReal
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={onOpenFriends}>
                    Inviter un pote
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">Rien à voir</p>
                <h2 className="display-sm">Le monde est<br />timide aujourd’hui.</h2>
                <p className="lede">Les BeReals publics apparaîtront ici. Reviens dans une minute.</p>
              </>
            )}
          </div>
        )}
      </div>

      {feedTab === "friends" && posts.length > 0 && (
        <p className="feed-end">
          C’est tout pour aujourd’hui. <span className="mono">Fin du fil — {tabLabel}</span>
        </p>
      )}
    </div>
  );
}
