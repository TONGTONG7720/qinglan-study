import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CreateTextbookDraftInputSchema } from "@study/contracts";
import { z } from "zod";

const NodeSchema = z.tuple([z.string().trim().min(1).max(160), z.number().int().positive().max(2000)]);
const SourceSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.string().min(8),
  reviewStatus: z.string().min(8),
  resolvedDirectoryEvidence: z.object({ grade: z.literal(7), volume: z.literal("下册"), contentId: z.uuid(), status: z.literal("ONLINE_CURRENT_EDITION_DIRECTORY_RECOVERED"), url: z.string().url(), evidence: z.string(), reviewStatus: z.literal("ADMIN_REVIEW_REQUIRED") }).strict(),
  books: z.array(z.object({
    grade: z.union([z.literal(7), z.literal(8), z.literal(9)]),
    volume: z.enum(["上册", "下册"]),
    contentId: z.uuid(),
    catalogTimestamp: z.string().regex(/^\d{13}$/u),
    units: z.array(z.object({ title: z.string().trim().min(1).max(160), pageStart: z.number().int().positive(), nodes: z.array(NodeSchema).min(1) }).strict()).min(1),
  }).strict()).length(5),
}).strict();

const root = resolve(import.meta.dirname, "../../..");
const source = SourceSchema.parse(JSON.parse(await readFile(resolve(root, "data/curriculum/sources/unified-history-2022-toc.json"), "utf8")));
const outputPath = resolve(root, "data/curriculum/unified-history-5-volumes-2022.DRAFT.json");
const recoveredOutputPath = resolve(root, "data/curriculum/unified-history-grade7-lower-2022.DRAFT.json");
const drafts = source.books.map((book) => {
  const starts = book.units.flatMap((unit) => unit.nodes.map((node) => node[1]));
  if (starts.some((start, index) => index > 0 && start < starts[index - 1])) throw new Error(`Non-monotonic page starts in History G${String(book.grade)} ${book.volume}`);
  return CreateTextbookDraftInputSchema.parse({
    subjectCode: "HISTORY",
    grade: book.grade,
    publisher: "人民教育出版社",
    editionName: "义务教育教科书（根据2022年版课程标准修订）·统编版",
    volume: book.volume,
    units: book.units.map((unit, unitIndex) => ({
      ordinal: unitIndex + 1,
      title: unit.title,
      knowledgeNodes: unit.nodes.map(([title, pageStart], nodeIndex) => {
        const boundary = unit.nodes[nodeIndex + 1]?.[1] ?? book.units[unitIndex + 1]?.pageStart ?? pageStart + 1;
        const activity = title.includes("活动课");
        return {
          title,
          objective: activity
            ? `围绕“${title}”搜集和辨析史料，运用时空观念与史料实证方法形成有依据的历史解释。`
            : `了解“${title}”的基本史实，梳理时空线索、原因与影响，并能依据史料作出符合证据的历史解释。`,
          prerequisiteKnowledge: ["历史纪年、时间顺序和历史地图的基本阅读方法", "上一课或上一单元形成的时空与因果线索"],
          commonErrors: activity
            ? ["把传说或影视情节直接当成可靠史料", "引用材料却不说明材料能够支持的结论"]
            : ["混淆历史事件的先后顺序和所处时代", "只记结论而忽略原因、条件和影响", "用现代观点替代对具体历史情境的分析"],
          abilityLevels: activity ? ["APPLY", "ANALYZE", "EVALUATE", "CREATE"] : ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE"],
          questionTypes: activity
            ? ["SHORT_ANSWER", "ERROR_DIAGNOSIS"]
            : ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
          pageStart,
          pageEnd: Math.max(pageStart, boundary - 1),
          contentVersion: "2022-curriculum-standard-v1",
        };
      }),
    })),
    confirmation: "CREATE_TEXTBOOK_DRAFT",
  });
});

await writeFile(outputPath, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
const recovered = drafts.filter((draft) => draft.grade === 7 && draft.volume === "下册");
if (recovered.length !== 1) throw new Error("Recovered History G7 lower draft is missing");
await writeFile(recoveredOutputPath, `${JSON.stringify(recovered, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({
  outputPath,
  recoveredOutputPath,
  textbooks: drafts.length,
  blockedTextbooks: 0,
  units: drafts.reduce((count, draft) => count + draft.units.length, 0),
  knowledgeNodes: drafts.reduce((count, draft) => count + draft.units.reduce((sum, unit) => sum + unit.knowledgeNodes.length, 0), 0),
}));
