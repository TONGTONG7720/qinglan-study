import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CreateTextbookDraftInputSchema } from "@study/contracts";
import { z } from "zod";

const NodeSchema = z.tuple([z.string().trim().min(1).max(160), z.number().int().positive().max(2_000)]);
const CommonBookSchema = z.object({
  volume: z.string().trim().min(1).max(80),
  publisher: z.string().trim().min(1).max(120),
  editionName: z.string().trim().min(1).max(120),
  approvalLabel: z.string().trim().min(1).max(120),
  contentId: z.uuid(),
  previewAssetId: z.uuid(),
  catalogTimestamp: z.string().regex(/^\d{10,16}$/u),
  finalPage: z.number().int().positive().max(2_000),
});
const NonEnglishBookSchema = CommonBookSchema.extend({
  subjectCode: z.enum(["CHINESE", "MATH", "MORALITY", "HISTORY"]),
  units: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    nodes: z.array(NodeSchema).min(1).max(100),
  }).strict()).min(1).max(100),
}).strict();
const EnglishBookSchema = CommonBookSchema.extend({
  subjectCode: z.literal("ENGLISH"),
  units: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    topic: z.string().trim().min(1).max(160),
    function: z.string().trim().min(1).max(240),
    structure: z.string().trim().min(1).max(240),
    pageStart: z.number().int().positive().max(2_000),
  }).strict()).min(1).max(100),
}).strict();
const SourceSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.string().trim().min(8),
  reviewStatus: z.literal("OFFICIAL_PLATFORM_EXTRACTED_HOUSEHOLD_ADMIN_REVIEW_REQUIRED"),
  books: z.array(z.union([NonEnglishBookSchema, EnglishBookSchema])).length(5),
}).strict();

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const sourcePath = resolve(repositoryRoot, "data/curriculum/sources/legacy-grade9-current-use-toc.json");
const outputPath = resolve(repositoryRoot, "data/curriculum/legacy-grade9-current-use-candidates.DRAFT.json");
const source = SourceSchema.parse(JSON.parse(await readFile(sourcePath, "utf8")));
const drafts = source.books.map((book) => (
  book.subjectCode === "ENGLISH" ? englishDraft(book) : nonEnglishDraft(book)
));
if (new Set(drafts.map((draft) => `${draft.subjectCode}:${draft.grade}:${draft.volume}:${draft.editionName}`)).size !== drafts.length) {
  throw new Error("Legacy grade-9 textbook drafts contain duplicate identities");
}
await writeFile(outputPath, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({
  outputPath,
  textbooks: drafts.length,
  units: drafts.reduce((sum, draft) => sum + draft.units.length, 0),
  knowledgeNodes: drafts.reduce(
    (sum, draft) => sum + draft.units.reduce((unitSum, unit) => unitSum + unit.knowledgeNodes.length, 0),
    0,
  ),
  reviewStatus: source.reviewStatus,
}));

function nonEnglishDraft(book) {
  const starts = book.units.flatMap((unit) => unit.nodes.map((node) => node[1]));
  if (starts.some((start, index) => index > 0 && start <= starts[index - 1])) {
    throw new Error(`Legacy ${book.subjectCode} page starts must be strictly increasing`);
  }
  let index = 0;
  return CreateTextbookDraftInputSchema.parse({
    subjectCode: book.subjectCode,
    grade: 9,
    publisher: book.publisher,
    editionName: book.editionName,
    volume: book.volume,
    units: book.units.map((unit, unitIndex) => ({
      ordinal: unitIndex + 1,
      title: unit.title,
      knowledgeNodes: unit.nodes.map(([title, pageStart]) => {
        const nextStart = starts[index + 1] ?? book.finalPage + 1;
        index += 1;
        return metadata(book.subjectCode, title, pageStart, Math.max(pageStart, nextStart - 1), book.approvalLabel);
      }),
    })),
    confirmation: "CREATE_TEXTBOOK_DRAFT",
  });
}

