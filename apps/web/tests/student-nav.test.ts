import { describe, expect, it } from "vitest";
import { canAccessPath, postAuthPath } from "@/lib/auth/roles";
import {
  STUDENT_GROWNUPS_LINK,
  STUDENT_NAV_ITEMS,
  TEACHER_NAV_ITEMS,
  isItemActive,
  navGroupsFor,
  titleFor,
} from "@/components/layout/nav-items";

const items = STUDENT_NAV_ITEMS;

describe("student navigation", () => {
  it("is exactly the four destinations, in order", () => {
    expect(items.map((i) => [i.label, i.href])).toEqual([
      ["Home", "/student"],
      ["Journeys", "/student/journeys"],
      ["My Virtue Tree", "/student/virtues"],
      ["Profile", "/student/profile"],
    ]);
    expect(navGroupsFor("STUDENT")).toEqual([{ items }]);
  });

  it("keeps the grown-ups link out of the menu and points it at /student/parent", () => {
    expect(STUDENT_GROWNUPS_LINK.href).toBe("/student/parent");
    expect(items.some((i) => i.href === STUDENT_GROWNUPS_LINK.href)).toBe(false);
  });

  it("no longer lists the library or the removed pages", () => {
    const hrefs = items.map((i) => i.href);
    for (const gone of ["/library", "/home", "/results", "/student/learning", "/student/assignments", "/student/progress", "/student/reports"]) {
      expect(hrefs).not.toContain(gone);
    }
    expect(items.some((i) => i.alsoActive?.includes("/library"))).toBe(false);
  });

  it("highlights exactly one item per route, and none for the library", () => {
    for (const item of items) {
      const active = items.filter((i) => isItemActive(item.href, i));
      expect(active.map((i) => i.href)).toEqual([item.href]);
    }
    expect(items.filter((i) => isItemActive("/student/journeys/abc", i)).map((i) => i.label)).toEqual(["Journeys"]);
    expect(items.some((i) => isItemActive("/library", i))).toBe(false);
    expect(items.some((i) => isItemActive("/student/parent", i))).toBe(false);
    expect(items.some((i) => isItemActive("/dashboard", i))).toBe(false);
  });

  it("titles pages", () => {
    expect(titleFor("/student")).toBe("Home");
    expect(titleFor("/student/journeys")).toBe("Journeys");
    expect(titleFor("/student/virtues")).toBe("My Virtue Tree");
    expect(titleFor("/student/profile")).toBe("Profile");
    expect(titleFor("/student/parent")).toBe("For grown-ups");
  });

  it("groups teacher navigation into sections that cover every item once", () => {
    expect(navGroupsFor("TEACHER").flatMap((group) => group.items).map((item) => item.href).sort()).toEqual(TEACHER_NAV_ITEMS.map((item) => item.href).sort());
    expect(TEACHER_NAV_ITEMS.map((i) => i.href)).toEqual(["/dashboard", "/modules", "/journeys", "/students", "/settings"]);
    // Every teacher menu item is a route a teacher may open.
    for (const item of TEACHER_NAV_ITEMS) expect(canAccessPath("TEACHER", item.href)).toBe(true);
  });

  it("keeps /student for students only, even through next", () => {
    for (const href of [...items.map((i) => i.href), STUDENT_GROWNUPS_LINK.href]) {
      expect(canAccessPath("STUDENT", href)).toBe(true);
      expect(canAccessPath("TEACHER", href)).toBe(false);
      expect(postAuthPath("TEACHER", href)).toBe("/dashboard");
    }
    expect(canAccessPath("TEACHER", "/students-guide")).toBe(true);
  });
});
