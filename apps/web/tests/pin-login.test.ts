import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { POST as pinLogin } from "@/app/api/auth/pin-login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password";
import { PIN_LOCK_MS, PIN_MAX_ATTEMPTS, clearPinLockout, loginWithPin, setStudentCredentials } from "@/lib/auth/pin";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const ORIGIN = "http://localhost:3000";
const PIN = "4821";
const WRONG = "1357";
const emails: string[] = [];
let n = 0;
// Distinct per-test "client IP" so the in-memory per-IP limiter never interferes with the DB lockout under test.
const ip = () => `10.1.${Math.floor(n / 250)}.${n++ % 250}`;

const uname = () => `t${randomUUID().replace(/-/g, "").slice(0, 12)}`;

async function makeStudent(pin: string | null = PIN) {
  const email = `pin-${randomUUID()}@example.com`;
  emails.push(email);
  const user = await db.orm.public.User.create({ name: "Pin Kid", email, password: "x", role: "STUDENT" });
  const username = uname();
  if (pin) await setStudentCredentials(user.id, username, pin);
  return { id: user.id, username, email };
}

const attempt = (body: unknown, headers: Record<string, string> = {}) =>
  pinLogin(
    new Request(`${ORIGIN}/api/auth/pin-login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip(), ...headers },
      body: JSON.stringify(body),
    }),
  );

const row = (id: number) => db.orm.public.User.where({ id }).first();

afterAll(async () => {
  for (const email of emails) await db.orm.public.User.where({ email }).deleteAll();
  await db.close();
});

describe("username + PIN login", () => {
  it("signs a student in: cookie for web, token in the body for mobile", async () => {
    const s = await makeStudent();
    const web = await attempt({ username: s.username, pin: PIN });
    expect(web.status).toBe(200);
    const body = await web.json();
    expect(body.user).toEqual({ id: s.id, name: "Pin Kid", email: s.email, role: "STUDENT" });
    expect(body).not.toHaveProperty("token");
    const cookie = web.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/i);
    const token = cookie.split(";")[0].slice(SESSION_COOKIE_NAME.length + 1);
    const meRes = await me(new Request(`${ORIGIN}/api/auth/me`, { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }));
    expect(meRes.status).toBe(200);

    const mobile = await attempt({ username: s.username, pin: PIN }, { "x-client-type": "mobile" });
    expect(mobile.status).toBe(200);
    const mobileBody = await mobile.json();
    expect(mobileBody.token).toEqual(expect.any(String));
    expect(mobile.headers.get("set-cookie")).toBeNull();
    const meMobile = await me(new Request(`${ORIGIN}/api/auth/me`, { headers: { authorization: `Bearer ${mobileBody.token}` } }));
    expect(meMobile.status).toBe(200);
  });

  it("matches the username case-insensitively and ignores surrounding spaces", async () => {
    const s = await makeStudent();
    expect((await attempt({ username: `  ${s.username.toUpperCase()} `, pin: PIN })).status).toBe(200);
  });

  it("revokes the session token the client sent along", async () => {
    const s = await makeStudent();
    const first = await (await attempt({ username: s.username, pin: PIN }, { "x-client-type": "mobile" })).json();
    await attempt({ username: s.username, pin: PIN }, { authorization: `Bearer ${first.token}`, "x-client-type": "mobile" });
    const old = await me(new Request(`${ORIGIN}/api/auth/me`, { headers: { authorization: `Bearer ${first.token}` } }));
    expect(old.status).toBe(401);
  });

  it("gives the same error for an unknown user, a wrong PIN, a teacher and a student with no PIN", async () => {
    const student = await makeStudent();
    const noPin = await makeStudent(null);
    const teacherEmail = `pin-teacher-${randomUUID()}@example.com`;
    emails.push(teacherEmail);
    await db.orm.public.User.create({ name: "T", email: teacherEmail, password: await hashPassword("correct-horse-1"), role: "TEACHER" });

    const results = [
      await attempt({ username: uname(), pin: PIN }), // unknown
      await attempt({ username: student.username, pin: WRONG }), // wrong PIN
      await attempt({ username: noPin.username, pin: PIN }), // no PIN set
      await attempt({ username: teacherEmail, pin: PIN }), // teacher e-mail used as a username
      await attempt({ username: "x", pin: "12" }), // malformed
    ];
    const bodies = await Promise.all(results.map((r) => r.json()));
    for (const r of results) expect(r.status).toBe(401);
    for (const b of bodies) expect(b).toEqual(bodies[0]);
    expect(bodies[0].error.code).toBe("INVALID_CREDENTIALS");
    expect(bodies[0].error.message).not.toMatch(/exist|unknown|locked|no pin/i);
  });

  it("rejects missing fields with a validation error", async () => {
    const res = await attempt({ username: "", pin: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields).toEqual({ username: expect.any(String), pin: expect.any(String) });
  });

  it("refuses cross-origin browser requests", async () => {
    const s = await makeStudent();
    const res = await attempt({ username: s.username, pin: PIN }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("never returns the PIN hash, in success or failure", async () => {
    const s = await makeStudent();
    const hash = (await row(s.id))!.pinHash!;
    for (const r of [await attempt({ username: s.username, pin: WRONG }), await attempt({ username: s.username, pin: PIN })]) {
      const text = await r.text();
      expect(text).not.toMatch(/pinHash|scrypt|password/i);
      expect(text).not.toContain(hash);
      expect(text).not.toContain(PIN);
    }
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain(PIN);
  });
});

describe("PIN lockout (kept in the database)", () => {
  it(`locks after ${PIN_MAX_ATTEMPTS} wrong PINs, and then refuses even the correct one`, async () => {
    const s = await makeStudent();
    for (let i = 1; i < PIN_MAX_ATTEMPTS; i++) {
      const res = await attempt({ username: s.username, pin: WRONG });
      expect((await res.json()).error.code).toBe("INVALID_CREDENTIALS");
    }
    expect((await row(s.id))!.pinFailedAttempts).toBe(PIN_MAX_ATTEMPTS - 1);

    const locking = await attempt({ username: s.username, pin: WRONG });
    expect(locking.status).toBe(429);
    const body = await locking.json();
    expect(body.error.code).toBe("PIN_LOCKED");
    expect(body.error.message).toMatch(/grown-up/i);
    expect((await row(s.id))!.pinLockedUntil).not.toBeNull();

    const correct = await attempt({ username: s.username, pin: PIN });
    expect(correct.status).toBe(429);
    expect(correct.headers.get("set-cookie")).toBeNull();
  });

  it("survives a different server instance: the state is in the database, not in memory", async () => {
    const s = await makeStudent();
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) await attempt({ username: s.username, pin: WRONG });
    // Every request here comes from a fresh "IP", so the per-IP in-memory limiter cannot be what blocks this one.
    expect((await attempt({ username: s.username, pin: PIN })).status).toBe(429);
  });

  it("unlocks after the window", async () => {
    const s = await makeStudent();
    const start = new Date();
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) await loginWithPin({ username: s.username, pin: WRONG }, undefined, start).catch(() => {});
    await expect(loginWithPin({ username: s.username, pin: PIN }, undefined, new Date(start.getTime() + PIN_LOCK_MS - 1000))).rejects.toMatchObject({ code: "PIN_LOCKED" });
    const ok = await loginWithPin({ username: s.username, pin: PIN }, undefined, new Date(start.getTime() + PIN_LOCK_MS + 1000));
    expect(ok.user.id).toBe(s.id);
    const after = (await row(s.id))!;
    expect(after.pinFailedAttempts).toBe(0);
    expect(after.pinLockedUntil).toBeNull();
  });

  it("starts counting from zero again after a lock has expired", async () => {
    const s = await makeStudent();
    const start = new Date();
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) await loginWithPin({ username: s.username, pin: WRONG }, undefined, start).catch(() => {});
    const later = new Date(start.getTime() + PIN_LOCK_MS + 1000);
    await expect(loginWithPin({ username: s.username, pin: WRONG }, undefined, later)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect((await row(s.id))!.pinFailedAttempts).toBe(1);
  });

  it("resets the counter on a successful login", async () => {
    const s = await makeStudent();
    for (let i = 0; i < PIN_MAX_ATTEMPTS - 1; i++) await attempt({ username: s.username, pin: WRONG });
    expect((await row(s.id))!.pinFailedAttempts).toBe(PIN_MAX_ATTEMPTS - 1);
    expect((await attempt({ username: s.username, pin: PIN })).status).toBe(200);
    expect((await row(s.id))!.pinFailedAttempts).toBe(0);
    // A fresh run of mistakes is needed to lock now.
    for (let i = 0; i < PIN_MAX_ATTEMPTS - 1; i++) await attempt({ username: s.username, pin: WRONG });
    expect((await attempt({ username: s.username, pin: PIN })).status).toBe(200);
  });

  it("counts guesses sent in parallel and does not let a late correct guess through", async () => {
    const s = await makeStudent();
    await Promise.all(Array.from({ length: PIN_MAX_ATTEMPTS + 3 }, () => attempt({ username: s.username, pin: WRONG })));
    const locked = (await row(s.id))!;
    expect(locked.pinLockedUntil).not.toBeNull();
    expect((await attempt({ username: s.username, pin: PIN })).status).toBe(429);
  });

  it("clearPinLockout unlocks without touching the username or PIN", async () => {
    const s = await makeStudent();
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) await attempt({ username: s.username, pin: WRONG });
    const before = (await row(s.id))!;
    expect(before.pinLockedUntil).not.toBeNull();
    await clearPinLockout([s.id]);
    const after = (await row(s.id))!;
    expect(after.pinLockedUntil).toBeNull();
    expect(after.pinFailedAttempts).toBe(0);
    expect(after.username).toBe(s.username);
    expect(after.pinHash).toBe(before.pinHash);
    expect((await attempt({ username: s.username, pin: PIN })).status).toBe(200);
  });
});

describe("setStudentCredentials and the database CHECKs", () => {
  it("rejects bad input and non-students in code", async () => {
    const s = await makeStudent(null);
    await expect(setStudentCredentials(s.id, "AB", PIN)).rejects.toThrow(/username/i);
    await expect(setStudentCredentials(s.id, "has space", PIN)).rejects.toThrow(/username/i);
    await expect(setStudentCredentials(s.id, uname(), "12345")).rejects.toThrow(/4 digits/);
    await expect(setStudentCredentials(s.id, uname(), "12a4")).rejects.toThrow(/4 digits/);

    const teacherEmail = `pin-teacher-${randomUUID()}@example.com`;
    emails.push(teacherEmail);
    const teacher = await db.orm.public.User.create({ name: "T", email: teacherEmail, password: "x", role: "TEACHER" });
    await expect(setStudentCredentials(teacher.id, uname(), PIN)).rejects.toThrow(/students/i);
  });

  it("stores the username lowercase and rejects a duplicate", async () => {
    const a = await makeStudent(null);
    const b = await makeStudent(null);
    const name = uname();
    await setStudentCredentials(a.id, name.toUpperCase(), PIN);
    expect((await row(a.id))!.username).toBe(name);
    await expect(setStudentCredentials(b.id, name, PIN)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("DB CHECK: a teacher cannot have a PIN", async () => {
    const email = `pin-teacher-${randomUUID()}@example.com`;
    emails.push(email);
    const teacher = await db.orm.public.User.create({ name: "T", email, password: "x", role: "TEACHER" });
    await expect(db.orm.public.User.where({ id: teacher.id }).updateAll({ username: uname(), pinHash: await hashPassword(PIN) })).rejects.toThrow();
    expect((await row(teacher.id))!.pinHash).toBeNull();
  });

  it("DB CHECK: a PIN needs a username", async () => {
    const s = await makeStudent(null);
    await expect(db.orm.public.User.where({ id: s.id }).updateAll({ pinHash: "scrypt$x" })).rejects.toThrow();
  });

  it("DB CHECK: rejects bad username formats", async () => {
    const s = await makeStudent(null);
    for (const bad of ["ab", "UPPERCASE", "has space", "dash-ed", "a".repeat(21), "émile_x", ""]) {
      await expect(db.orm.public.User.where({ id: s.id }).updateAll({ username: bad })).rejects.toThrow();
    }
    await db.orm.public.User.where({ id: s.id }).updateAll({ username: "ok_name_9" });
    expect((await row(s.id))!.username).toBe("ok_name_9");
  });

  it("DB CHECK: a duplicate username is rejected by the unique index", async () => {
    const a = await makeStudent(null);
    const b = await makeStudent(null);
    const name = uname();
    await db.orm.public.User.where({ id: a.id }).updateAll({ username: name });
    await expect(db.orm.public.User.where({ id: b.id }).updateAll({ username: name })).rejects.toThrow();
  });

  it("DB CHECK: the failure counter cannot go negative", async () => {
    const s = await makeStudent(null);
    await expect(db.orm.public.User.where({ id: s.id }).updateAll({ pinFailedAttempts: -1 })).rejects.toThrow();
  });
});
