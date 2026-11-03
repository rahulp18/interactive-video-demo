export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "EMAIL_TAKEN"
  | "FORBIDDEN_ORIGIN"
  | "INTERNAL_ERROR";

const STATUS: Record<AuthErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_JSON: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  EMAIL_TAKEN: 409,
  FORBIDDEN_ORIGIN: 403,
  INTERNAL_ERROR: 500,
};

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: AuthErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.fields = fields;
  }
}
