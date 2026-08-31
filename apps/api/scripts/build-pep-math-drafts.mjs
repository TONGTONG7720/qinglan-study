import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CreateTextbookDraftInputSchema } from "@study/contracts";
import { z } from "zod";

const NodeSchema = z.tuple([z.string().trim().min(1).max(160), z.number().int().positive().max(2000)]);
const SourceSchema = z.object({
  schemaVersion: z.literal(1), source: z.string().min(8), reviewStatus: z.string().min(8),
  books: z.array(z.object({ grade: z.union([z.literal(7),z.literal(8),z.literal(9)]), volume: z.enum(["上册","下册"]), contentId: z.uuid(), units: z.array(z.object({ title: z.string().min(1).max(160), pageStart: z.number().int().positive(), nodes: z.array(NodeSchema).min(1) }).strict()).min(1) }).strict()).length(5),
}).strict();
const root = resolve(import.meta.dirname, "../../..");
const source = SourceSchema.parse(JSON.parse(await readFile(resolve(root, "data/curriculum/sources/pep-math-2022-toc.json"), "utf8")));
const outputPath = resolve(root, "data/curriculum/pep-math-5-volumes-2022.DRAFT.json");
const drafts = source.books.map((book) => CreateTextbookDraftInputSchema.parse({
  subjectCode: "MATH", grade: book.grade, publisher: "人民教育出版社", editionName: "义务教育教科书（根据2022年版课程标准修订）·人教版", volume: book.volume,
  units: book.units.map((unit, unitIndex) => ({ ordinal: unitIndex + 1, title: unit.title, knowledgeNodes: unit.nodes.map(([title,pageStart], nodeIndex) => {
    const boundary = unit.nodes[nodeIndex + 1]?.[1] ?? book.units[unitIndex + 1]?.pageStart ?? pageStart + 1;
    const activity = /^(数学活动|小结|综合与实践)|^.+实践/u.test(title) || unit.title.startsWith("综合与实践");
    const extension = /^(阅读与思考|图说数学史|探究与发现|信息技术应用|观察与猜想)/u.test(title);
    return {
      title,
      objective: activity
        ? `综合运用“${title}”相关数学知识建立模型、实施探究并检验结果，形成有依据的表达。`
        : extension
          ? `围绕“${title}”理解数学思想、方法或应用背景，能把材料中的关系转化为规范数学表达。`
          : `理解“${title}”的概念、性质和方法，能完成规范推理、运算或建模并检验结果。`,
      prerequisiteKnowledge: ["前序章节中的数与式、图形或数据处理基础", "使用数学符号、图表和基本推理表达数量关系的能力"],
      commonErrors: activity
        ? ["没有说明模型假设和变量含义", "只给结果而没有验证或解释实际意义"]
        : ["混淆概念成立的条件和结论", "运算或推理步骤缺少依据", "得到结果后没有检查取值范围、单位或实际意义"],
      abilityLevels: activity ? ["APPLY","ANALYZE","EVALUATE","CREATE"] : ["REMEMBER","UNDERSTAND","APPLY","ANALYZE"],
      questionTypes: activity ? ["CALCULATION","SHORT_ANSWER","EXPERIMENT_DESIGN","ERROR_DIAGNOSIS"] : ["SINGLE_CHOICE","FILL_BLANK","CALCULATION","SHORT_ANSWER","ERROR_DIAGNOSIS","GRAPHING"],
      pageStart, pageEnd: Math.max(pageStart,boundary-1), contentVersion: "2022-curriculum-standard-v1",
    };
  }) })), confirmation: "CREATE_TEXTBOOK_DRAFT",
}));
await writeFile(outputPath, `${JSON.stringify(drafts,null,2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ outputPath, textbooks: drafts.length, units: drafts.reduce((n,d)=>n+d.units.length,0), knowledgeNodes: drafts.reduce((n,d)=>n+d.units.reduce((m,u)=>m+u.knowledgeNodes.length,0),0) }));
