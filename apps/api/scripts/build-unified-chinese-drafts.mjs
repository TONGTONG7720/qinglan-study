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
    units: z.array(z.object({ title: z.string().trim().min(1).max(160), pageStart: z.number().int().positive(), nodes: z.array(NodeSchema).min(1) }).strict()).min(1),
  }).strict()).length(5),
}).strict();

const root = resolve(import.meta.dirname, "../../..");
const source = SourceSchema.parse(JSON.parse(await readFile(resolve(root, "data/curriculum/sources/unified-chinese-2022-toc.json"), "utf8")));
const outputPath = resolve(root, "data/curriculum/unified-chinese-5-volumes-2022.DRAFT.json");
const drafts = source.books.map((book) => {
  const starts = book.units.flatMap((unit) => unit.nodes.map((node) => node[1]));
  if (starts.some((start, index) => index > 0 && start < starts[index - 1])) throw new Error(`Non-monotonic page starts in Chinese G${String(book.grade)} ${book.volume}`);
  return CreateTextbookDraftInputSchema.parse({
    subjectCode: "CHINESE",
    grade: book.grade,
    publisher: "人民教育出版社",
    editionName: "义务教育教科书（根据2022年版课程标准修订）·统编版",
    volume: book.volume,
    units: book.units.map((unit, unitIndex) => ({
      ordinal: unitIndex + 1,
      title: unit.title,
      knowledgeNodes: unit.nodes.map(([title, pageStart], nodeIndex) => {
        const boundary = unit.nodes[nodeIndex + 1]?.[1] ?? book.units[unitIndex + 1]?.pageStart ?? pageStart + 1;
        const profile = chineseProfile(title);
        return {
          title,
          objective: profile.objective,
          prerequisiteKnowledge: profile.prerequisites,
          commonErrors: profile.commonErrors,
          abilityLevels: profile.abilityLevels,
          questionTypes: profile.questionTypes,
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
process.stdout.write(JSON.stringify({
  outputPath,
  textbooks: drafts.length,
  units: drafts.reduce((count, draft) => count + draft.units.length, 0),
  knowledgeNodes: drafts.reduce((count, draft) => count + draft.units.reduce((sum, unit) => sum + unit.knowledgeNodes.length, 0), 0),
}));

function chineseProfile(title) {
  if (title.startsWith("写作：")) return {
    objective: `围绕“${title.slice(3)}”完成有明确对象、中心和表达要求的写作，并能根据反馈修改。`,
    prerequisites: ["基本的记叙、描写和表达经验", "标点、段落与常用语言规范"],
    commonErrors: ["写作内容与题意或对象不一致", "只有材料堆砌而中心不清", "完成初稿后不检查结构和语言"],
    abilityLevels: ["APPLY", "ANALYZE", "EVALUATE", "CREATE"],
    questionTypes: ["SHORT_ANSWER"],
  };
  if (/^(任务|专题学习活动|阅读综合实践)/u.test(title)) return {
    objective: `围绕“${title}”整合阅读、资料搜集、合作表达和实践成果，形成有依据的综合性表达。`,
    prerequisites: ["本单元课文阅读基础", "资料搜集、整理和口头表达的基本方法"],
    commonErrors: ["活动成果与单元阅读内容脱节", "引用材料没有注明依据", "只陈述结论而没有过程或证据"],
    abilityLevels: ["APPLY", "ANALYZE", "EVALUATE", "CREATE"],
    questionTypes: ["SHORT_ANSWER", "ERROR_DIAGNOSIS"],
  };
  if (/^(整本书阅读|课外古诗词诵读)/u.test(title)) return {
    objective: `运用适合该作品类型的阅读方法理解“${title}”，积累重要内容并形成自己的阅读记录和评价。`,
    prerequisites: ["持续阅读和摘录批注的基本习惯", "相关文体与时代背景的入门认识"],
    commonErrors: ["用情节梗概代替阅读理解", "脱离文本证据评价人物或主题", "只背诵结论而不记录阅读过程"],
    abilityLevels: ["UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE"],
    questionTypes: ["SINGLE_CHOICE", "FILL_BLANK", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
  };
  return {
    objective: `阅读并理解“${title}”，把握主要内容、结构和语言特点，能依据文本进行概括、分析和表达。`,
    prerequisites: ["字词、句段和基本文体阅读经验", "结合上下文提取信息和概括内容的能力"],
    commonErrors: ["脱离文本内容进行主观推断", "只复述情节而不分析语言和结构", "引用语句后没有说明其表达作用"],
    abilityLevels: ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE"],
    questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
  };
}
