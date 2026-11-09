import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Bootstrap, Comment, Post, User } from "../lib/types";
import { api, ApiError } from "../lib/api";
import { fmtLongDay, fmtTime, lateLabel, relTime } from "../lib/format";
import { Avatar, LateBadge, Sheet, useLockBody } from "./ui";
import {
  CommentIcon,
  PinIcon,
  SendIcon,
  ShareIcon,
  TrashIcon,
  XIcon,
} from "./Icons";

export function CommentsSheet({
  post,
  me,
  onClose,
  onSent,
  notify,
}: {
  post: Post;
  me: User;
  onClose: () => void;
  onSent: (postId: number, comment: Comment) => void;
  notify: (message: string, tone?: "plain" | "flash" | "error") => void;
}) {
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setComments(post.comments);
  }, [post.comments, post.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const { comment } = await api.comment(post.id, value);
      setComments((prev) => [...prev, comment]);
      onSent(post.id, comment);
      setText("");
      navigator.vibrate?.(8);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Commentaire non envoyé", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={`${comments.length} message${comments.length > 1 ? "s" : ""}`}
      title="Commentaires"
      className="comments-sheet"
      footer={
        <form className="comment-form" onSubmit={send}>
          <Avatar user={me} size={32} />
          <input
            className="comment-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un commentaire…"
            maxLength={280}
            aria-label="Ton commentaire"
          />
          <button type="submit" className="send-btn" disabled={!text.trim() || sending} aria-label="Envoyer">
            <SendIcon size={18} />
          </button>
        </form>
      }
    >
      <div className="comments-list">
        {comments.length === 0 && (
          <div className="comments-empty">
            <p className="eyebrow">Le calme avant</p>
            <p>Personne n’a rien dit. Sois le premier, sois drôle.</p>
          </div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="comment-item">
            <Avatar user={c.user} size={34} />
            <div className="comment-content">
              <div className="comment-top">
                <span className="comment-name">{c.user.name}</span>
                <span className="mono muted">{fmtTime(c.createdAt)}</span>
              </div>
              <p className="comment-text">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function PostViewer({
  post,
  me,
  onClose,
  onComment,
  onShare,
  onReact,
}: {
  post: Post;
  me: User;
  onClose: () => void;
  onComment: (post: Post) => void;
  onShare: (post: Post) => void;
  onReact: (post: Post, emoji: string) => void;
}) {
  useLockBody(true);
  const [showEmoji, setShowEmoji] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`BeReal de ${post.user.name}`}>
      <header className="viewer-head">
        <div className="viewer-user">
          <Avatar user={post.user} size={38} />
          <div>
            <p className="viewer-name">{post.user.name}</p>
            <p className="post-meta">
              @{post.user.username} · {fmtLongDay(post.createdAt)} · {fmtTime(post.createdAt)}
            </p>
          </div>
        </div>
        <button type="button" className="icon-btn icon-btn-dark" onClick={onClose} aria-label="Fermer">
          <XIcon size={22} />
        </button>
      </header>

      <div className="viewer-scroll">
        <div className="viewer-media">
          <img src={post.frontMain ? post.frontUrl : post.backUrl} alt={`Le BeReal de ${post.user.name}`} className="viewer-main" />
          <img
            src={post.frontMain ? post.backUrl : post.frontUrl}
            alt=""
            className="viewer-pip"
          />
        </div>
        <div className="viewer-info">
          <div className="viewer-meta">
            <LateBadge seconds={post.lateSeconds} />
            {post.location && (
              <span className="viewer-loc">
                <PinIcon size={13} /> {post.location}
              </span>
            )}
            {post.retakes > 0 && <span className="mono muted">{post.retakes} reprise{post.retakes > 1 ? "s" : ""}</span>}
          </div>
          {post.caption && <p className="viewer-caption">{post.caption}</p>}

          <div className="viewer-reactions">
            {post.reactions.map((g) => (
              <button
                key={g.emoji}
                type="button"
                className={`reaction-chip ${post.myReaction === g.emoji ? "is-mine" : ""}`}
                onClick={() => onReact(post, g.emoji)}
              >
                {g.emoji} <span className="reaction-count">{g.count}</span>
              </button>
            ))}
            <button
              type="button"
              className="reaction-add"
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="Réagir"
            >
              <span aria-hidden="true">＋</span> Réagir
            </button>
          </div>
          {showEmoji && (
            <div className="emoji-tray">
              {["😂", "😍", "🔥", "😮", "💀", "🫶", "👀", "😭"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`emoji-btn ${post.myReaction === emoji ? "is-mine" : ""}`}
                  onClick={() => {
                    onReact(post, emoji);
                    setShowEmoji(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="viewer-tools">
            <button type="button" className="btn btn-ghost btn-wide" onClick={() => onComment(post)}>
              <CommentIcon size={18} /> Commenter ({post.comments.length})
            </button>
            <button type="button" className="btn btn-ghost btn-wide" onClick={() => onShare(post)}>
              <ShareIcon size={17} /> Partager
            </button>
          </div>

          {post.comments.length > 0 && (
            <div className="viewer-comments">
              {post.comments.slice(-3).map((c) => (
                <p key={c.id}>
                  <b>{c.user.name.split(" ")[0]}</b> {c.text}
                </p>
              ))}
            </div>
          )}
          <p className="fineprint">
            Publié {relTime(post.createdAt)} · {lateLabel(post.lateSeconds)}
            {me.id === post.user.id ? " · c’est toi" : ""}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function UserSheet({
  user,
  data,
  onClose,
  onViewPost,
}: {
  user: User;
  data: Bootstrap;
  onClose: () => void;
  onViewPost: (post: Post) => void;
}) {
  const seen = new Set<number>();
  const posts = [...data.feed, ...data.discovery, ...data.memories]
    .filter((p) => p.user.id === user.id)
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort((a, b) => b.createdAt - a.createdAt);
  const today = data.feed.find((p) => p.user.id === user.id);
  const lateAvg =
    posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + p.lateSeconds, 0) / posts.length) : 0;

  return (
    <Sheet open onClose={onClose} eyebrow={`@${user.username}`} title={user.name}>
      <div className="user-sheet">
        <div className="user-hero">
          <Avatar user={user} size={72} />
          <div className="user-stats">
            <div>
              <span className="stat-num">{posts.length}</span>
              <span className="stat-label">BeReals</span>
            </div>
            <div>
              <span className="stat-num">{lateAvg > 120 ? `${Math.floor(lateAvg / 60)}′` : "—"}</span>
              <span className="stat-label">retard moyen</span>
            </div>
            <div>
              <span className="stat-num">{today ? "✓" : "—"}</span>
              <span className="stat-label">aujourd’hui</span>
            </div>
          </div>
        </div>

        {today ? (
          <button type="button" className="user-today" onClick={() => onViewPost(today)}>
            <div className="user-today-thumb">
              <img src={today.backUrl} alt="" />
              <img src={today.frontUrl} alt="" className="user-today-pip" />
            </div>
            <div className="user-today-copy">
              <p className="eyebrow">Son BeReal du jour</p>
              <p>{today.caption || "Sans légende."}</p>
              <p className="mono muted">
                {fmtTime(today.createdAt)} · {lateLabel(today.lateSeconds)}
              </p>
            </div>
          </button>
        ) : (
          <p className="user-empty">N’a pas encore posté aujourd’hui. Le suspense est insoutenable.</p>
        )}

        <div>
          <p className="eyebrow user-grid-title">Ses derniers BeReals</p>
          {posts.length === 0 ? (
            <p className="user-empty">Aucun souvenir pour l’instant.</p>
          ) : (
            <div className="user-grid">
              {posts.slice(0, 12).map((p) => (
                <button key={p.id} type="button" className="user-thumb" onClick={() => onViewPost(p)}>
                  <img src={p.backUrl} alt="" loading="lazy" />
                  <img src={p.frontUrl} alt="" loading="lazy" className="user-thumb-pip" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export function ConfirmDeleteSheet({
  post,
  onClose,
  onConfirm,
  busy,
}: {
  post: Post | null;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Sheet
      open={!!post}
      onClose={onClose}
      eyebrow="Ça part pour de bon"
      title="Supprimer ton BeReal ?"
    >
      <div className="confirm-sheet">
        <p className="lede">
          Tu pourras en reprendre un derrière, mais celui-là disparaît du fil et de tes souvenirs.
        </p>
        <button type="button" className="btn btn-danger btn-wide" onClick={onConfirm} disabled={busy}>
          <TrashIcon size={18} />
          {busy ? "Suppression…" : "Oui, supprimer"}
        </button>
        <button type="button" className="btn btn-ghost btn-wide" onClick={onClose} disabled={busy}>
          Non, le garder
        </button>
      </div>
    </Sheet>
  );
}

export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} eyebrow="En clair" title="Confidentialité">
      <div className="prose">
        <p>
          breal. est un prototype, pas une entreprise. Tes photos, tes légendes et tes commentaires
          sont stockés sur le serveur de ce prototype et nulle part ailleurs.
        </p>
        <p>
          La caméra ne s’allume que quand tu ouvres l’écran de prise de vue. Aucune photo n’est
          envoyée avant que tu appuies sur « Publier ».
        </p>
        <p>
          Pas de publicité, pas de tracker, pas de revente de données. Tu peux supprimer ton BeReal
          du jour depuis le menu de ta photo.
        </p>
        <p>
          Les posts des autres membres au démarrage sont des images d’illustration, pour que le fil
          ressemble à quelque chose. Les vrais comptes n’arrivent qu’après toi.
        </p>
        <p className="mono muted">Dernière mise à jour : novembre 2026.</p>
      </div>
    </Sheet>
  );
}
