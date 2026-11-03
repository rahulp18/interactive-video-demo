import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInteraction, updateInteraction } from "@/lib/interactions/service";
import { normalizeAnswer, validateInteraction } from "@/lib/interactions/model";
import { getResponseSummary, responsesToCsv } from "@/lib/responses/service";
import { checkPublicAnswer, enableSharing, getPublicVideo } from "@/lib/watch/service";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

describe("text answers", () => {
  const base = { timestamp: 5, question: "Q?", isSkippable: false };

  it("validates TEXT interactions", () => {
    expect(validateInteraction({ ...base, type: "SURVEY", answerType: "TEXT" }, 60).value).toMatchObject({ answerType: "TEXT", options: [], correctAnswer: null });
    expect(validateInteraction({ ...base, type: "QUIZ", answerType: "TEXT", correctAnswer: "  Paris  " }, 60).value?.correctAnswer).toBe("Paris");
    expect(validateInteraction({ ...base, type: "QUIZ", answerType: "TEXT" }, 60).errors).toHaveProperty("correctAnswer");
    expect(validateInteraction({ ...base, type: "SURVEY", answerType: "TEXT", options: [{ text: "a" }] }, 60).errors).toHaveProperty("options");
    expect(validateInteraction({ ...base, type: "SURVEY", answerType: "NOPE" }, 60).errors).toHaveProperty("answerType");
    // default stays multiple choice
    expect(validateInteraction({ ...base, type: "SURVEY", options: [{ text: "a" }, { text: "b" }] }, 60).value?.answerType).toBe("CHOICE");
  });

  it("normalises typed answers", () => {
    expect(normalizeAnswer("  PARIS \n")).toBe("paris");
    expect(normalizeAnswer("New   York")).toBe("new york");
  });

  describe("end to end", () => {
    const emails: string[] = [];
    let owner = 0, viewer = 0, videoId = 0, shareId = "", quizId = 0, surveyId = 0;
    beforeAll(async () => {
      const mk = async (l: string) => {
        const email = `${l}-${randomUUID()}@example.com`;
        emails.push(email);
        return (await db.orm.public.User.create({ name: l, email, password: "x" })).id;
      };
      owner = await mk("txt-owner");
      viewer = await mk("txt-viewer");
      const key = `key-${randomUUID()}`;
      videoId = (await db.orm.public.Video.create({ title: "T", fileUrl: `https://example.ufs.sh/f/${key}`, duration: 60, mimeType: "video/mp4", originalName: "t.mp4", sizeBytes: 1, fileKey: key, uploaderId: owner })).id;
      quizId = (await createInteraction(owner, videoId, { ...base, type: "QUIZ", answerType: "TEXT", correctAnswer: "Paris", question: "Capital of France?" })).id;
      surveyId = (await createInteraction(owner, videoId, { ...base, timestamp: 2, type: "SURVEY", answerType: "TEXT", isSkippable: true, question: "Any feedback?" })).id;
      shareId = await enableSharing(owner, videoId);
    });
    afterAll(async () => {
      for (const email of emails) {
        const u = await db.orm.public.User.where({ email }).first();
        if (u) {
          await db.orm.public.Video.where({ uploaderId: u.id }).deleteAll();
          await db.orm.public.User.where({ id: u.id }).deleteAll();
        }
      }
    });

    it("never exposes the expected answer before answering, and has no options", async () => {
      const pub = (await getPublicVideo(shareId))!;
      expect(pub.interactions.every((i) => i.answerType === "TEXT" && i.options.length === 0)).toBe(true);
      expect(JSON.stringify(pub)).not.toMatch(/Paris|correctAnswer/);
    });

    it("grades typed quiz answers case/space-insensitively and reveals the expected answer afterwards", async () => {
      expect(await checkPublicAnswer(shareId, quizId, { text: "  pARIS " })).toEqual({ type: "QUIZ", correct: true, correctOptionId: null, correctAnswer: "Paris" });
      expect(await checkPublicAnswer(shareId, quizId, { text: "Lyon" })).toMatchObject({ correct: false, correctAnswer: "Paris" });
    });

    it("rejects empty, oversized and wrong-shaped answers", async () => {
      for (const body of [{ text: "   " }, { text: "x".repeat(501) }, { optionId: 1 }, {}, { text: 5 }]) {
        await expect(checkPublicAnswer(shareId, quizId, body)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      }
    });

    it("stores typed answers for signed-in viewers (first stands) and summarises them", async () => {
      await checkPublicAnswer(shareId, quizId, { text: "paris" }, viewer);
      await checkPublicAnswer(shareId, quizId, { text: "Rome" }, viewer); // replay: ignored
      await checkPublicAnswer(shareId, surveyId, { text: "Loved it, <b>great</b>" }, viewer);
      const rows = await db.orm.public.InteractionResponse.where({ userId: viewer }).all();
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.selectedOptionId === null && r.isSkipped === false && r.textAnswer !== null)).toBe(true);

      const s = await getResponseSummary(owner, videoId);
      const survey = s.interactions.find((i) => i.id === surveyId)!;
      const quiz = s.interactions.find((i) => i.id === quizId)!;
      expect(survey.textAnswers).toEqual([{ text: "Loved it, <b>great</b>", name: "txt-viewer", correct: null }]);
      expect(quiz.textAnswers[0]).toMatchObject({ text: "paris", correct: true });
      expect(quiz.correctRate).toBe(1);
      expect(s.respondents[0]).toMatchObject({ answered: 2, correct: 1 });
      expect(responsesToCsv(s)).toContain("Loved it");
    });

    it("the database refuses a response carrying both an option and text", async () => {
      const made = await createInteraction(owner, videoId, { ...base, timestamp: 9, type: "SURVEY", question: "Pick", options: [{ text: "a" }, { text: "b" }] });
      await expect(
        db.orm.public.InteractionResponse.create({ userId: viewer, interactionId: made.id, selectedOptionId: made.options[0].id, textAnswer: "both", isSkipped: false }),
      ).rejects.toBeTruthy();
    });

    it("switching a question between choice and text keeps the data consistent", async () => {
      const c = await createInteraction(owner, videoId, { ...base, timestamp: 11, type: "SURVEY", question: "Switch", options: [{ text: "a" }, { text: "b" }] });
      const asText = await updateInteraction(owner, videoId, c.id, { ...base, timestamp: 11, type: "SURVEY", answerType: "TEXT", question: "Switch" });
      expect(asText).toMatchObject({ answerType: "TEXT", options: [] });
      const back = await updateInteraction(owner, videoId, c.id, { ...base, timestamp: 11, type: "SURVEY", answerType: "CHOICE", question: "Switch", options: [{ text: "x" }, { text: "y" }] });
      expect(back.options.map((o) => o.text)).toEqual(["x", "y"]);
    });
  });
});
