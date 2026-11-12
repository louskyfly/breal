import type { AdminAccount, Bootstrap, Comment, Post, User } from "./types";

const TOKEN_KEY = "breal.token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["content-type"] = "application/json";
  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    res = await fetch(path, { ...options, headers, signal: ctrl.signal });
  } catch (e) {
    throw new ApiError(
      (e as Error).name === "AbortError"
        ? "Le serveur met trop de temps à répondre. Réessaie."
        : "Pas de réseau. Réessaie dans un instant.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new ApiError((data as any).error || "Ça n'a pas marché", res.status);
  }
  return data as T;
}

export const api = {
  setupState() {
    return request<{ needsAdmin: boolean }>("/api/setup");
  },
  setupAdmin(input: { name: string; username: string; pin: string; color: string }) {
    return request<{ token: string; user: User }>("/api/setup", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  login(username: string, pin: string) {
    return request<{ token: string; user: User }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, pin }),
    });
  },
  adminAccounts() {
    return request<{ accounts: AdminAccount[] }>("/api/admin/accounts");
  },
  createAccount(name: string, username: string) {
    return request<{ account: AdminAccount }>("/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify({ name, username }),
    });
  },
  resetPin(id: number) {
    return request<{ id: number; pin: string }>(`/api/admin/accounts/${id}/pin`, { method: "POST" });
  },
  deleteAccount(id: number) {
    return request<{ ok: true }>(`/api/admin/accounts/${id}`, { method: "DELETE" });
  },
  stopSite() {
    return request<{ ok: true }>("/api/admin/stop", { method: "POST" });
  },
  join(name: string, username: string, color: string) {
    return request<{ token: string; user: User }>("/api/join", {
      method: "POST",
      body: JSON.stringify({ name, username, color }),
    });
  },
  bootstrap() {
    return request<Bootstrap>("/api/bootstrap");
  },
  async upload(blob: Blob) {
    const form = new FormData();
    form.append("file", blob, "photo.jpg");
    return request<{ url: string }>("/api/upload", { method: "POST", body: form });
  },
  createPost(input: {
    backUrl: string;
    frontUrl: string;
    caption: string;
    location: string;
    visibility: "friends" | "public";
    retakes: number;
    frontMain: boolean;
  }) {
    return request<{ post: Post }>("/api/posts", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  deletePost(id: number) {
    return request<{ ok: true }>(`/api/posts/${id}`, { method: "DELETE" });
  },
  react(id: number, emoji: string) {
    return request<{ post: Post }>(`/api/posts/${id}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    });
  },
  comment(id: number, text: string) {
    return request<{ comment: Comment }>(`/api/posts/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
  triggerMoment() {
    return request<{ ok: true; momentId: number }>("/api/demo/moment", { method: "POST" });
  },
};
