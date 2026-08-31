import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CreateTextbookDraftInputSchema } from "@study/contracts";
import { z } from "zod";

const NodeSchema = z.tuple([z.string().trim().min(1).max(160), z.number().int().positive().max(2000)]);
const SourceSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.string().min(8),
  reviewStatus: z.string().min(8),
  books: z.array(z.object({
    grade: z.union([z.literal(7), z.literal(8), z.literal(9)]),
    volume: z.enum(["上册", "下册"]),
    contentId: z.uuid(),
    catalogTimestamp: z.string().regex(/^\d{13}$/u),
    units: z.array(z.object({
      title: z.string().trim().min(1).max(160),
      pageStart: z.number().int().positive().max(2000),
      nodes: z.array(NodeSchema).min(1).max(100),
    }).strict()).min(1).max(20),
  }).strict()).length(5),
}).strict();

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const sourcePath = resolve(repositoryRoot, "data/curriculum/sources/unified-morality-2022-toc.json");
const outputPath = resolve(repositoryRoot, "data/curriculum/unified-morality-5-volumes-2022.DRAFT.json");
const source = SourceSchema.parse(JSON.parse(await readFile(sourcePath, "utf8")));

const drafts = source.books.map((book) => {
  const starts = book.units.flatMap((unit) => unit.nodes.map((node) => node[1]));
  if (starts.some((start, index) => index > 0 && start < starts[index - 1])) {
    throw new Error(`Non-monotonic page starts in grade ${String(book.grade)} ${book.volume}`);
  }
  const units = book.units.map((unit, unitIndex) => ({
    ordinal: unitIndex + 1,
    title: unit.title,
    knowledgeNodes: unit.nodes.map(([title, pageStart], nodeIndex) => {
      const nextInUnit = unit.nodes[nodeIndex + 1]?.[1];
      const nextUnit = book.units[unitIndex + 1]?.pageStart;
      const boundary = nextInUnit ?? nextUnit ?? pageStart + 1;
      const action = title === "单元思考与行动";
      const topic = title.includes("｜") ? title.split("｜").at(-1) ?? title : unit.title.replace(/^第[一二三四五六七八九十]+单元\s*/u, "");
      return {
        title,
        objective: action
          ? `综合运用“${topic}”相关观点分析生活与社会情境，形成有依据的判断和行动方案。`
          : `理解“${topic}”的核心观点，能联系个人成长与社会生活情境进行辨析、说明和实践。`,
        prerequisiteKnowledge: moralityPrerequisites(book.grade, topic),
        commonErrors: action
          ? ["只罗列观点而没有结合具体情境", "提出行动建议但缺少理由或可执行步骤"]
          : ["只记结论而忽略观点成立的条件和情境", "用单一事例代替完整观点", "混淆事实判断、价值判断和行为要求"],
        abilityLevels: action ? ["APPLY", "ANALYZE", "EVALUATE", "CREATE"] : ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"],
        questionTypes: action
          ? ["SHORT_ANSWER", "ERROR_DIAGNOSIS"]
          : ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
        pageStart,
        pageEnd: Math.max(pageStart, boundary - 1),
        contentVersion: "2022-curriculum-standard-v1",
      };
    }),
  }));
  return CreateTextbookDraftInputSchema.parse({
    subjectCode: "MORALITY",
    grade: book.grade,
    publisher: "人民教育出版社",
    editionName: "义务教育教科书（根据2022年版课程标准修订）·统编版",
    volume: book.volume,
    units,
    confirmation: "CREATE_TEXTBOOK_DRAFT",
  });
});

await writeFile(outputPath, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({
  outputPath,
  textbooks: drafts.length,
  units: drafts.reduce((count, draft) => count + draft.units.length, 0),
  knowledgeNodes: drafts.reduce((count, draft) => count + draft.units.reduce((sum, unit) => sum + unit.knowledgeNodes.length, 0), 0),
}));

function moralityPrerequisites(grade, topic) {
  const base = ["小学道德与法治课程中的个人、家庭、社会和国家基础认识", "与当前主题相关的真实生活经验"];
  if (grade >= 8) base.push("运用规则、权利义务和公共生活观点分析情境的基础能力");
  if (/法|宪法|权利|义务|国家机构/u.test(topic)) base.push("法律规范与社会规则的基本区别");
  return base;
}
