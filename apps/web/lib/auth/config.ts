const isProduction = process.env.NODE_ENV === "production";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The `__Host-` prefix makes browsers require Secure + Path=/ + no Domain, so it is only usable over HTTPS.
export const SESSION_COOKIE_NAME = isProduction ? "__Host-session" : "session";

export const CLIENT_TYPE_HEADER = "x-client-type";
