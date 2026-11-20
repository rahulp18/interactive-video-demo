// Demo accounts. Emails use the reserved ".test" TLD (RFC 2606), so they can never belong to a real person, and the
// whole demo-owned user set is recognisable by DEMO_EMAIL_DOMAIN. Passwords are NEVER stored here: they come from the
// DEMO_PASSWORD environment variable.
// Students also sign in with a username + 4-digit PIN (Phase 3). Usernames are public here; the PIN comes from the
// DEMO_STUDENT_PIN environment variable and is never stored in this file or printed.

export const DEMO_EMAIL_DOMAIN = "demo.parichay.test";

export type DemoAccount = {
  /** Stable internal key. */
  key: "content" | "student" | "fresh";
  name: string;
  email: string;
  role: "TEACHER" | "STUDENT";
  /** Student login name (lowercase, 3-20 of a-z 0-9 _). Students only. */
  username?: string;
  /** What the account is for in the live demo. */
  purpose: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "content",
    name: "PARICHAY Content Team",
    email: `content@${DEMO_EMAIL_DOMAIN}`,
    role: "TEACHER",
    purpose: "Owns the demo videos (Video.uploaderId). Sign in to see the teacher view.",
  },
  {
    key: "student",
    name: "Aarav",
    email: `aarav@${DEMO_EMAIL_DOMAIN}`,
    role: "STUDENT",
    username: "aarav",
    purpose: "The demo student (age 10): about four months of history, parent and teacher ratings.",
  },
  {
    key: "fresh",
    name: "Meera",
    email: `meera@${DEMO_EMAIL_DOMAIN}`,
    role: "STUDENT",
    username: "meera",
    purpose: "A brand-new student with no history: first-time experience and empty states.",
  },
];

export const accountByKey = (key: DemoAccount["key"]) => DEMO_ACCOUNTS.find((a) => a.key === key)!;

/** True only for addresses on the reserved demo domain. Every destructive demo operation checks this first. */
export const isDemoEmail = (email: string) => email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
