import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CreateTextbookDraftInputSchema } from "@study/contracts";
import { z } from "zod";

const UnitSchema = z.tuple([z.string().trim().min(1).max(160), z.number().int().positive(), z.string().trim().min(3).max(240), z.string().trim().min(3).max(240)]);
const SourceSchema = z.object({ schemaVersion: z.literal(1), source: z.string().min(8), reviewStatus: z.string().min(8), books: z.array(z.object({ grade: z.union([z.literal(7),z.literal(8),z.literal(9)]), volume: z.enum(["上册","下册"]), contentId: z.string().regex(/^[0-9a-f-]{36}$/u), units: z.array(UnitSchema).min(1) }).strict()).length(5) }).strict();
const root = resolve(import.meta.dirname, "../../..");
const source = SourceSchema.parse(JSON.parse(await readFile(resolve(root, "data/curriculum/sources/pep-english-2022-toc.json"), "utf8")));
const outputPath = resolve(root, "data/curriculum/pep-english-5-volumes-2022.DRAFT.json");
const drafts = source.books.map((book) => CreateTextbookDraftInputSchema.parse({
  subjectCode: "ENGLISH", grade: book.grade, publisher: "人民教育出版社", editionName: "义务教育教科书（根据2022年版课程标准修订）·人教版", volume: book.volume,
  units: book.units.map(([title,pageStart,question,languageFocus], index) => {
    const nextStart = book.units[index + 1]?.[1] ?? finalBoundary(book.grade,book.volume);
    const span = nextStart - pageStart;
    const sectionAEnd = pageStart + Math.max(1,Math.floor(span * 0.45)) - 1;
    const sectionBStart = sectionAEnd + 1;
    const projectStart = Math.max(sectionBStart,nextStart - 1);
    return {
      ordinal: index + 1,
      title,
      knowledgeNodes: [
        { title: `Section A: ${question}`, objective: `围绕“${question}”理解听力和对话信息，能在真实语境中进行准确、得体的口头交流。`, prerequisiteKnowledge: ["小学阶段基础词汇、语音和日常交际表达","识别人物、时间、地点和主要信息的听读能力"], commonErrors: ["只抓单个词而忽略语境和说话意图","机械套用句型而忽略人称、时态或礼貌程度"], abilityLevels: ["REMEMBER","UNDERSTAND","APPLY","ANALYZE"], questionTypes: ["SINGLE_CHOICE","MULTIPLE_CHOICE","FILL_BLANK","SHORT_ANSWER","ERROR_DIAGNOSIS"], pageStart, pageEnd: sectionAEnd, contentVersion: "2022-curriculum-standard-v1" },
        { title: `Section B: Reading, writing and ${languageFocus}`, objective: `围绕“${title}”阅读和分析语篇，掌握“${languageFocus}”，并完成内容连贯、语言基本准确的书面表达。`, prerequisiteKnowledge: ["本单元Section A的主题词汇和交际表达","句子结构、段落主旨和上下文推断基础"], commonErrors: ["阅读时只逐词翻译而没有把握语篇主旨","写作中时态、人称或主谓一致错误","语法形式正确但与表达意图不匹配"], abilityLevels: ["UNDERSTAND","APPLY","ANALYZE","CREATE"], questionTypes: ["SINGLE_CHOICE","MULTIPLE_CHOICE","FILL_BLANK","SHORT_ANSWER","ERROR_DIAGNOSIS"], pageStart: sectionBStart, pageEnd: Math.max(sectionBStart,projectStart-1), contentVersion: "2022-curriculum-standard-v1" },
        { title: `Project: Integrated language use for ${title}`, objective: `综合运用“${title}”的主题词汇、语言结构和文化知识完成项目成果，并能展示、互评和修改。`, prerequisiteKnowledge: ["本单元Section A与Section B的语言输入","简单资料搜集、合作沟通和展示能力"], commonErrors: ["项目成果只有装饰而缺少有效语言输出","直接拼接范例而没有结合真实任务","展示后不根据反馈修改"], abilityLevels: ["APPLY","ANALYZE","EVALUATE","CREATE"], questionTypes: ["SHORT_ANSWER","ERROR_DIAGNOSIS"], pageStart: projectStart, pageEnd: nextStart-1, contentVersion: "2022-curriculum-standard-v1" },
      ],
    };
  }), confirmation: "CREATE_TEXTBOOK_DRAFT",
}));
await writeFile(outputPath, `${JSON.stringify(drafts,null,2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ outputPath, textbooks: drafts.length, units: drafts.reduce((n,d)=>n+d.units.length,0), knowledgeNodes: drafts.reduce((n,d)=>n+d.units.reduce((m,u)=>m+u.knowledgeNodes.length,0),0) }));

function finalBoundary(grade,volume) {
  if (grade === 7 && volume === "上册") return 75;
  if (grade === 7 && volume === "下册") return 65;
  return 81;
}
