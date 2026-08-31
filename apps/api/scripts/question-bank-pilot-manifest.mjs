import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CreateQuestionBankDraftInputSchema, QuestionAnswerSchema } from "@study/contracts";
import { z } from "zod";

const PilotQuestionSchema = z.object({
  knowledgeNodeTitles: z.array(z.string().trim().min(1).max(160)).min(1).max(10),
  draft: z.record(z.string(), z.unknown()),
  solverExplanation: z.string().trim().min(8).max(10_000),
  factCheckNotes: z.string().trim().min(4).max(2_000),
}).strict();

const PilotManifestSchema = z.object({
  schemaVersion: z.literal(1),
  textbookEditionId: z.uuid(),
  unitTitle: z.string().trim().min(1).max(160),
  releaseStatus: z.literal("PILOT_DRAFT_HUMAN_REVIEW_REQUIRED"),
  questions: z.array(PilotQuestionSchema).min(1).max(100),
}).strict();

const dummyUuid = "00000000-0000-4000-8000-000000000000";

export async function readQuestionBankPilot(pathArgument) {
  if (pathArgument === undefined || pathArgument.trim().length === 0) {
    throw new Error("A question-bank Pilot JSON path is required");
  }
  const manifestPath = resolve(pathArgument);
  const manifest = PilotManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  const stableKeys = new Set();
  for (const question of manifest.questions) {
    const parsed = CreateQuestionBankDraftInputSchema.parse({
      ...question.draft,
      textbookEditionId: manifest.textbookEditionId,
      unitId: dummyUuid,
      knowledgeNodeIds: [dummyUuid],
    });
    QuestionAnswerSchema.parse(parsed.answer);
    if (stableKeys.has(parsed.stableKey)) throw new Error(`Duplicate Pilot stableKey: ${parsed.stableKey}`);
    stableKeys.add(parsed.stableKey);
  }
  return { manifestPath, manifest };
}

export function questionBankPilotSummary(manifest) {
  const types = {};
  const knowledgeNodes = new Set();
  for (const question of manifest.questions) {
    const type = question.draft.type;
    if (typeof type === "string") types[type] = (types[type] ?? 0) + 1;
    for (const title of question.knowledgeNodeTitles) knowledgeNodes.add(title);
  }
  return { questions: manifest.questions.length, knowledgeNodes: knowledgeNodes.size, types };
}
