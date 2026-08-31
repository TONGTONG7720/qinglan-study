import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CreateTextbookDraftInputSchema,
  isSubjectAvailableForGrade,
} from "@study/contracts";

const placeholderPattern = /(?:待确认|待补充|请替换|示例|虚构|DEVELOPMENT_FIXTURE|TBD|TODO|UNKNOWN)/iu;

export async function readCurriculumDrafts(pathArgument) {
  if (pathArgument === undefined || pathArgument.trim().length === 0) {
    throw new Error("A curriculum draft JSON path is required");
  }
  const manifestPath = resolve(pathArgument);
  const decoded = JSON.parse(await readFile(manifestPath, "utf8"));
  const drafts = CreateTextbookDraftInputSchema.array().min(1).max(100).parse(decoded);
  const identities = new Set();

  for (const draft of drafts) {
    if (!isSubjectAvailableForGrade(draft.grade, draft.subjectCode)) {
      throw new Error(`Subject ${draft.subjectCode} is not enabled for grade ${String(draft.grade)}`);
    }
    const identity = [
      draft.subjectCode,
      String(draft.grade),
      draft.publisher,
      draft.editionName,
      draft.volume,
    ].join("|");
    if (identities.has(identity)) {
      throw new Error(`Duplicate textbook identity: ${identity}`);
    }
    identities.add(identity);

    const reviewValues = [
      draft.publisher,
      draft.editionName,
      draft.volume,
      ...draft.units.flatMap((unit) => [
        unit.title,
        ...unit.knowledgeNodes.flatMap((node) => [node.title, node.objective]),
      ]),
    ];
    if (reviewValues.some((value) => placeholderPattern.test(value))) {
      throw new Error(`Textbook ${identity} still contains placeholder or fictional content`);
    }
  }

  return { manifestPath, drafts };
}

export function curriculumDraftSummary(drafts) {
  return {
    textbooks: drafts.length,
    units: drafts.reduce((count, draft) => count + draft.units.length, 0),
    knowledgeNodes: drafts.reduce(
      (count, draft) => count + draft.units.reduce(
        (unitCount, unit) => unitCount + unit.knowledgeNodes.length,
        0,
      ),
      0,
    ),
  };
}
