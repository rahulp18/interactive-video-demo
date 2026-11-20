import { createHash } from "node:crypto";
import { db } from "../../prisma/db";
import { hashPassword, verifyPassword } from "../../lib/auth/password";
import { validateParentMarks } from "../../lib/scoring";
import { DEMO_ACCOUNTS, isDemoEmail, accountByKey, type DemoAccount } from "./content/accounts";
import { CLIPS, JOURNEYS, MODULES, MODULE_BY_SLUG, VIRTUE_SLUGS, demoFileKey } from "./content";
import { COMPLETED, IN_PROGRESS, RATINGS, captureFor } from "./content/history";
import { resolvePicks } from "./profile";

// Seeding library. No process.argv / process.exit here, so tests can call it directly. Every write is keyed on a demo
// natural key (Video.fileKey = "demo:<slug>", demo account emails, journey titles) and diff-based, so running it twice
// changes nothing. Nothing here deletes by anything broader than those keys or a verified demo user id.

type Stats = { created: number; updated: number; deleted: number };
const newStats = (): Stats => ({ created: 0, updated: 0, deleted: 0 });
const DAY_MS = 86_400_000;
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

/** Stable, public demo watch token (derived, so every database gets the same links). */
export const demoShareId = (slug: string) => createHash("sha256").update(`parichay-demo:${slug}`).digest("base64url").slice(0, 16);

// ---------------------------------------------------------------- accounts

export async function ensureAccounts(password: string, opts: { syncPasswords?: boolean } = {}): Promise<Record<DemoAccount["key"], number>> {
  if (password.length < 8) throw new Error("DEMO_PASSWORD must be at least 8 characters.");
  const ids = {} as Record<DemoAccount["key"], number>;
  for (const account of DEMO_ACCOUNTS) {
    const existing = await db.orm.public.User.where({ email: account.email }).first();
    if (!existing) {
      ids[account.key] = (await db.orm.public.User.create({ name: account.name, email: account.email, role: account.role, password: await hashPassword(password) })).id;
      continue;
    }
    ids[account.key] = existing.id;
    const patch: { name?: string; role?: DemoAccount["role"]; password?: string } = {};
    if (existing.name !== account.name) patch.name = account.name;
    if (existing.role !== account.role) patch.role = account.role;
    // An existing password is only replaced on request: a random-salt re-hash on every run would "change" the row.
    if (opts.syncPasswords && !(await verifyPassword(password, existing.password))) patch.password = await hashPassword(password);
    if (Object.keys(patch).length > 0) await db.orm.public.User.where({ id: existing.id }).updateAll(patch);
  }
  return ids;
}

export async function demoAccountIds(): Promise<Record<DemoAccount["key"], number>> {
  const ids = {} as Record<DemoAccount["key"], number>;
  for (const account of DEMO_ACCOUNTS) {
    const user = await db.orm.public.User.where({ email: account.email }).first();
    if (!user) throw new Error(`Demo account ${account.email} does not exist. Run "pnpm --filter web seed:demo --yes" first.`);
    ids[account.key] = user.id;
  }
  return ids;
}

/** Throws unless `userId` is a user on the reserved demo domain. Called before every per-user delete. */
export async function assertDemoUser(userId: number): Promise<void> {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user || !isDemoEmail(user.email)) throw new Error("Refusing to touch a user that is not a demo account.");
}

// ---------------------------------------------------------------- content

export type ContentResult = { stats: Stats; moduleIds: Record<string, number>; shareIds: Record<string, string> };

