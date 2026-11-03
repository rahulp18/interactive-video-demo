---
paths:
  - "apps/web/prisma/**"
  - "apps/web/migrations/**"
  - "apps/web/prisma.config.ts"
---

# Database rules (Prisma 8 / Postgres >= 15)

- Source of truth: `apps/web/prisma/contract.prisma`. After editing, regenerate with `pnpm --filter web contract:emit`; commit `contract.json` and `contract.d.ts`. Migrations live in `apps/web/migrations/`.
- Read `apps/web/prisma-8.md` and the skills in `apps/web/.claude/skills/prisma-8` before changing schema or queries.
- DB client is `db` from `apps/web/prisma/db.ts` (reads `DATABASE_URL`).

## Model summary
- `User` (password stores a hash only), `Session` (one row per web cookie / mobile bearer token; only SHA-256 `tokenHash` stored).
- `Video` (duration in seconds) → `Interaction` (`timestamp` seconds, `type` SURVEY|QUIZ, `isSkippable`, `position` orders ties) → `InteractionOption` (`isCorrect` only meaningful for QUIZ).
- `InteractionResponse`: one per (user, interaction); `isSkipped` must equal `selectedOptionId IS NULL` (CHECK). Composite FK guarantees the selected option belongs to the same interaction.
- Invariants are enforced with DB CHECK constraints and composite FKs — keep new rules at the DB level, not only in app code.
