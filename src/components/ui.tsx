import { useEffect, useState, type ReactNode } from "react";import { createPortal } from "react-dom";
import type { User } from "../lib/types";
import { initials, isLight, lateLabel } from "../lib/format";
import { SwapIcon, XIcon } from "./Icons";

export const EMOJIS = ["😂", "😍", "🔥", "😮", "💀", "🫶", "👀", "😭"];

export function Avatar({
  user,
  size = 40,
  className = "",
  title,
}: {
  user: Pick<User, "name" | "color">;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`avatar ${className}`}
      title={title ?? user.name}
      style={{
        width: size,
        height: size,
        background: user.color,
        color: isLight(user.color) ? "#0a0a09" : "#ffffff",
        fontSize: Math.max(9, size * 0.33),
      }}
    >
      {initials(user.name)}
    </span>
  );
}

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`wordmark ${small ? "is-small" : ""}`} aria-label="breal">
      breal<span className="wordmark-dot">.</span>
    </span>
  );
}

export function LateBadge({ seconds, compact = false }: { seconds: number; compact?: boolean }) {
  const late = seconds > 120;
  return (
    <span className={`late-badge ${late ? "is-late" : "is-ontime"}`}>
      {late ? (compact ? `+${Math.floor(seconds / 60)} min` : lateLabel(seconds)) : "à l’heure"}
    </span>
  );
}

export function Duo({
  backUrl,
  frontUrl,
  frontMain = false,
  onOpen,
  ratio = "3 / 4",
  className = "",
  alt = "BeReal",
}: {
  backUrl: string;
  frontUrl: string;
  frontMain?: boolean;
  onOpen?: () => void;
  ratio?: string;
  className?: string;
  alt?: string;
}) {
  const [flipped, setFlipped] = useState(frontMain);
  useEffect(() => setFlipped(frontMain), [backUrl, frontUrl, frontMain]);
  const main = flipped ? frontUrl : backUrl;
  const pip = flipped ? backUrl : frontUrl;

  return (
    <div className={`duo ${className}`} style={{ aspectRatio: ratio }}>
      {onOpen ? (
        <button type="button" className="duo-main-btn" onClick={onOpen} aria-label="Voir le BeReal en grand">
          <img className="duo-main" src={main} alt={alt} loading="lazy" decoding="async" />
        </button>
      ) : (
        <img className="duo-main" src={main} alt={alt} loading="lazy" decoding="async" />
      )}
      <button
        type="button"
        className="duo-pip"
        onClick={() => setFlipped((f) => !f)}
        aria-label="Inverser la photo du selfie et la photo du décor"
      >
        <img src={pip} alt="" loading="lazy" decoding="async" />
        <span className="duo-swap">
          <SwapIcon size={11} />
        </span>
      </button>
    </div>
  );
}

export function useLockBody(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useLockBody(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grab" aria-hidden="true" />
        {(title || eyebrow) && (
          <header className="sheet-head">
            <div>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              {title && <h2 className="sheet-title">{title}</h2>}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
              <XIcon size={20} />
            </button>
          </header>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Toast({ message, tone = "plain" }: { message: string; tone?: "plain" | "flash" | "error" }) {
  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