export async function seedContent(ownerId: number): Promise<ContentResult> {
  const stats = newStats();
  const virtueRows = await db.orm.public.Virtue.all();
  if (virtueRows.length !== 10) throw new Error("The 10 virtues are missing. Apply the migrations first.");
  const virtueId = new Map(virtueRows.map((v) => [v.slug, v.id]));
  const vid = (slug: string) => {
    const id = virtueId.get(slug);
    if (id === undefined) throw new Error(`Unknown virtue ${slug}`);
    return id;
  };
  const keys = MODULES.map((m) => demoFileKey(m.slug));

  // 1. Videos (natural key: fileKey). Demo videos are NOT UploadThing files: nothing here ever calls the UploadThing API.
  const videos = new Map((await db.orm.public.Video.where((v) => v.fileKey.in(keys)).all()).map((v) => [v.fileKey, v]));
  for (const m of MODULES) {
    const clip = CLIPS[m.clip];
    if (!clip) throw new Error(`${m.slug}: unknown clip ${m.clip}`);
    const want = {
      title: m.title,
      fileUrl: clip.url,
      duration: clip.duration,
      mimeType: clip.mimeType,
      originalName: clip.url.split("/").pop() ?? `${m.slug}.mp4`,
      sizeBytes: clip.sizeBytes,
      shareId: demoShareId(m.slug),
      isListed: false,
    };
    const have = videos.get(demoFileKey(m.slug));
    if (!have) {
      await db.orm.public.Video.create({ ...want, fileKey: demoFileKey(m.slug), uploaderId: ownerId });
      stats.created++;
    } else if ((Object.keys(want) as (keyof typeof want)[]).some((k) => have[k] !== want[k])) {
      await db.orm.public.Video.where({ id: have.id }).updateAll(want);
      stats.updated++;
    }
  }
  const videoRows = await db.orm.public.Video.where((v) => v.fileKey.in(keys)).all();
  const videoBySlug = new Map(MODULES.map((m) => [m.slug, videoRows.find((v) => v.fileKey === demoFileKey(m.slug))!]));
  const videoIds = videoRows.map((v) => v.id);

  // 2. Modules (1:1 with Video) and secondary virtues.
  const existingModules = new Map((await db.orm.public.Module.where((x) => x.videoId.in(videoIds)).all()).map((x) => [x.videoId, x]));
  for (const m of MODULES) {
    const video = videoBySlug.get(m.slug)!;
    const want = {
      sourceStory: m.sourceStory,
      primaryVirtueId: vid(m.primary),
      ageBand: m.ageBand,
      learningObjective: m.learningObjective,
      discussionPrompts: m.discussionPrompts,
      followUpActivity: m.followUp,
      status: "PUBLISHED" as const,
    };
    const have = existingModules.get(video.id);
    if (!have) {
      await db.orm.public.Module.create({ ...want, videoId: video.id });
      stats.created++;
    } else if (
      have.sourceStory !== want.sourceStory ||
      have.primaryVirtueId !== want.primaryVirtueId ||
      have.ageBand !== want.ageBand ||
      have.learningObjective !== want.learningObjective ||
      have.followUpActivity !== want.followUpActivity ||
      have.status !== want.status ||
      JSON.stringify(have.discussionPrompts) !== JSON.stringify(want.discussionPrompts)
    ) {
      await db.orm.public.Module.where({ id: have.id }).updateAll(want);
      stats.updated++;
    }
  }
  const moduleRows = await db.orm.public.Module.where((x) => x.videoId.in(videoIds)).all();
  const moduleBySlug = new Map(MODULES.map((m) => [m.slug, moduleRows.find((x) => x.videoId === videoBySlug.get(m.slug)!.id)!]));
  const moduleIdList = moduleRows.map((x) => x.id);

  const secondaries = await db.orm.public.ModuleSecondaryVirtue.where((s) => s.moduleId.in(moduleIdList)).all();
  for (const m of MODULES) {
    const mod = moduleBySlug.get(m.slug)!;
    const have = secondaries.filter((s) => s.moduleId === mod.id).sort((a, b) => a.position - b.position);
    const wantIds = m.secondary.map(vid);
    if (have.length === wantIds.length && have.every((s, i) => s.virtueId === wantIds[i])) continue;
    if (have.length > 0) {
      await db.orm.public.ModuleSecondaryVirtue.where((s) => s.moduleId.eq(mod.id)).deleteAll();
      stats.deleted += have.length;
    }
    if (wantIds.length > 0) {
      await db.orm.public.ModuleSecondaryVirtue.createAll(wantIds.map((virtueId, i) => ({ moduleId: mod.id, virtueId, primaryVirtueId: mod.primaryVirtueId, position: i + 1 })));
      stats.created += wantIds.length;
    }
  }

  // 3. Interactions: question i is the i-th interaction by timestamp. Updated in place so responses keep pointing at them.
  const interactionsOf = async () => {
    const rows = await db.orm.public.Interaction.where((i) => i.videoId.in(videoIds)).all();
    return (videoId: number) => rows.filter((i) => i.videoId === videoId).sort((a, b) => a.timestamp - b.timestamp || a.position - b.position || a.id - b.id);
  };
  let byVideo = await interactionsOf();
  for (const m of MODULES) {
    const video = videoBySlug.get(m.slug)!;
    const have = byVideo(video.id);
    const clip = CLIPS[m.clip];
    const wants = m.questions.map((q) => ({
      timestamp: Math.round(q.at * clip.duration * 10) / 10,
      type: q.type ?? ("SURVEY" as const),
      question: q.question,
      answerType: "CHOICE" as const,
      presentationStyle: q.style,
      isSkippable: false,
      position: 0,
      correctAnswer: null as string | null,
    }));
    const creates: ((typeof wants)[number] & { videoId: number })[] = [];
    wants.forEach((want, i) => {
      if (!have[i]) creates.push({ ...want, videoId: video.id });
    });
    for (let i = 0; i < wants.length; i++) {
      const row = have[i];
      // Updated in place (one row at a time) so a changed question keeps its id and the responses pointing at it.
      if (row && (Object.keys(wants[i]) as (keyof (typeof wants)[number])[]).some((k) => row[k] !== wants[i][k])) {
        await db.orm.public.Interaction.where({ id: row.id }).updateAll(wants[i]);
        stats.updated++;
      }
    }
    if (creates.length > 0) {
      await db.orm.public.Interaction.createAll(creates);
      stats.created += creates.length;
    }
    const extra = have.slice(wants.length);
    if (extra.length > 0) {
      const extraIds = extra.map((e) => e.id);
      await db.orm.public.Interaction.where((i) => i.id.in(extraIds)).deleteAll();
      stats.deleted += extra.length;
    }
  }
  byVideo = await interactionsOf();

  // 4. Options (matched by position).
  const interactionIds = MODULES.flatMap((m) => byVideo(videoBySlug.get(m.slug)!.id).map((i) => i.id));
  const optionRows = interactionIds.length === 0 ? [] : await db.orm.public.InteractionOption.where((o) => o.interactionId.in(interactionIds)).all();
  const newOptions: { interactionId: number; text: string; isCorrect: boolean; position: number }[] = [];
  for (const m of MODULES) {
    const rows = byVideo(videoBySlug.get(m.slug)!.id);
    for (let qi = 0; qi < m.questions.length; qi++) {
      const q = m.questions[qi];
      const interaction = rows[qi];
      const have = optionRows.filter((o) => o.interactionId === interaction.id);
      for (let pi = 0; pi < q.options.length; pi++) {
        const want = { text: q.options[pi].text, isCorrect: q.type === "QUIZ" && q.correct === pi };
        const row = have.find((o) => o.position === pi);
        if (!row) newOptions.push({ interactionId: interaction.id, ...want, position: pi });
        else if (row.text !== want.text || row.isCorrect !== want.isCorrect) {
          await db.orm.public.InteractionOption.where({ id: row.id }).updateAll(want);
          stats.updated++;
        }
      }
      const drop = have.filter((o) => o.position >= q.options.length).map((o) => o.id);
      if (drop.length > 0) {
        await db.orm.public.InteractionOption.where((o) => o.id.in(drop)).deleteAll();
        stats.deleted += drop.length;
      }
    }
  }
  if (newOptions.length > 0) {
    await db.orm.public.InteractionOption.createAll(newOptions);
    stats.created += newOptions.length;
  }

  // 5. Virtue weights per option (diffed per (option, virtue)).
  const optionsNow = interactionIds.length === 0 ? [] : await db.orm.public.InteractionOption.where((o) => o.interactionId.in(interactionIds)).all();
  const optionIds = optionsNow.map((o) => o.id);
  const weightRows = optionIds.length === 0 ? [] : await db.orm.public.OptionVirtueWeight.where((w) => w.optionId.in(optionIds)).all();
  const newWeights: { optionId: number; virtueId: number; weight: number }[] = [];
  const staleWeights: number[] = [];
  for (const m of MODULES) {
    const rows = byVideo(videoBySlug.get(m.slug)!.id);
    m.questions.forEach((q, qi) => {
      q.options.forEach((o, pi) => {
        const option = optionsNow.find((x) => x.interactionId === rows[qi].id && x.position === pi)!;
        const want = Object.entries(o.w ?? {});
        const have = weightRows.filter((w) => w.optionId === option.id);
        for (const [slug, weight] of want) {
          const row = have.find((w) => w.virtueId === vid(slug));
          if (!row) newWeights.push({ optionId: option.id, virtueId: vid(slug), weight });
          else if (row.weight !== weight) {
            staleWeights.push(row.id);
            newWeights.push({ optionId: option.id, virtueId: vid(slug), weight });
          }
        }
        for (const row of have) if (!want.some(([slug]) => vid(slug) === row.virtueId)) staleWeights.push(row.id);
      });
    });
  }
  if (staleWeights.length > 0) {
    await db.orm.public.OptionVirtueWeight.where((w) => w.id.in(staleWeights)).deleteAll();
    stats.deleted += staleWeights.length;
  }
  if (newWeights.length > 0) {
    await db.orm.public.OptionVirtueWeight.createAll(newWeights);
    stats.created += newWeights.length;
  }

  const finalModules = await db.orm.public.Module.where((x) => x.videoId.in(videoIds)).all();
  return {
    stats,
    moduleIds: Object.fromEntries(MODULES.map((m) => [m.slug, finalModules.find((x) => x.videoId === videoBySlug.get(m.slug)!.id)!.id])),
    shareIds: Object.fromEntries(MODULES.map((m) => [m.slug, demoShareId(m.slug)])),
  };
}

