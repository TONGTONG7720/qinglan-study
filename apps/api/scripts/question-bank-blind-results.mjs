import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  GradeSchema,
  IndependentQuestionBankSolverResultSchema,
  QuestionBankTypeSchema,
  SubjectCodeSchema,
} from "@study/contracts";
import { z } from "zod";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

const BlindQuestionOptionSchema = z.object({
  key: z.string().trim().min(1).max(10),
  label: z.string().trim().min(1).max(1_000),
}).strict();

const BlindQuestionSchema = z.object({
  questionBankItemId: z.uuid(),
  stableKey: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{7,119}$/u),
  subjectCode: SubjectCodeSchema,
  grade: GradeSchema,
  type: QuestionBankTypeSchema,
  stem: z.string().trim().min(8).max(10_000),
  options: z.array(BlindQuestionOptionSchema).min(2).max(10).nullable(),
  knowledgeNodeIds: z.array(z.uuid()).min(1).max(10),
}).strict();

export async function readBlindSolverResults(resultsPathArgument, inputPathArgument) {
  if (resultsPathArgument === undefined || resultsPathArgument.trim().length === 0) {
    throw new Error("A blind-solver results JSONL path is required");
  }
  const inputPath = resolve(inputPathArgument ?? resolve(repositoryRoot, "data/question-bank/review/blind-solver-input.jsonl"));
  const resultsPath = resolve(resultsPathArgument);
  const questions = await readJsonLines(inputPath, BlindQuestionSchema, "blind question");
  const results = await readJsonLines(
    resultsPath,
    IndependentQuestionBankSolverResultSchema,
    "blind solver result",
  );
  if (questions.length === 0) throw new Error("The blind-solver input package is empty");
  const questionsById = uniqueMap(questions, "questionBankItemId", "blind question ID");
  uniqueMap(questions, "stableKey", "blind question stableKey");
  const resultsById = uniqueMap(results, "questionBankItemId", "blind solver result ID");
  uniqueMap(results, "stableKey", "blind solver result stableKey");
  if (results.length !== questions.length) {
    throw new Error(`Blind-solver result count ${String(results.length)} does not match question count ${String(questions.length)}`);
  }
  for (const [id, question] of questionsById) {
    const result = resultsById.get(id);
    if (result === undefined) throw new Error(`Blind-solver result is missing question ${question.stableKey}`);
    if (result.stableKey !== question.stableKey) {
      throw new Error(`Blind-solver stableKey mismatch for question ${question.stableKey}`);
    }
  }
  for (const result of results) {
    if (!questionsById.has(result.questionBankItemId)) {
      throw new Error(`Blind-solver result references an unknown question ${result.stableKey}`);
    }
  }
  return { inputPath, resultsPath, questions, results };
}

export function blindSolverCoverage(questions, results) {
  return {
    questions: questions.length,
    results: results.length,
    bySubject: counts(questions, (question) => question.subjectCode),
    byQuestionType: counts(questions, (question) => question.type),
    bySolverKind: counts(results, (result) => result.solverKind),
    attestationsValid: results.every((result) => result.attestation === "ANSWERED_WITHOUT_REFERENCE_ACCESS"),
  };
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
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
    if (!result.success) {
      throw new Error(`${label} schema is invalid at line ${String(index + 1)}`);
    }
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

function counts(records, selector) {
  const values = {};
  for (const record of records) {
    const key = selector(record);
    values[key] = (values[key] ?? 0) + 1;
  }
  return values;
}
