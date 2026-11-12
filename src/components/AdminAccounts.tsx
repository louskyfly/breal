import { useEffect, useState } from "react";
import type { AdminAccount } from "../lib/types";
import { api, ApiError } from "../lib/api";
import { Avatar } from "./ui";

export default function AdminAccounts({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (message: string, tone?: "plain" | "flash" | "error") => void;
}) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const r = await api.adminAccounts();
      setAccounts(r.accounts);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible de charger les comptes.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.createAccount(name.trim(), handle.trim());
      setAccounts((prev) => [...prev, r.account]);
      setName("");
      setHandle("");
      notify(`Compte créé pour ${r.account.name}`, "flash");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(account: AdminAccount) {
    try {
      const r = await api.resetPin(account.id);
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, pin: r.pin } : a)));
      notify(`Nouveau code pour ${account.name}`, "flash");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Impossible de régénérer", "error");
    }
  }

  async function remove(account: AdminAccount) {
    if (!window.confirm(`Supprimer ${account.name} et tous ses BeReal ?`)) return;
    try {
      await api.deleteAccount(account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      notify("Compte supprimé", "plain");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Suppression impossible", "error");
    }
  }

  async function copyAll() {
    const text = accounts
      .map((a) => `${a.name}\t@${a.username}\t${a.pin}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify("Liste copiée — colle-la où tu veux", "flash");
    } catch {
      notify("Copie impossible sur cet appareil", "error");
    }
  }

  return (
    <div className="admin-page" role="dialog" aria-modal="true" aria-label="Comptes de la classe">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Classe 209 · prof</p>
          <h2 className="admin-title">Comptes &amp; codes</h2>
        </div>
        <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
          Fermer
        </button>
      </header>

      <p className="admin-lede">
        Tous les identifiants de la classe. Chaque élève entre son @ et son code à 4 chiffres.
        Garde cette page pour toi.
      </p>

      <div className="admin-actions">
        <button type="button" className="btn btn-primary btn-small" onClick={copyAll} disabled={!accounts.length}>
          Copier tous les codes
        </button>
        <span className="mono muted">{accounts.length} compte{accounts.length > 1 ? "s" : ""}</span>
      </div>

      <section className="admin-create">
        <input
          className="input"
          placeholder="Prénom de l’élève"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
        />
        <span className="input-wrap">
          <span className="input-prefix">@</span>
          <input
            className="input has-prefix"
            placeholder="auto"
            value={handle}
            maxLength={20}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
          />
        </span>
        <button type="button" className="btn btn-primary" onClick={create} disabled={busy || name.trim().length < 2}>
          {busy ? "…" : "Créer"}
        </button>
      </section>

      {error && <p className="form-error">{error}</p>}

      <div className="admin-list-head" aria-hidden="true">
        <span />
        <span>Élève</span>
        <span>Statut</span>
        <span>Mot de passe</span>
        <span>Actions</span>
      </div>

      <ul className="admin-list">
        {accounts.map((a) => (
          <li key={a.id} className={`admin-row ${a.role === "admin" ? "is-admin" : ""}`}>
            <Avatar user={a} size={40} />
            <div className="admin-who">
              <b>{a.name}</b>
              <span>@{a.username}</span>
            </div>
            <span className="admin-flag">
              {a.role === "admin" ? "prof" : a.posted ? "a posté" : "en attente"}
            </span>
            <span className="admin-pin" title="Code de connexion">{a.pin || "----"}</span>
            <div className="admin-tools">
              <button type="button" className="admin-tool" onClick={() => reset(a)} title="Régénérer le code">
                ↻
              </button>
              {a.role !== "admin" && (
                <button type="button" className="admin-tool is-danger" onClick={() => remove(a)} title="Supprimer">
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
        {!accounts.length && <li className="admin-empty">Aucun compte pour l’instant.</li>}
      </ul>

      <footer className="admin-foot">
        <p>Les codes sont stockés en clair sur ce serveur. Ne partage cette page avec personne.</p>
      </footer>
    </div>
  );
}
