import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as listInteractions } from "@/app/api/interactions/route";
import { GET as listVideos } from "@/app/api/videos/route";
import { GET as getVideo, PATCH as patchVideo } from "@/app/api/videos/[id]/route";
import { POST as createInteraction } from "@/app/api/videos/[id]/interactions/route";
import { PUT as share } from "@/app/api/videos/[id]/share/route";
import { PUT as listing } from "@/app/api/videos/[id]/listing/route";
import { GET as responses } from "@/app/api/videos/[id]/responses/route";
import { hashPassword } from "@/lib/auth/password";
import { canAccessPath, homePathFor, intendedRoleFor, postAuthPath, welcomePathFor } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

const ORIGIN = "http://localhost:3000";
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) }) as never;

describe("role routing (pure)", () => {
  it("sends each role to its own home", () => {
    expect(homePathFor("STUDENT")).toBe("/library");
    expect(homePathFor("TEACHER")).toBe("/dashboard");
    expect(postAuthPath("STUDENT", undefined)).toBe("/library");
    expect(postAuthPath("TEACHER", null)).toBe("/dashboard");
  });

  it("honours a safe next only when the role may open it", () => {
    expect(postAuthPath("STUDENT", "/watch/abc")).toBe("/watch/abc");
    expect(postAuthPath("STUDENT", "/library")).toBe("/library");
    expect(postAuthPath("STUDENT", "/results")).toBe("/results");
    expect(postAuthPath("TEACHER", "/videos/12")).toBe("/videos/12");
    expect(postAuthPath("TEACHER", "/watch/abc?x=1")).toBe("/watch/abc?x=1");
  });

  it("never lets next cross a role boundary", () => {
    const teacherOnly = ["/dashboard", "/upload", "/videos", "/videos/1", "/surveys", "/quizzes", "/responses", "/responses/3", "/dashboard?x=1", "/videos#a"];
    for (const next of teacherOnly) expect(postAuthPath("STUDENT", next)).toBe("/library");
    for (const next of ["/home", "/results", "/results/1"]) expect(postAuthPath("TEACHER", next)).toBe("/dashboard");
  });

  it("cannot be bypassed with encoding tricks, and rejects unsafe values", () => {
    for (const next of ["/%64ashboard", "/%75pload", "/videos%2F1", "/%ZZ"]) expect(postAuthPath("STUDENT", next)).toBe("/library");
    for (const next of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "evil", ""]) {
      expect(postAuthPath("STUDENT", next)).toBe("/library");
      expect(postAuthPath("TEACHER", next)).toBe("/dashboard");
    }
  });

  it("labels a sign-in page by the entry button used (display only)", () => {
    expect(intendedRoleFor("/library")).toBe("STUDENT");
    expect(intendedRoleFor("/results")).toBe("STUDENT");
    expect(intendedRoleFor("/dashboard")).toBe("TEACHER");
    expect(intendedRoleFor("/videos/4")).toBe("TEACHER");
    for (const next of [null, undefined, "", "/watch/abc", "/settings", "//evil.com", "https://evil.com"]) expect(intendedRoleFor(next)).toBeNull();
  });

  it("routes new students through the welcome step, then on to a safe destination", () => {
    expect(welcomePathFor("STUDENT", undefined)).toBe("/welcome");
    expect(welcomePathFor("STUDENT", "/library")).toBe("/welcome");
    expect(welcomePathFor("STUDENT", "/watch/abc")).toBe("/welcome?next=%2Fwatch%2Fabc");
    // Cannot be steered into teacher pages or off-site, and teachers never see the student welcome.
    expect(welcomePathFor("STUDENT", "/dashboard")).toBe("/welcome");
    expect(welcomePathFor("STUDENT", "//evil.com")).toBe("/welcome");
    expect(welcomePathFor("TEACHER", "/videos")).toBe("/videos");
    expect(canAccessPath("TEACHER", "/welcome")).toBe(false);
    expect(canAccessPath("STUDENT", "/welcome")).toBe(true);
  });

  it("does not over-match look-alike prefixes", () => {
    expect(canAccessPath("STUDENT", "/videos-archive")).toBe(true);
    expect(canAccessPath("STUDENT", "/library")).toBe(true);
    expect(canAccessPath("STUDENT", "/settings")).toBe(true);
    expect(canAccessPath("TEACHER", "/homework")).toBe(true);
  });
});

