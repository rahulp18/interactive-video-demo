import "server-only";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";
import { getVideo } from "@/lib/videos/service";
import {
  sortInteractions,
  type AnswerType,
  validateInteraction,
  type EditorModule,
  type EditorModuleVirtue,
  type InteractionDTO,
  type InteractionType,
  type OptionWeights,
  type PresentationStyle,
} from "./model";

type OptionRow = { id: number; text: string; isCorrect: boolean; position: number };
type InteractionRow = {
  id: number;
  videoId: number;
  timestamp: number;
  type: string;
  answerType: string;
  presentationStyle: string;
  correctAnswer: string | null;
  question: string;
  isSkippable: boolean;
  position: number;
  options: OptionRow[];
};

type WeightMap = ReadonlyMap<number, OptionWeights>;

const toDTO = (r: InteractionRow, weights: WeightMap): InteractionDTO => ({
  id: r.id,
  videoId: r.videoId,
  timestamp: r.timestamp,
  type: r.type as InteractionType,
  answerType: r.answerType as AnswerType,
  presentationStyle: r.presentationStyle as PresentationStyle,
  correctAnswer: r.correctAnswer,
  question: r.question,
  isSkippable: r.isSkippable,
  position: r.position,
  options: [...r.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position, weights: { ...(weights.get(o.id) ?? {}) } })),
});

/** optionId -> { virtueId: weight } for the given options (one query). */
async function loadWeights(rows: readonly InteractionRow[]): Promise<WeightMap> {
  const optionIds = rows.flatMap((r) => r.options.map((o) => o.id));
  const out = new Map<number, OptionWeights>();
  if (optionIds.length === 0) return out;
  const weightRows = await db.orm.public.OptionVirtueWeight.where((w) => w.optionId.in(optionIds)).all();
  for (const w of weightRows) out.set(w.optionId, { ...(out.get(w.optionId) ?? {}), [w.virtueId]: w.weight });
  return out;
}

async function toDTOs(rows: readonly InteractionRow[]): Promise<InteractionDTO[]> {
  const weights = await loadWeights(rows);
  return rows.map((r) => toDTO(r, weights));
}

// Postgres foreign_key_violation (SQLSTATE 23503): an option that already has responses cannot be removed.
function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("sqlState" in error && error.sqlState === "23503") return true;
  return "cause" in error && isForeignKeyViolation(error.cause);
}

const validationError = (errors: Record<string, string>) => new AuthError("VALIDATION_ERROR", "Invalid request.", errors);

/** The story module behind a video (primary virtue first, then secondaries in order), or null for a plain video. */
async function moduleOfVideo(videoId: number): Promise<EditorModule | null> {
  const mod = await db.orm.public.Module.where({ videoId }).first();
  if (!mod) return null;
  const [secondary, virtues] = await Promise.all([
    db.orm.public.ModuleSecondaryVirtue.where({ moduleId: mod.id }).all(),
    db.orm.public.Virtue.all(),
  ]);
  const virtueOf = new Map(virtues.map((v) => [v.id, v]));
  const ids: { id: number; role: EditorModuleVirtue["role"] }[] = [
    { id: mod.primaryVirtueId, role: "primary" },
    ...[...secondary].sort((a, b) => a.position - b.position).map((s) => ({ id: s.virtueId, role: "secondary" as const })),
  ];
  return {
    moduleId: mod.id,
    status: mod.status as EditorModule["status"],
    virtues: ids.flatMap(({ id, role }) => {
      const v = virtueOf.get(id);
      return v ? [{ id: v.id, slug: v.slug, name: v.name, role }] : [];
    }),
  };
}

/** Module context for the editor of a video the caller owns (ownership is checked first). */
export async function getEditorModule(userId: number, videoId: number): Promise<EditorModule | null> {
  await getVideo(userId, videoId);
  return moduleOfVideo(videoId);
}

/** Interactions of a video the caller owns (ownership is checked first), sorted by timestamp. */
export async function listVideoInteractions(userId: number, videoId: number): Promise<InteractionDTO[]> {
  await getVideo(userId, videoId);
  const rows = await db.orm.public.Interaction.where({ videoId }).include("options").all();
  return sortInteractions(await toDTOs(rows));
}

async function readInteraction(videoId: number, id: number): Promise<InteractionDTO> {
  const row = await db.orm.public.Interaction.where({ id, videoId }).include("options").first();
  if (!row) throw new AuthError("NOT_FOUND", "Interaction not found.");
  return (await toDTOs([row]))[0];
}

/** Validation context derived on the server from the video itself; the client never says whether it is a module. */
async function contextFor(videoId: number) {
  const mod = await moduleOfVideo(videoId);
  return { mod, ctx: mod ? { moduleVirtueIds: mod.virtues.map((v) => v.id) } : {} };
}

