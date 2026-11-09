import type { Bootstrap, Post, User } from "../lib/types";
import { fmtTime, lateShort } from "../lib/format";
import { Avatar } from "./ui";
import { LinkIcon, ShareIcon } from "./Icons";

export default function Friends({
  data,
  onInvite,
  onOpenProfile,
  onViewPost,
}: {
  data: Bootstrap;
  onInvite: () => void;
  onOpenProfile: (user: User) => void;
  onViewPost: (post: Post) => void;
}) {
  const onlineIds = new Set(data.online.map((u) => u.id));
  const posted = data.friends.filter((f) => f.post).length;
  const waiting = data.friends.length - posted;
  const ranking = [...data.feed]
    .filter((p) => p.lateSeconds > 120)
    .sort((a, b) => b.lateSeconds - a.lateSeconds)
    .slice(0, 3);

  return (
    <div className="friends-page">
      <header className="mobile-top">
        <span className="page-kicker">La bande</span>
        <span className="mono muted">{data.online.length} en ligne</span>
      </header>

      <div className="feed-desktop-head">
        <div>
          <p className="eyebrow">{data.online.length} en ligne ce soir</p>
          <h1 className="page-title">Tes potes.</h1>
        </div>
        <button type="button" className="btn btn-primary btn-small" onClick={onInvite}>
          <ShareIcon size={16} /> Inviter
        </button>
      </div>

      <section className="friends-invite">
        <div>
          <p className="eyebrow">Plus on est de fous</p>
          <h2 className="invite-title">Ce BeReal est meilleur à plusieurs.</h2>
          <p className="invite-sub">
            {posted} ont posté.{" "}
            {waiting === 0 ? "Tout le monde est là." : `${waiting} font durer le suspense.`}
          </p>
        </div>
        <button type="button" className="invite-link" onClick={onInvite}>
          <LinkIcon size={16} />
          <span>{typeof location !== "undefined" ? location.host : "breal.app"}</span>
          <span className="invite-copy">Copier</span>
        </button>
      </section>

      <div className="friends-meta">
        <span className="eyebrow">Ta bande</span>
        <span className="mono muted">{data.friends.length} potes</span>
      </div>

      <div className="friends-list">
        {data.friends.map((friend) => {
          const post = friend.post ? data.feed.find((p) => p.id === friend.post!.id) ?? null : null;
          const isOnline = onlineIds.has(friend.id);
          return (
            <div key={friend.id} className="friend-row">
              <button type="button" className="friend-main" onClick={() => onOpenProfile(friend)}>
                <span className="friend-avatar">
                  <Avatar user={friend} size={46} />
                  {isOnline && <span className="online-dot" title="En ligne" />}
                </span>
                <span className="friend-copy">
                  <span className="friend-name">{friend.name}</span>
                  <span className="friend-status">
                    {post ? (
                      <>
                        A posté à {fmtTime(post.createdAt)} ·{" "}
                        <span className={post.lateSeconds > 120 ? "late-text" : ""}>{lateShort(post.lateSeconds)}</span>
                      </>
                    ) : (
                      "N’a pas encore posté"
                    )}
                  </span>
                </span>
              </button>
              {post ? (
                <button type="button" className="friend-thumb" onClick={() => onViewPost(post)} aria-label={`Voir le BeReal de ${friend.name}`}>
                  <img src={post.backUrl} alt="" loading="lazy" />
                  <img src={post.frontUrl} alt="" className="friend-thumb-pip" loading="lazy" />
                </button>
              ) : (
                <span className="friend-wait" aria-label="Pas encore posté">—</span>
              )}
            </div>
          );
        })}
      </div>

      {ranking.length > 0 && (
        <section className="ranking">
          <div className="ranking-head">
            <p className="eyebrow">Classement du retard</p>
            <p className="ranking-sub">Ceux qui ont pris leur temps. Bravo, quand même.</p>
          </div>
          {ranking.map((post, i) => (
            <button key={post.id} type="button" className="rank-row" onClick={() => onViewPost(post)}>
              <span className="rank-num">{String(i + 1).padStart(2, "0")}</span>
              <Avatar user={post.user} size={30} />
              <span className="rank-name">{post.user.name}</span>
              <span className="mono late-text">{lateShort(post.lateSeconds)}</span>
            </button>
          ))}
        </section>
      )}

      <p className="friends-foot">
        Un BeReal par jour. <span className="mono">Pas de classement de beauté, promis.</span>
      </p>
    </div>
  );
}
