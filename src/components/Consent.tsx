import { useState } from "react";
import { Wordmark } from "./ui";

const RULES: { t: string; d: string }[] = [
  {
    t: "Respect des personnes",
    d: "Aucune photo d’une personne sans son accord. Pas de photo prise en douce, pas de capture d’écran d’un BeReal, pas de photo humiliante.",
  },
  {
    t: "Droit à l’image",
    d: "Toute personne qui apparaît sur une photo peut demander son retrait. Le prof la supprime immédiatement, sans discuter.",
  },
  {
    t: "Contenus interdits",
    d: "Pas d’insulte, de harcèlement, de moquerie, ni de contenu violent, sexuel ou illégal. On ne publie pas la vie privée de quelqu’un d’autre.",
  },
  {
    t: "Un BeReal par jour",
    d: "Deux photos, dans les deux minutes du moment. Pas de mise en scène, pas de filtre, pas de triche.",
  },
  {
    t: "Tes données",
    d: "Les photos et les comptes restent sur le serveur de la classe. Elles sont visibles par les élèves de la classe et par le prof — pas par Internet.",
  },
  {
    t: "Ton code",
    d: "Ton @ et ton code à 4 chiffres sont personnels. Ne les prête pas : tout ce qui est publié avec ton compte est de ta responsabilité.",
  },
  {
    t: "Sanction",
    d: "Tout manquement entraîne le retrait de la photo et l’exclusion de la classe. Le prof peut prévenir la vie scolaire.",
  },
];

function CharterBody() {
  return (
    <ol className="charter-list">
      {RULES.map((r, i) => (
        <li key={r.t}>
          <span className="charter-num">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <b>{r.t}</b>
            <p>{r.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function Consent({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  const [notif, setNotif] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");

  const supported = typeof Notification !== "undefined";

  async function askNotifications() {
    if (!supported) {
      setNotif("unsupported");
      return;
    }
    try {
      const res = await Notification.requestPermission();
      setNotif(res === "granted" ? "granted" : "denied");
    } catch {
      setNotif("denied");
    }
  }

  async function accept() {
    if (!checked) return;
    if (supported && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* refusé : on continue */
      }
    }
    try {
      localStorage.setItem("breal.consent", "2026-11");
    } catch {
      /* mode privé */
    }
    onAccept();
  }

  return (
    <div className="consent" role="dialog" aria-modal="true" aria-label="Charte et conditions d’utilisation">
      <div className="consent-inner">
        <header className="consent-head">
          <Wordmark small />
          <span className="mono-step">CLASSE 209</span>
        </header>

        <p className="eyebrow">Charte d’utilisation</p>
        <h1 className="display consent-title">
          Avant
          <br />
          d’entrer.
        </h1>
        <p className="lede">
          Ce BeReal est celui de la classe 209. Quelques règles, et on ouvre le fil.
        </p>

        <div className="consent-scroll">
          <CharterBody />
          <div className="consent-notif">
            <b>Notifications</b>
            <p>
              Autorise les notifications pour être prévenu quand le moment démarre.
              {supported
                ? " Tu peux aussi le faire plus tard depuis ton profil."
                : " Sur iPad, ajoute l’application à l’écran d’accueil pour recevoir les alertes."}
            </p>
            <button type="button" className="btn btn-ghost btn-small" onClick={askNotifications}>
              {notif === "granted"
                ? "Notifications activées ✓"
                : notif === "denied"
                  ? "Refusées — réglages Safari"
                  : notif === "unsupported"
                    ? "Non disponible sur cet appareil"
                    : "Activer les notifications"}
            </button>
          </div>
        </div>

        <label className="consent-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>
            J’accepte la charte d’utilisation et le <b>respect du droit à l’image</b> de chacun.
          </span>
        </label>

        <button type="button" className="btn btn-primary btn-wide" onClick={accept} disabled={!checked}>
          J’accepte et j’entre
        </button>
      </div>
    </div>
  );
}

export function CharterSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="consent" role="dialog" aria-modal="true" aria-label="Charte d’utilisation">
      <div className="consent-inner">
        <header className="consent-head">
          <Wordmark small />
          <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
            Fermer
          </button>
        </header>
        <p className="eyebrow">Classe 209</p>
        <h1 className="display consent-title">La charte.</h1>
        <div className="consent-scroll">
          <CharterBody />
        </div>
      </div>
    </div>
  );
}