describe("role enforcement on the API and in the database", () => {
  const emails: string[] = [];
  const tokens = { student: "", teacher: "" };
  let teacherId = 0;
  let videoId = 0;

  async function makeUser(label: string, role?: "STUDENT" | "TEACHER") {
    const email = `${label}-${randomUUID()}@example.com`;
    emails.push(email);
    const u = await db.orm.public.User.create({ name: label, email, password: "x", ...(role && { role }) });
    return { id: u.id, role: u.role, token: (await createSession(u.id)).token };
  }
  const authed = (method: string, path: string, token: string, body?: unknown) =>
    new Request(ORIGIN + path, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body !== undefined && { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  beforeAll(async () => {
    const student = await makeUser("role-student");
    const teacher = await makeUser("role-teacher", "TEACHER");
    expect(student.role).toBe("STUDENT"); // the column default
    tokens.student = student.token;
    tokens.teacher = teacher.token;
    teacherId = teacher.id;
    const key = `key-${randomUUID()}`;
    const v = await db.orm.public.Video.create({
      title: "T", fileUrl: `https://example.ufs.sh/f/${key}`, duration: 60, mimeType: "video/mp4",
      originalName: "t.mp4", sizeBytes: 1, fileKey: key, uploaderId: teacherId,
    });
    videoId = v.id;
  });

  afterAll(async () => {
    await db.orm.public.Video.where({ id: videoId }).deleteAll();
    for (const email of emails) await db.orm.public.User.where({ email }).deleteAll();
    await db.close();
  });

  it("gives students 403 on every teacher API, even for a video that exists", async () => {
    const id = String(videoId);
    const calls = [
      () => listVideos(authed("GET", "/api/videos", tokens.student)),
      () => listInteractions(authed("GET", "/api/interactions", tokens.student)),
      () => getVideo(authed("GET", `/api/videos/${id}`, tokens.student), params({ id })),
      () => patchVideo(authed("PATCH", `/api/videos/${id}`, tokens.student, { title: "x" }), params({ id })),
      () => createInteraction(authed("POST", `/api/videos/${id}/interactions`, tokens.student, {}), params({ id })),
      () => share(authed("PUT", `/api/videos/${id}/share`, tokens.student), params({ id })),
      () => listing(authed("PUT", `/api/videos/${id}/listing`, tokens.student, { listed: true }), params({ id })),
      () => responses(authed("GET", `/api/videos/${id}/responses`, tokens.student), params({ id })),
    ];
    for (const call of calls) {
      const res = await call();
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    }
    expect((await db.orm.public.Video.where({ id: videoId }).first())?.shareId).toBeNull();
  });

  it("keeps the teacher API working, and anonymous callers get 401 not 403", async () => {
    const id = String(videoId);
    expect((await listVideos(authed("GET", "/api/videos", tokens.teacher))).status).toBe(200);
    expect((await listInteractions(authed("GET", "/api/interactions", tokens.teacher))).status).toBe(200);
    expect((await getVideo(authed("GET", `/api/videos/${id}`, tokens.teacher), params({ id }))).status).toBe(200);
    expect((await listVideos(new Request(`${ORIGIN}/api/videos`))).status).toBe(401);
  });

  it("reports the role from /api/auth/me", async () => {
    expect((await (await me(authed("GET", "/api/auth/me", tokens.student))).json()).user.role).toBe("STUDENT");
    expect((await (await me(authed("GET", "/api/auth/me", tokens.teacher))).json()).user.role).toBe("TEACHER");
  });

  it("returns the role on login", async () => {
    const email = `role-login-${randomUUID()}@example.com`;
    emails.push(email);
    await db.orm.public.User.create({ name: "L", email, password: await hashPassword("correct-horse-1"), role: "TEACHER" });
    const res = await login(
      new Request(`${ORIGIN}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "correct-horse-1" }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).user.role).toBe("TEACHER");
  });
});
