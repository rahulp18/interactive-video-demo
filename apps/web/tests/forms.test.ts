import { describe, expect, it } from "vitest";
import { hasErrors, validateLogin, validateRegister } from "@/lib/auth/forms";

const valid = { name: "Ada", email: "ada@example.com", password: "correct horse", confirmPassword: "correct horse" };

describe("validateLogin", () => {
  it("requires both fields", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "Email is required.",
      password: "Password is required.",
    });
  });
  it("accepts filled fields", () => {
    expect(hasErrors(validateLogin({ email: "a@b.co", password: "x" }))).toBe(false);
  });
});

describe("validateRegister", () => {
  it("accepts valid input", () => {
    expect(hasErrors(validateRegister(valid))).toBe(false);
  });
  it("rejects bad email, short password and mismatch", () => {
    const errors = validateRegister({ ...valid, email: "nope", password: "short", confirmPassword: "other" });
    expect(Object.keys(errors).sort()).toEqual(["confirmPassword", "email", "password"]);
  });
  it("rejects an empty or overlong name", () => {
    expect(validateRegister({ ...valid, name: "" }).name).toBeDefined();
    expect(validateRegister({ ...valid, name: "x".repeat(101) }).name).toBeDefined();
  });
});