export async function createInteraction(userId: number, videoId: number, body: unknown): Promise<InteractionDTO> {
  const video = await getVideo(userId, videoId);
  const { mod, ctx } = await contextFor(videoId);
  const parsed = validateInteraction(body, video.duration, ctx);
  if (parsed.errors) throw validationError(parsed.errors);
  const input = parsed.value;
  if (input.options.some((o) => o.id !== undefined)) {
    throw validationError({ options: "New interactions cannot reference existing options." });
  }

  const id = await db.transaction(async (tx) => {
    // Position orders interactions that share a timestamp.
    const tied = await tx.orm.public.Interaction.where({ videoId, timestamp: input.timestamp }).all();
    const created = await tx.orm.public.Interaction.create({
      videoId,
      timestamp: input.timestamp,
      type: input.type,
      answerType: input.answerType,
      ...(mod && { presentationStyle: input.presentationStyle }),
      correctAnswer: input.correctAnswer,
      question: input.question,
      isSkippable: input.isSkippable,
      position: tied.length,
    });
    const weightRows: { optionId: number; virtueId: number; weight: number }[] = [];
    for (const [position, o] of input.options.entries()) {
      // One create per option (at most 8) so each new id is known for its weight rows.
      const option = await tx.orm.public.InteractionOption.create({ interactionId: created.id, text: o.text, isCorrect: o.isCorrect, position });
      for (const [virtueId, weight] of Object.entries(o.weights ?? {})) weightRows.push({ optionId: option.id, virtueId: Number(virtueId), weight });
    }
    if (weightRows.length > 0) await tx.orm.public.OptionVirtueWeight.createAll(weightRows);
    return created.id;
  });
  return readInteraction(videoId, id);
}

/**
 * Replaces an interaction's configuration. Options sent with an `id` are updated in place (so rows that responses
 * point at survive), options without one are created, and existing options that are not sent are deleted.
 * Story modules: each sent option's weights for the MODULE's virtues are replaced by what was sent; weight rows for any
 * other virtue (e.g. one that was a secondary virtue before the module changed) are left as they are.
 */
export async function updateInteraction(
  userId: number,
  videoId: number,
  interactionId: number,
  body: unknown,
): Promise<InteractionDTO> {
  const video = await getVideo(userId, videoId);
  const { mod, ctx } = await contextFor(videoId);
  const parsed = validateInteraction(body, video.duration, ctx);
  if (parsed.errors) throw validationError(parsed.errors);
  const input = parsed.value;

  const existing = await db.orm.public.Interaction.where({ id: interactionId, videoId }).include("options").first();
  if (!existing) throw new AuthError("NOT_FOUND", "Interaction not found.");

  const existingIds = new Set(existing.options.map((o) => o.id));
  if (input.options.some((o) => o.id !== undefined && !existingIds.has(o.id))) {
    throw validationError({ options: "Option does not belong to this interaction." });
  }
  const keptIds = new Set(input.options.flatMap((o) => (o.id === undefined ? [] : [o.id])));
  const removedIds = existing.options.filter((o) => !keptIds.has(o.id)).map((o) => o.id);
  const moduleVirtueIds = ctx.moduleVirtueIds ? [...ctx.moduleVirtueIds] : [];

  let position = existing.position;
  if (existing.timestamp !== input.timestamp) {
    const tied = await db.orm.public.Interaction.where({ videoId, timestamp: input.timestamp }).all();
    position = tied.length;
  }

  try {
    await db.transaction(async (tx) => {
      await tx.orm.public.Interaction.where({ id: interactionId, videoId }).updateAll({
        timestamp: input.timestamp,
        type: input.type,
        answerType: input.answerType,
        // Plain videos keep whatever style they have (the editor does not show the field for them).
        ...(mod && { presentationStyle: input.presentationStyle }),
        correctAnswer: input.correctAnswer,
        question: input.question,
        isSkippable: input.isSkippable,
        position,
      });
      if (removedIds.length > 0) {
        await tx.orm.public.InteractionOption.where((o) => o.id.in(removedIds)).deleteAll();
      }
      // (interactionId, position) is unique: park kept options out of the way before assigning final positions.
      const PARK = 1_000_000;
      for (const o of existing.options.filter((o) => keptIds.has(o.id))) {
        await tx.orm.public.InteractionOption.where({ id: o.id }).updateAll({ position: PARK + o.position });
      }
      const weightRows: { optionId: number; virtueId: number; weight: number }[] = [];
      const addWeights = (optionId: number, weights: OptionWeights | undefined) => {
        for (const [virtueId, weight] of Object.entries(weights ?? {})) weightRows.push({ optionId, virtueId: Number(virtueId), weight });
      };
      for (const [index, o] of input.options.entries()) {
        if (o.id !== undefined) {
          await tx.orm.public.InteractionOption.where({ id: o.id }).updateAll({
            text: o.text,
            isCorrect: o.isCorrect,
            position: index,
          });
          addWeights(o.id, o.weights);
        } else {
          const option = await tx.orm.public.InteractionOption.create({ interactionId, text: o.text, isCorrect: o.isCorrect, position: index });
          addWeights(option.id, o.weights);
        }
      }
      if (mod && keptIds.size > 0 && moduleVirtueIds.length > 0) {
        const kept = [...keptIds];
        await tx.orm.public.OptionVirtueWeight.where((w) => w.optionId.in(kept))
          .where((w) => w.virtueId.in(moduleVirtueIds))
          .deleteAll();
      }
      if (weightRows.length > 0) await tx.orm.public.OptionVirtueWeight.createAll(weightRows);
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new AuthError("CONFLICT", "An answer option that already has responses cannot be removed.");
    }
    throw error;
  }
  return readInteraction(videoId, interactionId);
}

export async function deleteInteraction(userId: number, videoId: number, interactionId: number): Promise<void> {
  await getVideo(userId, videoId);
  const deleted = await db.orm.public.Interaction.where({ id: interactionId, videoId }).delete();
  if (!deleted) throw new AuthError("NOT_FOUND", "Interaction not found.");
}
