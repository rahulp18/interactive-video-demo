import { describe, expect, it } from "vitest";
import { canAccessPath, postAuthPath } from "@/lib/auth/roles";
import { STUDENT_NAV_GROUPS, TEACHER_NAV_ITEMS, isItemActive, navGroupsFor, titleFor } from "@/components/layout/nav-items";

const items = STUDENT_NAV_GROUPS.flatMap((g) => g.items);

describe("student navigation", () => {
  it("has the eight destinations in order, grouped", () => {
    expect(STUDENT_NAV_GROUPS.map((g) => g.label)).toEqual(["Learning", "My Development", "Account"]);
    expect(items.map((i) => [i.label, i.href])).toEqual([
      ["Home", "/student"],
      ["Explore Journeys", "/student/journeys"],
      ["My Learning", "/student/learning"],
      ["My Assignments", "/student/assignments"],
      ["My Progress", "/student/progress"],
      ["Virtue Profile", "/student/virtues"],
      ["My Reports", "/student/reports"],
      ["My Profile", "/student/profile"],
    ]);
  });

  it("highlights exactly one item per route", () => {
    for (const item of items) {
      const active = items.filter((i) => isItemActive(item.href, i));
      expect(active.map((i) => i.href)).toEqual([item.href]);
    }
    expect(items.filter((i) => isItemActive("/student/journeys/abc", i)).map((i) => i.label)).toEqual(["Explore Journeys"]);
    expect(items.filter((i) => isItemActive("/library", i)).map((i) => i.label)).toEqual(["Explore Journeys"]);
    expect(items.some((i) => isItemActive("/dashboard", i))).toBe(false);
  });

  it("titles pages, including the older student pages", () => {
    expect(titleFor("/student")).toBe("Home");
    expect(titleFor("/student/virtues")).toBe("Virtue Profile");
    expect(titleFor("/home")).toBe("Home");
    expect(titleFor("/results")).toBe("My Results");
  });

  it("leaves teacher navigation as a single ungrouped list", () => {
    expect(navGroupsFor("TEACHER")).toEqual([{ items: TEACHER_NAV_ITEMS }]);
    expect(TEACHER_NAV_ITEMS.map((i) => i.href)).toEqual(["/dashboard", "/library", "/upload", "/videos", "/responses", "/surveys", "/quizzes", "/settings"]);
  });

  it("keeps /student for students only, even through next", () => {
    for (const item of items) expect(canAccessPath("STUDENT", item.href)).toBe(true);
    for (const item of items) {
      expect(canAccessPath("TEACHER", item.href)).toBe(false);
      expect(postAuthPath("TEACHER", item.href)).toBe("/dashboard");
    }
    expect(canAccessPath("TEACHER", "/students-guide")).toBe(true);
  });
});
