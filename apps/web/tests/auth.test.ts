import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "@/lib/auth/config";
import { createSession, hashToken } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/prisma/db";

// `connection()` only works inside a Next.js request scope; route handlers are invoked directly here.
vi.mock("next/server", () => ({ connection: async () => {} }));

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const createdEmails = new Set<string>();

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function get(path: string, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, { headers });
}

const uniqueEmail = () => `authtest-${randomUUID()}@example.com`;

async function makeUser(overrides: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const email = uniqueEmail();
  createdEmails.add(email);
  const res = await register(
    post("/api/auth/register", { name: "Test User", email, password: PASSWORD, ...overrides }, headers),
  );
  return { email, res };
}

function cookieValue(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  return header.split(";")[0].slice(SESSION_COOKIE_NAME.length + 1);
}

async function webLogin(email: string, headers: Record<string, string> = {}) {
  return login(post("/api/auth/login", { email, password: PASSWORD }, headers));
}

async function mobileLogin(email: string) {
  return login(post("/api/auth/login", { email, password: PASSWORD }, { "x-client-type": "mobile" }));
}

afterAll(async () => {
  // Sessions are removed by ON DELETE CASCADE.
  for (const email of createdEmails) await db.orm.public.User.where({ email }).deleteAll();
  await db.close();
});