export async function seedJourneys(moduleIds: Record<string, number>): Promise<Stats> {
  const stats = newStats();
  const virtueRows = await db.orm.public.Virtue.all();
  const vid = (slug: string) => virtueRows.find((v) => v.slug === slug)!.id;
  for (const j of JOURNEYS) {
    const want = { title: j.title, description: j.description, focusVirtueId: vid(j.focus), displayOrder: j.displayOrder };
    let row = await db.orm.public.Journey.where({ title: j.title }).first();
    if (!row) {
      row = await db.orm.public.Journey.create(want);
      stats.created++;
    } else if (row.description !== want.description || row.focusVirtueId !== want.focusVirtueId || row.displayOrder !== want.displayOrder) {
      await db.orm.public.Journey.where({ id: row.id }).updateAll(want);
      stats.updated++;
    }
    const journeyId = row.id;
    const have = await db.orm.public.JourneyModule.where({ journeyId }).all();
    const wantRows = j.levels.flatMap((slugs, li) => slugs.map((slug, pos) => ({ journeyId, moduleId: moduleIds[slug], level: li + 1, position: pos })));
    const creates: typeof wantRows = [];
    for (const w of wantRows) {
      const h = have.find((x) => x.moduleId === w.moduleId);
      if (!h) creates.push(w);
      else if (h.level !== w.level || h.position !== w.position) {
        // (journeyId, level, position) is unique: move via delete + create to avoid transient clashes.
        await db.orm.public.JourneyModule.where({ id: h.id }).deleteAll();
        creates.push(w);
        stats.updated++;
      }
    }
    const drop = have.filter((h) => !wantRows.some((w) => w.moduleId === h.moduleId)).map((h) => h.id);
    if (drop.length > 0) {
      await db.orm.public.JourneyModule.where((x) => x.id.in(drop)).deleteAll();
      stats.deleted += drop.length;
    }
    if (creates.length > 0) {
      await db.orm.public.JourneyModule.createAll(creates);
      stats.created += creates.length;
    }
  }
  return stats;
}

