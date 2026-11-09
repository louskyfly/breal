import { useEffect, useRef, useState } from "react";
import { api, ApiError, setToken } from "../lib/api";
import { slugify } from "../lib/format";
import { Duo, Wordmark } from "./ui";
import { CheckIcon, ChevronLeftIcon } from "./Icons";
import type { User } from "../lib/types";

const COLORS = ["#E9FF3F", "#FF6B4A", "#7C9EFF", "#FF9ED2", "#B7F0C2", "#C9B6FF", "#FFC857", "#FF5A4E"];

export default function Onboarding({ onJoined }: { onJoined: (user: User) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!touched) setUsername(slugify(name));
  }, [name, touched]);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canNext = name.trim().length >= 2 && username.length >= 3;

  async function join() {
    if (!canNext || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.join(name.trim(), username, color);
      setToken(res.token);
      onJoined(res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ça n’a pas marché. Réessaie.");
      setBusy(false);
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-main">
        <header className="onboarding-top">
          <Wordmark small />
          <span className="mono-step">0{step + 1} / 02</span>
        </header>

        <div className="onboarding-copy">
          {step === 0 ? (
            <>
              <p className="eyebrow">Un BeReal par jour. Deux minutes.</p>
              <h1 className="display">
                La vraie vie,
                <br />
                en retard.
              </h1>
              <p className="lede">
                Pas de filtre, pas de mise en scène. Tu prends ton téléphone, tu montres ce que tu
                as devant toi, et c’est tout.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">Dernière étape</p>
              <h1 className="display">
                Choisis ta
                <br />
                couleur.
              </h1>
              <p className="lede">Un point de couleur, et on te repère dans le fil.</p>
            </>
          )}
        </div>

        <div className="onboarding-form">
          {step === 0 ? (
            <div className="field-stack">
              <label className="field">
                <span className="field-label">Prénom ou blaze</span>
                <input
                  ref={nameRef}
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Emilio"
                  maxLength={30}
                  autoComplete="given-name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canNext) setStep(1);
                  }}
                />
              </label>
              <label className="field">
                <span className="field-label">Ton @</span>
                <span className="input-wrap">
                  <span className="input-prefix">@</span>
                  <input
                    className="input has-prefix"
                    value={username}
                    onChange={(e) => {
                      setTouched(true);
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20));
                    }}
                    placeholder="emilio"
                    maxLength={20}
                    autoCapitalize="none"
                    autoComplete="username"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canNext) setStep(1);
                    }}
                  />
                </span>
              </label>
              {error && <p className="form-error">{error}</p>}
              <button
                type="button"
                className="btn btn-primary btn-wide"
                disabled={!canNext}
                onClick={() => setStep(1)}
              >
                Continuer
              </button>
              <p className="fineprint">Pas de mot de passe. C’est un prototype entre potes.</p>
            </div>
          ) : (
            <div className="field-stack">
              <div className="identity-preview">
                <span
                  className="avatar avatar-xl"
                  style={{ background: color, color: color === "#E9FF3F" || color === "#B7F0C2" || color === "#FFC857" || color === "#C9B6FF" ? "#0a0a09" : "#fff" }}
                >
                  {(name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?")}
                </span>
                <div>
                  <p className="identity-name">{name.trim() || "Ton nom"}</p>
                  <p className="identity-handle">@{username || "tonpseudo"}</p>
                </div>
              </div>
              <div className="field">
                <span className="field-label">Ta couleur</span>
                <div className="swatches">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`swatch ${c === color ? "is-active" : ""}`}
                      style={{ background: c }}
                      aria-label={`Couleur ${c}`}
                      aria-pressed={c === color}
                      onClick={() => setColor(c)}
                    >
                      {c === color && <CheckIcon size={16} />}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="button" className="btn btn-primary btn-wide" onClick={join} disabled={busy}>
                {busy ? "On t’installe…" : "C’est parti"}
              </button>
              <button type="button" className="btn btn-ghost btn-wide" onClick={() => setStep(0)} disabled={busy}>
                <ChevronLeftIcon size={16} /> Retour
              </button>
              <p className="fineprint">En continuant, tu acceptes de ne pas nous la jouer influence.</p>
            </div>
          )}
        </div>

        <footer className="onboarding-foot">
          <p className="eyebrow">Le règlement</p>
          <div className="onboarding-rules">
            <p><span>01</span> Un BeReal par jour.</p>
            <p><span>02</span> Deux minutes pour le prendre.</p>
            <p><span>03</span> Ni filtre, ni mise en scène.</p>
          </div>
        </footer>
      </div>

      <aside className="onboarding-aside" aria-hidden="true">
        <div className="aside-photo">
          <Duo
            backUrl="/seed/back-friends.jpg"
            frontUrl="/seed/front-1.jpg"
            ratio="4 / 5"
            alt="Un BeReal d’exemple"
          />
          <div className="aside-caption">
            <div>
              <p className="aside-name">Léa Fontaine</p>
              <p className="aside-meta">@lea.fnt · 18:42 · Paris 20e</p>
            </div>
            <span className="late-badge is-late">2 min de retard</span>
          </div>
        </div>
        <p className="aside-quote">
          « Le seul réseau où t’as rien à préparer. »
        </p>
        <p className="aside-foot">breal. — 1 photo. 0 filtre. 2 minutes.</p>
      </aside>
    </div>
  );
}
