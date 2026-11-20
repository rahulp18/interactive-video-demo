// Safety checks shared by `seed:demo` and `demo:reset`. They print the target database HOST ONLY (never the URL,
// user or password) and refuse to run unless the operator confirms with --yes.

export function databaseHost(): string {
  const raw = process.env["DATABASE_URL"];
  if (!raw) throw new Error("DATABASE_URL is not set (apps/web/.env).");
  try {
    return new URL(raw.trim().replace(/^(['"])(.*)\1$/, "$2").trim()).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
}

/**
 * Prints the target host and enforces the confirmation rules:
 *  - `--yes` must be passed (the host is shown first, so the operator can see what they are confirming);
 *  - if DEMO_ALLOWED_HOST is set, it must equal the host (pin your dev database host here to make a wrong
 *    DATABASE_URL, e.g. production, impossible to seed by accident).
 */
export function confirmTarget(argv: string[], what: string): string {
  const host = databaseHost();
  console.log(`${what}\n  target database host: ${host}`);
  const allowed = process.env["DEMO_ALLOWED_HOST"]?.trim();
  if (allowed && allowed !== host) {
    throw new Error(`Refusing to run: DEMO_ALLOWED_HOST is "${allowed}" but the target host is "${host}".`);
  }
  if (!argv.includes("--yes")) {
    throw new Error(`Refusing to run without --yes. Check the host above is your DEV database, then re-run with --yes.`);
  }
  if (!allowed) console.log("  (tip: set DEMO_ALLOWED_HOST in .env to pin the intended host)");
  return host;
}

export function demoPassword(): string {
  const password = process.env["DEMO_PASSWORD"];
  if (!password || password.length < 8) throw new Error("Set DEMO_PASSWORD (at least 8 characters) in apps/web/.env.");
  return password;
}
