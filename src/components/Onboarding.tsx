import { useEffect, useRef, useState } from "react";
import { api, ApiError, setToken } from "../lib/api";
import { slugify } from "../lib/format";
import { Duo, Wordmark } from "./ui";
import { CheckIcon } from "./Icons";
import type { User } from "../lib/types";

const COLORS = ["#E9FF3F", "#FF6B4A", "#7C9EFF", "#FF9ED2", "#B7F0C2", "#C9B6FF", "#FFC857", "#FF5A4E"];

type Mode = "loading" | "setup" | "login";

export default function Onboarding({ onJoined }: { onJoined: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);
  const [pin, setPin] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .setupState()
      .then((r) => alive && setMode(r.needsAdmin ? "setup" : "login"))
      .catch(() => alive && setMode("login"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (mode === "setup") nameRef.current?.focus();
    if (mode === "login") handleRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (!touched) setUsername(slugify(name));
  }, [name, touched]);

  const canSubmit =
    mode === "setup"
      ? name.trim().length >= 2 && username.length >= 3 && /^\d{4}$/.test(pin)
      : username.length >= 3 && /^\d{4}$/.test(pin);

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError("");
    try {
      const res =
        mode === "setup"
          ? await api.setupAdmin({ name: name.trim(), username, pin, color })
          : await api.login(username, pin);
      setToken(res.token);
      onJoined(res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ça n’a pas marché. Réessaie.");
      setBusy(false);
    }
  }

  function onPin(value: string) {
    setPin(value.replace(/\D/g, "").slice(0, 4));
  }

  if (mode === "loading") {
    return (
      <div className="onboarding onboarding-loading">
        <div className="onboarding-main">
          <Wordmark />
          <p className="mono muted">On prépare la classe…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <div className="onboarding-main">
        <header className="onboarding-top">
          <Wordmark small />
          <span className="mono-step">CLASSE 209</span>
        </header>

        <div className="onboarding-copy">
          {mode === "setup" ? (
            <>
              <p className="eyebrow">Première installation</p>
              <h1 className="display">
                Le compte
                <br />
                prof.
              </h1>
              <p className="lede">
                C’est toi qui ouvres la classe. Ensuite, tu crées un compte par élève et tu gardes
                tous les codes sous la main.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">Un BeReal par jour. Deux minutes.</p>
              <h1 className="display">
                Entre dans
                <br />
                le fil.
              </h1>
              <p className="lede">
                Ton @ et ton code à 4 chiffres. C’est le prof qui crée les comptes et qui les
                distribue.
              </p>
            </>
          )}
        </div>

        <div className="onboarding-form">
          <div className="field-stack">
            {mode === "setup" && (
              <>
                <label className="field">
                  <span className="field-label">Prénom ou blaze</span>
                  <input
                    ref={nameRef}
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mme Martin"
                    maxLength={30}
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Ton @ (celui du prof)</span>
                  <span className="input-wrap">
                    <span className="input-prefix">@</span>
                    <input
                      className="input has-prefix"
                      value={username}
                      onChange={(e) => {
                        setTouched(true);
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20));
                      }}
                      placeholder="prof.martin"
                      maxLength={20}
                      autoCapitalize="none"
                      autoComplete="username"
                    />
                  </span>
                </label>
              </>
            )}

            {mode === "login" && (
              <label className="field">
                <span className="field-label">Ton @</span>
                <span className="input-wrap">
                  <span className="input-prefix">@</span>
                  <input
                    ref={handleRef}
                    className="input has-prefix"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20))
                    }
                    placeholder="lea.fnt"
                    maxLength={20}
                    autoCapitalize="none"
                    autoComplete="username"
                  />
                </span>
              </label>
            )}

            <label className="field">
              <span className="field-label">Code à 4 chiffres</span>
              <input
                className="input pin-input"
                value={pin}
                onChange={(e) => onPin(e.target.value)}
                placeholder="••••"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) submit();
                }}
              />
            </label>

            {mode === "setup" && (
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
            )}

            {error && <p className="form-error">{error}</p>}

            <button
              type="button"
              className="btn btn-primary btn-wide"
              onClick={submit}
              disabled={!canSubmit || busy}
            >
              {busy
                ? "Un instant…"
                : mode === "setup"
                  ? "Créer le compte prof"
                  : "Entrer"}
            </button>

            <p className="fineprint">
              {mode === "setup"
                ? "Ce compte pourra voir et régénérer le code de chaque élève."
                : "Pas de mot de passe : un @ et 4 chiffres, donnés par le prof."}
            </p>
          </div>
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
              <p className="aside-name">Ton premier BeRail</p>
              <p className="aside-meta">un seul post par jour · 2 minutes</p>
            </div>
            <span className="late-badge is-late">2 min de retard</span>
          </div>
        </div>
        <p className="aside-quote">« Le seul réseau où t’as rien à préparer. »</p>
        <p className="aside-foot">breal. — 1 photo. 0 filtre. 2 minutes.</p>
      </aside>
    </div>
  );
}
