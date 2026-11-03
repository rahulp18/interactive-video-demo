import { AuthError } from "./errors";

export type RegisterInput = { name: string; email: string; password: string };
export type LoginInput = { email: string; password: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const NAME_MAX = 100;
const EMAIL_MAX = 254;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AuthError("VALIDATION_ERROR", "Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function fail(fields: Record<string, string>): never {
  throw new AuthError("VALIDATION_ERROR", "Invalid request.", fields);
}

// Only the named fields are copied out of the body, so unknown properties never reach the database layer.
export function parseRegisterInput(body: unknown): RegisterInput {
  const raw = asRecord(body);
  const fields: Record<string, string> = {};

  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  if (!name) fields.name = "Name is required.";
  else if (name.length > NAME_MAX) fields.name = `Name must be at most ${NAME_MAX} characters.`;

  const email = typeof raw.email === "string" ? normalizeEmail(raw.email) : "";
  if (!email || email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) fields.email = "A valid email is required.";

  const password = typeof raw.password === "string" ? raw.password : "";
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    fields.password = `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;
  }

  if (Object.keys(fields).length > 0) fail(fields);
  return { name, email, password };
}

// Login deliberately does not enforce password rules: a malformed value is just a failed login.
export function parseLoginInput(body: unknown): LoginInput {
  const raw = asRecord(body);
  const fields: Record<string, string> = {};
  const email = typeof raw.email === "string" ? normalizeEmail(raw.email) : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  if (!email || email.length > EMAIL_MAX) fields.email = "Email is required.";
  if (!password || password.length > PASSWORD_MAX) fields.password = "Password is required.";
  if (Object.keys(fields).length > 0) fail(fields);
  return { email, password };
}
