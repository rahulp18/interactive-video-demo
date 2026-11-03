import { PASSWORD_MAX, PASSWORD_MIN } from "./validation";

// Client-side pre-checks that mirror the server rules in ./validation for instant feedback.
// The server remains the source of truth and its field errors are displayed as well.

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const NAME_MAX = 100;

export type LoginValues = { email: string; password: string };
export type RegisterValues = { name: string; email: string; password: string; confirmPassword: string };

export function validateLogin({ email, password }: LoginValues): FieldErrors<keyof LoginValues> {
  const errors: FieldErrors<keyof LoginValues> = {};
  if (!email) errors.email = "Email is required.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

export function validateRegister(v: RegisterValues): FieldErrors<keyof RegisterValues> {
  const errors: FieldErrors<keyof RegisterValues> = {};
  if (!v.name) errors.name = "Name is required.";
  else if (v.name.length > NAME_MAX) errors.name = `Name must be at most ${NAME_MAX} characters.`;
  if (!EMAIL_PATTERN.test(v.email) || v.email.length > EMAIL_MAX) errors.email = "Enter a valid email address.";
  if (v.password.length < PASSWORD_MIN || v.password.length > PASSWORD_MAX) {
    errors.password = `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;
  }
  if (v.confirmPassword !== v.password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;
