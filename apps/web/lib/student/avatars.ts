// Preset avatars a child can pick (FR-4.7). The database stores only the KEY (`User.avatar`, format-checked there); the
// picture is an emoji drawn by the browser, so there are no uploads and no external images. Add a preset by appending here:
// keys must be 3-20 lowercase letters (the DB CHECK).

export const AVATARS = [
  { key: "fox", emoji: "🦊", label: "Fox" },
  { key: "panda", emoji: "🐼", label: "Panda" },
  { key: "lion", emoji: "🦁", label: "Lion" },
  { key: "elephant", emoji: "🐘", label: "Elephant" },
  { key: "parrot", emoji: "🦜", label: "Parrot" },
  { key: "turtle", emoji: "🐢", label: "Turtle" },
  { key: "rabbit", emoji: "🐰", label: "Rabbit" },
  { key: "owl", emoji: "🦉", label: "Owl" },
  { key: "dolphin", emoji: "🐬", label: "Dolphin" },
  { key: "butterfly", emoji: "🦋", label: "Butterfly" },
] as const;

export type AvatarKey = (typeof AVATARS)[number]["key"];

export const AVATAR_KEYS: readonly string[] = AVATARS.map((a) => a.key);
export const isAvatarKey = (value: unknown): value is AvatarKey => typeof value === "string" && AVATAR_KEYS.includes(value);

export const avatarFor = (key: string | null | undefined) => AVATARS.find((a) => a.key === key) ?? null;
