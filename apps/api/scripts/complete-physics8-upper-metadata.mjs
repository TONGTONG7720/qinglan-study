import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CreateTextbookDraftInputSchema } from "@study/contracts";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const draftPath = resolve(repositoryRoot, "data/curriculum/physics-grade8-upper-2022.DRAFT.json");
const decoded = JSON.parse(await readFile(draftPath, "utf8"));
if (!Array.isArray(decoded) || decoded.length !== 1) throw new Error("Physics 8 upper draft must contain exactly one textbook");

const pageRanges = new Map(Object.entries({
  "2.1 声音的产生与传播": [26, 31],
  "2.2 音调": [32, 36],
  "2.3 响度与音色": [37, 41],
  "2.4 让声音为人类服务": [42, 45],
  "跨学科实践：关于社区噪声污染控制的建议": [46, 49],
  "3.1 光的传播与色散": [50, 54],
  "3.2 光的反射定律": [55, 60],
  "3.3 平面镜成像特点": [61, 65],
  "3.4 光的折射规律": [66, 70],
  "3.5 奇妙的透镜": [71, 75],
  "3.6 凸透镜成像规律": [76, 79],
  "3.7 眼睛与光学仪器": [80, 80],
  "跨学科实践：用“水透镜”探究近视眼的形成原因": [81, 87],
  "4.1 从全球变暖谈起": [88, 93],
  "跨学科实践：当地产生“热岛效应”的原因调查": [94, 95],
  "4.2 汽化和液化": [96, 103],
  "4.3 熔化和凝固": [104, 108],
  "4.4 升华和凝华": [109, 111],
  "4.5 水循环与水资源": [112, 118],
  "5.1 物体的质量": [119, 125],
  "5.2 物质的密度": [126, 128],
  "5.3 密度知识的应用": [129, 135],
  "5.4 物质的一些物理属性": [136, 140],
  "5.5 新材料及其应用": [141, 141],
  "跨学科实践：浓墨涂层大量吸收电磁波的实验研究": [142, 142],
  "跨学科实践：探究二极管的单向导电性": [142, 142],
  "跨学科实践：调查超导材料的研究进展与应用前景": [143, 143],
}));

const completed = {
  ...decoded[0],
  units: decoded[0].units.map((unit) => ({
    ...unit,
    knowledgeNodes: unit.knowledgeNodes.map((node) => {
      if (node.pageStart !== undefined && node.pageEnd !== undefined) return node;
      const range = pageRanges.get(node.title);
      if (range === undefined) throw new Error(`Missing official page range for ${node.title}`);
      pageRanges.delete(node.title);
      const practical = /跨学科实践|探究/u.test(node.title);
      return {
        ...node,
        prerequisiteKnowledge: [
          "前序物理量、测量方法和基本实验规范",
          "用图表、公式和语言表达物理关系的基础能力",
        ],
        commonErrors: practical
          ? ["没有控制变量或缺少对照", "把现象直接当成结论", "忽略安全、环保和可重复性条件"]
          : ["混淆物理量的定义、条件和单位", "只套公式而不判断适用条件", "作答后不检验数量级和实际意义"],
        abilityLevels: practical
          ? ["APPLY", "ANALYZE", "EVALUATE", "CREATE"]
          : ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"],
        questionTypes: practical
          ? ["SHORT_ANSWER", "CALCULATION", "EXPERIMENT_DESIGN", "ERROR_DIAGNOSIS"]
          : ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_BLANK", "CALCULATION", "SHORT_ANSWER", "ERROR_DIAGNOSIS"],
        pageStart: range[0],
        pageEnd: range[1],
        contentVersion: "2022-curriculum-standard-v1",
      };
    }),
  })),
};
if (pageRanges.size !== 0) throw new Error(`Unused official page ranges: ${[...pageRanges.keys()].join(", ")}`);
const validated = CreateTextbookDraftInputSchema.parse(completed);
await writeFile(draftPath, `${JSON.stringify([validated], null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({
  completed: true,
  draftPath,
  textbooks: 1,
  units: validated.units.length,
  knowledgeNodes: validated.units.reduce((sum, unit) => sum + unit.knowledgeNodes.length, 0),
  nodesWithPageRanges: validated.units.reduce(
    (sum, unit) => sum + unit.knowledgeNodes.filter((node) => node.pageStart !== null && node.pageEnd !== null).length,
    0,
  ),
}));