function englishDraft(book) {
  return CreateTextbookDraftInputSchema.parse({
    subjectCode: "ENGLISH",
    grade: 9,
    publisher: book.publisher,
    editionName: book.editionName,
    volume: book.volume,
    units: book.units.map((unit, index) => {
      const pageEnd = (book.units[index + 1]?.pageStart ?? book.finalPage + 1) - 1;
      const common = {
        prerequisiteKnowledge: ["七、八年级主题词汇、语音和常用交际表达", "基本句子结构、段落主旨和上下文推断能力"],
        commonErrors: ["机械套用句型而忽略语境和交际意图", "时态、人称、主谓一致或语序错误", "只逐词翻译而没有把握语篇主旨"],
        abilityLevels: ["UNDERSTAND", "APPLY", "ANALYZE", "CREATE"],
        questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
        pageStart: unit.pageStart,
        pageEnd,
        contentVersion: "legacy-2013-reviewed-candidate-v1",
      };
      return {
        ordinal: index + 1,
        title: unit.title,
        knowledgeNodes: [
          { title: `Communication: ${unit.function}`, objective: `围绕“${unit.title}”理解并运用交际功能“${unit.function}”，在真实语境中准确、得体地获取或表达信息。`, ...common },
          { title: `Language structures: ${unit.structure}`, objective: `结合“${unit.topic}”主题理解并运用“${unit.structure}”，能够辨析形式、意义和使用条件。`, ...common },
          { title: `Reading and writing: ${unit.topic}`, objective: `围绕“${unit.topic}”阅读、提取和整合语篇信息，并完成内容连贯、语言基本准确的书面表达。`, ...common },
        ],
      };
    }),
    confirmation: "CREATE_TEXTBOOK_DRAFT",
  });
}

function metadata(subjectCode, title, pageStart, pageEnd, approvalLabel) {
  const profiles = {
    CHINESE: {
      objective: `围绕“${title}”开展阅读、鉴赏或表达，能依据文本证据理解内容、语言和思想，并形成有条理的口头或书面表达。`,
      prerequisiteKnowledge: ["初中阶段现代文、古诗文和名著阅读基础", "概括、赏析、比较、论证和写作修改能力"],
      commonErrors: ["脱离文本证据作空泛判断", "把作者、人物和叙述者观点混为一谈", "表达缺少结构、引用或具体分析"],
      abilityLevels: ["UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"],
      questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
    },
    MATH: {
      objective: `理解“${title}”的核心概念、性质、条件和方法，能进行规范推理、计算或作图，并解决基础与实际问题。`,
      prerequisiteKnowledge: ["代数式、方程、函数和几何推理基础", "数形结合、分类讨论和规范计算能力"],
      commonErrors: ["忽略定义域、条件或图形位置关系", "只套公式而没有说明依据", "计算、符号、单位或推理步骤不规范"],
      abilityLevels: ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "CREATE"],
      questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "CALCULATION", "SHORT_ANSWER", "GRAPHING", "ERROR_DIAGNOSIS"],
    },
    MORALITY: {
      objective: `围绕“${title}”理解个人、国家与世界之间的关系，能依据事实、规则和公共价值分析情境并提出负责任的行动。`,
      prerequisiteKnowledge: ["个人成长、社会规则、国家发展与世界关系的基础认识", "区分事实、观点、权利、责任和价值判断的能力"],
      commonErrors: ["用口号代替事实和理由", "忽略情境中的权利责任与现实条件", "把单一案例无限扩大为普遍结论"],
      abilityLevels: ["UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"],
      questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
    },
    HISTORY: {
      objective: `围绕“${title}”把握时序、空间、人物、事件及其联系，能依据史料解释原因、过程、影响和历史意义。`,
      prerequisiteKnowledge: ["世界近现代史基本时序和区域概念", "从材料中提取史实、观点与证据的能力"],
      commonErrors: ["混淆历史时序、地域或历史主体", "以结论代替史料证据和因果分析", "用今天的概念简单套用历史情境"],
      abilityLevels: ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE"],
      questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
    },
  };
  const profile = profiles[subjectCode];
  if (profile === undefined) throw new Error(`Unsupported legacy subject ${subjectCode}`);
  return {
    title,
    objective: profile.objective,
    prerequisiteKnowledge: profile.prerequisiteKnowledge,
    commonErrors: profile.commonErrors,
    abilityLevels: profile.abilityLevels,
    questionTypes: profile.questionTypes,
    pageStart,
    pageEnd,
    contentVersion: `${approvalLabel.includes("2013") ? "legacy-2013" : "legacy-2018"}-reviewed-candidate-v1`,
  };
}
