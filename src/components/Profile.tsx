import { useState } from "react";
import type { Bootstrap, Post } from "../lib/types";
import { dayKeyLocal, fmtTime, lateLabel } from "../lib/format";
import { Avatar } from "./ui";
import {
  BellIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  LinkIcon,
  LogoutIcon,
  TimerIcon,
  TrashIcon,
} from "./Icons";

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

export default function Profile({
  data,
  onOpenCamera,
  onViewPost,
  onTriggerMoment,
  onInvite,
  onLogout,
  onPrivacy,
  onAdmin,
  onCharter,
  onStopSite,
  onDeletePost,
  notify,
}: {
  data: Bootstrap;
  onOpenCamera: () => void;
  onViewPost: (post: Post) => void;
  onTriggerMoment: () => void;
  onInvite: () => void;
  onLogout: () => void;
  onPrivacy: () => void;
  onAdmin: () => void;
  onCharter: () => void;
  onStopSite: () => void;
  onDeletePost: (post: Post) => void;
  notify: (message: string, tone?: "plain" | "flash" | "error") => void;
}) {
  const [notif, setNotif] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [confirmLogout, setConfirmLogout] = useState(false);
  const myToday = data.feed.find((p) => p.user.id === data.me.id) ?? null;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { letter: DAY_LETTERS[d.getDay()], key: dayKeyLocal(d.getTime()), today: i === 6 };
  });
  const myDays = new Set(data.stats.myDays);

  async function askNotifications() {
    if (typeof Notification === "undefined") {
      notify("Ton navigateur ne gère pas les notifications.", "error");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotif(permission);
      if (permission === "granted") {
        new Notification("breal.", { body: "C’est bon. On te préviendra quand ce sera l’heure." });
        notify("Notifications activées.", "flash");
      } else {
        notify("Pas de notifications. Tu peux changer d’avis dans ton navigateur.", "plain");
      }
    } catch {
      notify("Impossible de demander la permission.", "error");
    }
  }

  return (
    <div className="profile-page">
      <header className="mobile-top">
        <span className="page-kicker">Profil</span>
        <button type="button" className="icon-btn" onClick={onPrivacy} aria-label="Confidentialité">
          <span className="mono">?</span>
        </button>
      </header>

      <div className="feed-desktop-head">
        <div>
          <p className="eyebrow">Ton coin</p>
          <h1 className="page-title">Toi.</h1>
        </div>
        <button type="button" className="btn btn-primary btn-small" onClick={onOpenCamera}>
          <CameraIcon size={16} /> Prendre mon BeReal
        </button>
      </div>

      <section className="profile-hero">
        <Avatar user={data.me} size={84} />
        <div className="profile-id">
          <h2 className="profile-name">{data.me.name}</h2>
          <p className="profile-handle">@{data.me.username}</p>
          <p className="profile-note">Membre de la bande. Pas de bio, pas de pose.</p>
        </div>
      </section>

      <section className="profile-stats">
        <div>
          <span className="stat-num">{data.stats.posts}</span>
          <span className="stat-label">BeReals</span>
        </div>
        <div>
          <span className="stat-num">{data.stats.streak}</span>
          <span className="stat-label">jours d’affilée</span>
        </div>
        <div>
          <span className="stat-num">{data.stats.friends}</span>
          <span className="stat-label">potes</span>
        </div>
      </section>

      <section className="week-strip">
        <div className="week-head">
          <span className="eyebrow">Cette semaine</span>
          <span className="mono muted">
            {data.stats.streak > 0 ? `série de ${data.stats.streak} j` : "à toi de lancer la série"}
          </span>
        </div>
        <div className="week-days">
          {days.map((day) => {
            const done = myDays.has(day.key);
            return (
              <div key={day.key} className={`week-day ${done ? "is-done" : ""} ${day.today ? "is-today" : ""}`}>
                <span className="week-letter mono">{day.letter}</span>
                <span className="week-dot">{done && <CheckIcon size={12} />}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="profile-today">
        <div className="profile-today-head">
          <p className="eyebrow">Aujourd’hui</p>
          {myToday ? <span className="mono muted">{fmtTime(myToday.createdAt)}</span> : <span className="mono muted">pas encore</span>}
        </div>
        {myToday ? (
          <div className="profile-today-card">
            <button type="button" className="profile-today-photo" onClick={() => onViewPost(myToday)}>
              <img src={myToday.backUrl} alt="" />
              <img src={myToday.frontUrl} alt="" className="profile-today-pip" />
            </button>
            <div className="profile-today-copy">
              <p className="profile-today-caption">{myToday.caption || "Sans légende."}</p>
              <p className="mono muted">
                {lateLabel(myToday.lateSeconds)}
                {myToday.retakes > 0 ? ` · ${myToday.retakes} reprise${myToday.retakes > 1 ? "s" : ""}` : ""}
              </p>
              <div className="profile-today-actions">
                <button type="button" className="text-link" onClick={() => onViewPost(myToday)}>
                  Voir en grand
                </button>
                <button type="button" className="text-link is-danger" onClick={() => onDeletePost(myToday)}>
                  <TrashIcon size={13} /> Supprimer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="profile-missing">
            <div>
              <p className="profile-missing-title">Il te manque celui d’aujourd’hui.</p>
              <p className="profile-missing-sub">Deux minutes, pas plus. Après, c’est en retard.</p>
            </div>
            <button type="button" className="btn btn-primary btn-small" onClick={onOpenCamera}>
              Y aller
            </button>
          </div>
        )}
      </section>

      <section className="settings">
        <div className="settings-head">
          <span className="eyebrow">Réglages</span>
          <span className="mono muted">le strict nécessaire</span>
        </div>

        <button type="button" className="setting-row" onClick={askNotifications}>
          <span className="setting-icon"><BellIcon size={18} /></span>
          <span className="setting-copy">
            <span className="setting-title">Notifications</span>
            <span className="setting-sub">
              {notif === "granted"
                ? "Activées. On te prévient à l’improviste."
                : notif === "denied"
                  ? "Bloquées dans ton navigateur. On ne peut rien y faire."
                  : "Pour ne pas rater le moment."}
            </span>
          </span>
          <span className={`setting-state ${notif === "granted" ? "is-on" : ""}`}>
            {notif === "granted" ? "Activées" : notif === "denied" ? "Bloquées" : "Activer"}
          </span>
        </button>

        {data.me.role === "admin" && (
          <button type="button" className="setting-row" onClick={onAdmin}>
            <span className="setting-icon"><span className="mono">#</span></span>
            <span className="setting-copy">
              <span className="setting-title">Comptes &amp; codes de la classe</span>
              <span className="setting-sub">Tous les @ et les codes à 4 chiffres.</span>
            </span>
            <ChevronLeftIcon size={16} className="setting-chevron" />
          </button>
        )}

        <button type="button" className="setting-row" onClick={onInvite}>
          <span className="setting-icon"><LinkIcon size={18} /></span>
          <span className="setting-copy">
            <span className="setting-title">Inviter un pote</span>
            <span className="setting-sub">Un BeReal seul, c’est juste une photo.</span>
          </span>
          <span className="setting-state">Copier</span>
        </button>

        <button type="button" className="setting-row" onClick={onPrivacy}>
          <span className="setting-icon"><span className="mono">?</span></span>
          <span className="setting-copy">
            <span className="setting-title">Confidentialité</span>
            <span className="setting-sub">Où vont tes photos, en clair.</span>
          </span>
          <ChevronLeftIcon size={16} className="setting-chevron" />
        </button>

        <button type="button" className="setting-row" onClick={onCharter}>
          <span className="setting-icon"><span className="mono">§</span></span>
          <span className="setting-copy">
            <span className="setting-title">Charte d’utilisation</span>
            <span className="setting-sub">Droit à l’image, respect, données.</span>
          </span>
          <ChevronLeftIcon size={16} className="setting-chevron" />
        </button>

        <button type="button" className="setting-row setting-demo" onClick={onTriggerMoment}>
          <span className="setting-icon"><TimerIcon size={18} /></span>
          <span className="setting-copy">
            <span className="setting-title">Mode démo — relancer le moment</span>
            <span className="setting-sub">Pour montrer le vrai « c’est l’heure » à tout le monde.</span>
          </span>
          <span className="setting-state is-flash">Go</span>
        </button>

        <div className="settings-head settings-head-spaced">
          <span className="eyebrow">Le compte</span>
        </div>

        {data.me.role === "admin" && (
          <button type="button" className="setting-row setting-danger" onClick={onStopSite}>
            <span className="setting-icon"><span className="mono">■</span></span>
            <span className="setting-copy">
              <span className="setting-title">Arrêter totalement le site</span>
              <span className="setting-sub">Toutes les pages afficheront « Cette page n’existe pas ».</span>
            </span>
            <span className="setting-state is-danger">Stop</span>
          </button>
        )}

        {!confirmLogout ? (
          <button type="button" className="setting-row" onClick={() => setConfirmLogout(true)}>
            <span className="setting-icon"><LogoutIcon size={18} /></span>
            <span className="setting-copy">
              <span className="setting-title">Se déconnecter</span>
              <span className="setting-sub">Ton compte reste, ton téléphone t’oublie.</span>
            </span>
            <ChevronLeftIcon size={16} className="setting-chevron" />
          </button>
        ) : (
          <div className="logout-confirm">
            <p>Se déconnecter de breal. ?</p>
            <div className="logout-actions">
              <button type="button" className="btn btn-danger btn-small" onClick={onLogout}>Oui</button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirmLogout(false)}>Non</button>
            </div>
          </div>
        )}
      </section>

      <footer className="profile-foot">
        <p className="wordmark foot-mark">breal<span className="wordmark-dot">.</span></p>
        <p>Fait à la main. Pas d’algorithme, pas de filtre, pas de pub.</p>
        <p className="mono">Version 1.1 — codes, charte, arrêt · novembre 2026</p>
      </footer>
    </div>
  );
}
