import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  GradeSchema,
  SubjectCodeSchema,
  TextbookPhysicalCopyReviewResultSchema,
} from "@study/contracts";
import { z } from "zod";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

const ReviewDirectoryEntrySchema = z.object({
  ordinal: z.number().int().positive().max(200),
  title: z.string().trim().min(1).max(160),
}).strict();

const PhysicalReviewInputSchema = z.object({
  textbookEditionId: z.uuid(),
  subjectCode: SubjectCodeSchema,
  grade: GradeSchema,
  publisher: z.string().trim().min(1).max(120),
  editionName: z.string().trim().min(1).max(120),
  volume: z.string().trim().min(1).max(80),
  status: z.enum(["DRAFT", "CONFIRMED"]),
  unitCount: z.number().int().positive().max(200),
  knowledgeNodeCount: z.number().int().positive().max(10_000),
  directory: z.array(ReviewDirectoryEntrySchema).min(1).max(200),
}).strict();

export async function readPhysicalCopyReviews(resultsPathArgument, inputPathArgument) {
  if (resultsPathArgument === undefined || resultsPathArgument.trim().length === 0) {
    throw new Error("A physical-copy review results JSONL path is required");
  }
  const inputPath = resolve(inputPathArgument ?? resolve(repositoryRoot, "data/curriculum/review/physical-copy-review-input.jsonl"));
  const resultsPath = resolve(resultsPathArgument);
  const textbooks = await readJsonLines(inputPath, PhysicalReviewInputSchema, "physical-copy review input");
  const reviews = await readJsonLines(resultsPath, TextbookPhysicalCopyReviewResultSchema, "physical-copy review result");
  if (textbooks.length === 0) throw new Error("The physical-copy review input package is empty");
  if (reviews.length === 0) throw new Error("The physical-copy review results file is empty");
  const textbooksById = uniqueMap(textbooks, "textbookEditionId", "textbook review input ID");
  const reviewsById = uniqueMap(reviews, "textbookEditionId", "textbook review result ID");
  for (const review of reviews) {
    if (!textbooksById.has(review.textbookEditionId)) {
      throw new Error(`Physical-copy review references an unknown textbook ${review.textbookEditionId}`);
    }
  }
  return { inputPath, resultsPath, textbooks, reviews, textbooksById, reviewsById };
}

export function physicalCopyReviewSummary(textbooks, reviews, textbooksById) {
  const decisions = {};
  const evaluated = reviews.map((review) => {
    const textbook = textbooksById.get(review.textbookEditionId);
    if (textbook === undefined) throw new Error(`Physical-copy review input disappeared for ${review.textbookEditionId}`);
    const mismatchFields = [];
    if (!sameText(review.observedPublisher, textbook.publisher)) mismatchFields.push("publisher");
    if (!sameText(review.observedEditionName, textbook.editionName)) mismatchFields.push("editionName");
    if (!sameText(review.observedVolume, textbook.volume)) mismatchFields.push("volume");
    decisions[review.overallDecision] = (decisions[review.overallDecision] ?? 0) + 1;
    return {
      textbookEditionId: review.textbookEditionId,
      subjectCode: textbook.subjectCode,
      grade: textbook.grade,
      volume: textbook.volume,
      overallDecision: review.overallDecision,
      directoryDecision: review.directoryDecision,
      currentUseConfirmed: review.currentUseConfirmed,
      mismatchFields,
      readyForSeparateAdminConfirmation:
        review.overallDecision === "MATCH"
        && review.directoryDecision === "MATCH"
        && review.currentUseConfirmed
        && mismatchFields.length === 0,
    };
  });
  return {
    textbooks: textbooks.length,
    reviewed: reviews.length,
    remaining: textbooks.length - reviews.length,
    complete: reviews.length === textbooks.length,
    decisions,
    readyForSeparateAdminConfirmation: evaluated
      .filter((entry) => entry.readyForSeparateAdminConfirmation)
      .map((entry) => entry.textbookEditionId),
    needsAttention: evaluated.filter((entry) => !entry.readyForSeparateAdminConfirmation),
  };
}

async function readJsonLines(path, schema, label) {
  const lines = (await readFile(path, "utf8")).split(/\r?\n/u);
  const parsed = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.length === 0) continue;
    let json;
    try {
      json = JSON.parse(line);
    } catch {
      throw new Error(`${label} JSON is invalid at line ${String(index + 1)}`);
    }
    const result = schema.safeParse(json);
    if (!result.success) throw new Error(`${label} schema is invalid at line ${String(index + 1)}`);
    parsed.push(result.data);
  }
  return parsed;
}

function uniqueMap(records, key, label) {
  const map = new Map();
  for (const record of records) {
    const value = record[key];
    if (map.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    map.set(value, record);
  }
  return map;
}

function sameText(left, right) {
  return left.normalize("NFKC").replace(/\s+/gu, " ").trim()
    === right.normalize("NFKC").replace(/\s+/gu, " ").trim();
}