describe("register", () => {
  it("creates a user and never returns the password or its hash", async () => {
    const { email, res } = await makeUser({ name: "  Ada   Lovelace " });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toEqual({ id: expect.any(Number), name: "Ada Lovelace", email });
    expect(JSON.stringify(body)).not.toMatch(/password|scrypt/i);

    const row = await db.orm.public.User.where({ email }).first();
    expect(row?.password).toMatch(/^scrypt\$/);
    expect(row?.password).not.toContain(PASSWORD);
  });

  it("signs the user in: web gets an HttpOnly session cookie that authenticates /me", async () => {
    const { email, res } = await makeUser();
    expect(await res.clone().json()).not.toHaveProperty("token");
    const header = res.headers.get("set-cookie")!;
    expect(header).toMatch(/HttpOnly/i);
    const meRes = await me(get("/api/auth/me", { cookie: `${SESSION_COOKIE_NAME}=${cookieValue(res)}` }));
    expect(meRes.status).toBe(200);
    expect((await meRes.json()).user.email).toBe(email);
  });

  it("signs the user in: mobile gets the raw token once and no cookie", async () => {
    const { res } = await makeUser({}, { "x-client-type": "mobile" });
    const body = await res.json();
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("normalizes email case and whitespace", async () => {
    const email = uniqueEmail();
    createdEmails.add(email);
    const res = await register(post("/api/auth/register", { name: "N", email: `  ${email.toUpperCase()} `, password: PASSWORD }));
    expect(res.status).toBe(201);
    expect((await res.json()).user.email).toBe(email);
  });

  it("rejects a duplicate email (case-insensitively) with 409", async () => {
    const { email } = await makeUser();
    const res = await register(post("/api/auth/register", { name: "Other", email: email.toUpperCase(), password: PASSWORD }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
  });

  it("handles concurrent duplicate registrations without a 500", async () => {
    const email = uniqueEmail();
    createdEmails.add(email);
    const attempts = await Promise.all(
      [1, 2, 3].map(() => register(post("/api/auth/register", { name: "Race", email, password: PASSWORD }))),
    );
    expect(attempts.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });

  it.each([
    ["missing name", { email: "a@example.com", password: PASSWORD }, "name"],
    ["blank name", { name: "   ", email: "a@example.com", password: PASSWORD }, "name"],
    ["invalid email", { name: "A", email: "not-an-email", password: PASSWORD }, "email"],
    ["short password", { name: "A", email: "a@example.com", password: "short" }, "password"],
    ["overlong password", { name: "A", email: "a@example.com", password: "x".repeat(129) }, "password"],
    ["non-string fields", { name: 1, email: {}, password: [] }, "email"],
  ])("rejects %s with 400", async (_label, body, field) => {
    const res = await register(post("/api/auth/register", body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.fields).toHaveProperty(field);
  });

  it("rejects malformed JSON, non-object bodies and wrong content type", async () => {
    expect((await register(post("/api/auth/register", "{nope"))).status).toBe(400);
    expect((await register(post("/api/auth/register", "[]"))).status).toBe(400);
    expect((await register(post("/api/auth/register", "x", { "content-type": "text/plain" }))).status).toBe(415);
  });

  it("ignores unknown fields (mass assignment)", async () => {
    const { email, res } = await makeUser({ id: 999999, createdAt: "2000-01-01", isAdmin: true });
    expect(res.status).toBe(201);
    const row = await db.orm.public.User.where({ email }).first();
    expect(row?.id).not.toBe(999999);
  });

  it("rejects cross-origin browser requests", async () => {
    const res = await register(post("/api/auth/register", { name: "A", email: uniqueEmail(), password: PASSWORD }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });
});

describe("login", () => {
  it("succeeds for web: sets a hardened HttpOnly cookie and no token in the body", async () => {
    const { email } = await makeUser();
    const res = await webLogin(email.toUpperCase());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(email);
    expect(body).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toMatch(/password|scrypt|tokenHash/i);

    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=[A-Za-z0-9_-]{43};`));
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("succeeds for mobile: returns the raw token once and sets no cookie", async () => {
    const { email } = await makeUser();
    const res = await mobileLogin(email);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + SESSION_TTL_MS - 60_000);
  });

  it("stores only the token hash", async () => {
    const { email } = await makeUser();
    const { token } = await (await mobileLogin(email)).json();
    expect(await db.orm.public.Session.where({ tokenHash: token }).first()).toBeNull();
    const stored = await db.orm.public.Session.where({ tokenHash: hashToken(token) }).first();
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns an identical generic error for a wrong password and an unknown account", async () => {
    const { email } = await makeUser();
    const wrong = await login(post("/api/auth/login", { email, password: "wrong password!" }));
    const missing = await login(post("/api/auth/login", { email: uniqueEmail(), password: PASSWORD }));
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(await wrong.json()).toEqual(await missing.json());
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });

  it("validates input", async () => {
    expect((await login(post("/api/auth/login", {}))).status).toBe(400);
    expect((await login(post("/api/auth/login", "{bad"))).status).toBe(400);
  });

  it("prevents session fixation: always issues a new token and revokes the one presented", async () => {
    const { email } = await makeUser();
    const first = cookieValue(await webLogin(email));

    // Attacker-chosen or pre-existing token presented at login time.
    const second = await webLogin(email, { cookie: `${SESSION_COOKIE_NAME}=${first}` });
    const secondToken = cookieValue(second);
    expect(secondToken).not.toBe(first);

    expect((await me(get("/api/auth/me", { cookie: `${SESSION_COOKIE_NAME}=${first}` }))).status).toBe(401);
    expect((await me(get("/api/auth/me", { cookie: `${SESSION_COOKIE_NAME}=${secondToken}` }))).status).toBe(200);

    // A client-supplied token value can never be adopted as the new session.
    const chosen = "attacker-chosen-token-value-0123456789abcdef";
    const third = cookieValue(await webLogin(email, { cookie: `${SESSION_COOKIE_NAME}=${chosen}` }));
    expect(third).not.toBe(chosen);
  });
});

describe("current user", () => {
  it("rejects requests without credentials, with garbage, or with a malformed header", async () => {
    expect((await me(get("/api/auth/me"))).status).toBe(401);
    expect((await me(get("/api/auth/me", { authorization: "Bearer nope" }))).status).toBe(401);
    expect((await me(get("/api/auth/me", { authorization: "Basic abc" }))).status).toBe(401);
    expect((await me(get("/api/auth/me", { cookie: `${SESSION_COOKIE_NAME}=nope` }))).status).toBe(401);
    const res = await me(get("/api/auth/me"));
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns only id, name and email for a cookie session", async () => {
    const { email } = await makeUser();
    const token = cookieValue(await webLogin(email));
    const res = await me(get("/api/auth/me", { cookie: `${SESSION_COOKIE_NAME}=${token}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["user"]);
    expect(Object.keys(body.user).sort()).toEqual(["email", "id", "name"]);
    expect(JSON.stringify(body)).not.toMatch(/password|scrypt|tokenHash|expiresAt/i);
  });

  it("authenticates a mobile bearer token", async () => {
    const { email } = await makeUser();
    const { token } = await (await mobileLogin(email)).json();
    const res = await me(get("/api/auth/me", { authorization: `Bearer ${token}` }));
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe(email);
  });

  it("rejects an expired session and removes it", async () => {
    const { email } = await makeUser();
    const user = (await db.orm.public.User.where({ email }).first())!;
    const longAgo = new Date(Date.now() - SESSION_TTL_MS - 60_000);
    const { token } = await createSession(user.id, longAgo);

    const res = await me(get("/api/auth/me", { authorization: `Bearer ${token}` }));
    expect(res.status).toBe(401);
    expect(await db.orm.public.Session.where({ tokenHash: hashToken(token) }).first()).toBeNull();
  });
});

describe("logout", () => {
  it("revokes a web session server-side and clears the cookie", async () => {
    const { email } = await makeUser();
    const token = cookieValue(await webLogin(email));
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;

    const res = await logout(post("/api/auth/logout", {}, { cookie }));
    expect(res.status).toBe(200);
    const cleared = res.headers.get("set-cookie")!;
    expect(cleared).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`));
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("HttpOnly");

    expect(await db.orm.public.Session.where({ tokenHash: hashToken(token) }).first()).toBeNull();
    // Replaying the old cookie after logout fails.
    expect((await me(get("/api/auth/me", { cookie }))).status).toBe(401);
  });

  it("revokes a mobile token so it cannot be reused", async () => {
    const { email } = await makeUser();
    const { token } = await (await mobileLogin(email)).json();
    const auth = { authorization: `Bearer ${token}` };
    expect((await me(get("/api/auth/me", auth))).status).toBe(200);

    expect((await logout(post("/api/auth/logout", {}, auth))).status).toBe(200);
    expect((await me(get("/api/auth/me", auth))).status).toBe(401);
  });

  it("only revokes the presented session, leaving the user's other sessions valid", async () => {
    const { email } = await makeUser();
    const a = (await (await mobileLogin(email)).json()).token;
    const b = (await (await mobileLogin(email)).json()).token;
    await logout(post("/api/auth/logout", {}, { authorization: `Bearer ${a}` }));
    expect((await me(get("/api/auth/me", { authorization: `Bearer ${b}` }))).status).toBe(200);
  });

  it("is idempotent when unauthenticated", async () => {
    const res = await logout(post("/api/auth/logout", {}));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("password hashing", () => {
  it("verifies correct passwords, rejects wrong ones, and salts each hash", async () => {
    const a = await hashPassword("hunter2hunter2");
    const b = await hashPassword("hunter2hunter2");
    expect(a).not.toBe(b);
    expect(await verifyPassword("hunter2hunter2", a)).toBe(true);
    expect(await verifyPassword("hunter3hunter3", a)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});