// ---------------------------------------------------------------- the demo student's history

/** Deletes one demo user's progress, responses and ratings. Nothing else. */
export async function clearStudentHistory(userId: number): Promise<void> {
  await assertDemoUser(userId);
  await db.orm.public.InteractionResponse.where({ userId }).deleteAll();
  await db.orm.public.ModuleProgress.where({ userId }).deleteAll();
  await db.orm.public.VirtueRating.where({ studentId: userId }).deleteAll();
}

export async function hasHistory(userId: number): Promise<boolean> {
  return (await db.orm.public.ModuleProgress.where({ userId }).first()) !== null;
}

/** Writes the designed history for `userId` (a demo user with no history yet), relative to `now`. */
export async function seedStudentHistory(userId: number, now: Date = new Date()): Promise<{ progress: number; responses: number; ratings: number }> {
  await assertDemoUser(userId);
  const virtueRows = await db.orm.public.Virtue.all();
  const vid = (slug: string) => virtueRows.find((v) => v.slug === slug)!.id;

  // Parent marks must respect the 3 + 3 limits (checked per rating set, i.e. per rater and date).
  for (const set of RATINGS) {
    const error = validateParentMarks(Object.values(set.ratings).map(([, mark]) => mark));
    if (error) throw new Error(`Demo ratings (${set.raterName}, ${set.daysAgo} days ago): ${error}`);
  }

  const slugs = [...COMPLETED.map((c) => c.slug), IN_PROGRESS.slug];
  const videos = await db.orm.public.Video.where((v) => v.fileKey.in(slugs.map(demoFileKey))).all();
  const modules = await db.orm.public.Module.where((m) => m.videoId.in(videos.map((v) => v.id))).all();
  const interactions = await db.orm.public.Interaction.where((i) => i.videoId.in(videos.map((v) => v.id))).all();
  const options = await db.orm.public.InteractionOption.where((o) => o.interactionId.in(interactions.map((i) => i.id))).all();

  const rowsOf = (slug: string) => {
    const video = videos.find((v) => v.fileKey === demoFileKey(slug));
    const moduleRow = video && modules.find((m) => m.videoId === video.id);
    if (!video || !moduleRow) throw new Error(`Demo module ${slug} is not seeded. Run seed:demo first.`);
    const qs = interactions.filter((i) => i.videoId === video.id).sort((a, b) => a.timestamp - b.timestamp || a.position - b.position || a.id - b.id);
    return { video, module: moduleRow, qs };
  };
  const responsesFor = (slug: string, picks: string, at: Date) => {
    const { qs } = rowsOf(slug);
    const def = MODULE_BY_SLUG.get(slug)!;
    return resolvePicks(def, picks).map((optionIndex, qi) => {
      const option = options.find((o) => o.interactionId === qs[qi].id && o.position === optionIndex);
      if (!option) throw new Error(`${slug}: question ${qi + 1} has no option ${optionIndex}`);
      const capture = captureFor(slug, qi);
      return { userId, interactionId: qs[qi].id, selectedOptionId: option.id, isSkipped: false, ...capture, createdAt: new Date(at.getTime() + qi * 60_000) };
    });
  };

  const progress: { userId: number; moduleId: number; startedAt: Date; lastPositionSeconds: number; completedAt: Date | null }[] = [];
  const responses: ReturnType<typeof responsesFor> = [];
  for (const c of COMPLETED) {
    const { module, video } = rowsOf(c.slug);
    const completedAt = daysBefore(now, c.daysAgo);
    const startedAt = new Date(completedAt.getTime() - Math.round(video.duration * 1.4) * 1000);
    progress.push({ userId, moduleId: module.id, startedAt, lastPositionSeconds: video.duration, completedAt });
    responses.push(...responsesFor(c.slug, c.picks, startedAt));
  }
  {
    const { module, video } = rowsOf(IN_PROGRESS.slug);
    const startedAt = daysBefore(now, IN_PROGRESS.startedDaysAgo);
    progress.push({ userId, moduleId: module.id, startedAt, lastPositionSeconds: Math.round(video.duration * IN_PROGRESS.positionFraction), completedAt: null });
    responses.push(...responsesFor(IN_PROGRESS.slug, IN_PROGRESS.picks, startedAt));
  }
  const ratings = RATINGS.flatMap((set) =>
    Object.entries(set.ratings).map(([slug, [rating, mark]]) => ({
      studentId: userId,
      raterKind: set.raterKind,
      raterName: set.raterName,
      virtueId: vid(slug),
      rating,
      mark,
      notes: set.notes?.[slug as keyof typeof set.notes] ?? null,
      ratedAt: daysBefore(now, set.daysAgo),
    })),
  );

  await db.orm.public.ModuleProgress.createAll(progress);
  await db.orm.public.InteractionResponse.createAll(responses);
  await db.orm.public.VirtueRating.createAll(ratings);
  return { progress: progress.length, responses: responses.length, ratings: ratings.length };
}

/** demo:reset: puts a demo student back to the designed state. Leaves content and every other user alone. */
export async function resetStudent(userId: number, now: Date = new Date()) {
  await clearStudentHistory(userId);
  return seedStudentHistory(userId, now);
}

export { VIRTUE_SLUGS, accountByKey };
