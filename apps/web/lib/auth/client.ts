import type { SessionUser } from "./session";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function post<T>(path: string, data?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? "INTERNAL_ERROR", e?.message ?? "Something went wrong.", e?.fields);
  }
  return body as T;
}

/** Browser-side calls to the auth endpoints. The session lives in an HttpOnly cookie managed by the server. */
export const authApi = {
  login: (email: string, password: string) =>
    post<{ user: SessionUser }>("/api/auth/login", { email, password }).then((r) => r.user),
  register: (name: string, email: string, password: string) =>
    post<{ user: SessionUser }>("/api/auth/register", { name, email, password }).then((r) => r.user),
  logout: () => post<{ ok: true }>("/api/auth/logout").then(() => undefined),
};
