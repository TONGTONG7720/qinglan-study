import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const subjectRequirements = [
  { subjectCode: "CHINESE", subjectName: "语文", grades: [7, 8, 9], version: "统编版", publisher: "人民教育出版社" },
  { subjectCode: "MATH", subjectName: "数学", grades: [7, 8, 9], version: "人教版", publisher: "人民教育出版社" },
  { subjectCode: "ENGLISH", subjectName: "英语", grades: [7, 8, 9], version: "人教版", publisher: "人民教育出版社" },
  { subjectCode: "MORALITY", subjectName: "道德与法治", grades: [7, 8, 9], version: "统编版", publisher: "人民教育出版社" },
  { subjectCode: "HISTORY", subjectName: "历史", grades: [7, 8, 9], version: "统编版", publisher: "人民教育出版社" },
  { subjectCode: "PHYSICS", subjectName: "物理", grades: [8, 9], version: "沪科技粤教版", publisher: "上海科学技术出版社" },
  { subjectCode: "CHEMISTRY", subjectName: "化学", grades: [9], version: "人教版", publisher: "人民教育出版社" },
];

const gradeNames = new Map([
  [7, "七年级"],
  [8, "八年级"],
  [9, "九年级"],
]);

const sourceCatalogUrl = "https://s-file-1.ykt.cbern.com.cn/zxx/ndrs/resources/tch_material/version/data_version.json";
const detailsUrlPrefix = "https://s-file-2.ykt.cbern.com.cn/zxx/ndrv2/resources/tch_material/details/";
const previewUrlPrefix = "https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets/";
const repositoryRoot = resolve(import.meta.dirname, "../../..");

const catalogPath = resolve(process.argv[2] ?? process.env.SMARTEDU_CATALOG_CACHE_PATH ?? "");
const outputPath = process.argv[3] === undefined
  ? resolve(repositoryRoot, "data/curriculum/chaozhou-smartedu-textbook-catalog.json")
  : resolve(process.argv[3]);

if (process.argv[2] === undefined && process.env.SMARTEDU_CATALOG_CACHE_PATH === undefined) {
  throw new Error("Pass the refreshed SmartEdu catalog cache path or set SMARTEDU_CATALOG_CACHE_PATH");
}

const decoded = JSON.parse(await readFile(catalogPath, "utf8"));
if (!Array.isArray(decoded)) {
  throw new Error("SmartEdu catalog cache must contain a JSON array");
}

const records = decoded.filter((entry) => (
  typeof entry === "object"
  && entry !== null
  && typeof entry.title === "string"
  && typeof entry.grade === "string"
  && typeof entry.volume === "string"
  && typeof entry.version === "string"
  && typeof entry.publisher === "string"
  && typeof entry.content_id === "string"
  && (entry.preview_asset_id === undefined || typeof entry.preview_asset_id === "string")
  && typeof entry.timestamp === "string"
));

const textbooks = [];
for (const requirement of subjectRequirements) {
  for (const grade of requirement.grades) {
    const gradeName = gradeNames.get(grade);
    if (gradeName === undefined) {
      throw new Error(`Unsupported grade ${String(grade)}`);
    }
    for (const volume of ["上册", "下册"]) {
      const candidates = records.filter((record) => (
        record.stage === "初中"
        && record.grade === gradeName
        && record.volume === volume
        && record.version === requirement.version
        && record.publisher === requirement.publisher
        && record.title.includes(requirement.subjectName)
        && record.title.includes("根据2022年版课程标准修订")
      )).sort((left, right) => (
        Number(right.timestamp) - Number(left.timestamp)
        || left.content_id.localeCompare(right.content_id)
      ));

      const selected = candidates[0];
      if (selected === undefined) {
        textbooks.push({
          subjectCode: requirement.subjectCode,
          subjectName: requirement.subjectName,
          grade,
          volume,
          version: requirement.version,
          publisher: requirement.publisher,
          availability: "PENDING_OFFICIAL_RELEASE",
          directoryStatus: "NOT_AVAILABLE",
          reason: "国家智慧教育平台当前目录未提供该册的2022课标修订版；不得以旧版替代。",
        });
        continue;
      }

      textbooks.push({
        subjectCode: requirement.subjectCode,
        subjectName: requirement.subjectName,
        grade,
        volume,
        version: requirement.version,
        publisher: requirement.publisher,
        title: selected.title,
        contentId: selected.content_id,
        previewAssetId: selected.preview_asset_id ?? selected.content_id,
        catalogTimestamp: selected.timestamp,
        availability: "AVAILABLE",
        directoryStatus: requirement.subjectCode === "PHYSICS" && grade === 8 && volume === "上册"
          ? "EXTRACTED_ADMIN_REVIEW_REQUIRED"
          : "EXTRACTION_PENDING",
        detailsUrl: `${detailsUrlPrefix}${selected.content_id}.json`,
        previewUrlTemplate: `${previewUrlPrefix}${selected.preview_asset_id ?? selected.content_id}.t/zh-CN/${selected.timestamp}/transcode/image/{page}.jpg`,
      });
    }
  }
}

const availableCount = textbooks.filter((textbook) => textbook.availability === "AVAILABLE").length;
const pendingCount = textbooks.length - availableCount;
const artifact = {
  schemaVersion: 1,
  jurisdiction: {
    province: "广东省",
    city: "潮州市",
    schoolSystem: "六三学制初中",
  },
  generatedAt: new Date().toISOString(),
  source: {
    authority: "国家中小学智慧教育平台",
    catalogUrl: sourceCatalogUrl,
    catalogCachePath: "local-refreshed-cache (not committed)",
    selectionRule: "选择对应学科、年级、册次、版本、出版社且标题明确标注根据2022年版课程标准修订的最新时间戳记录。",
  },
  summary: {
    expectedTextbooks: textbooks.length,
    availableTextbooks: availableCount,
    pendingOfficialRelease: pendingCount,
    databaseStatus: "CATALOG_ONLY_DATABASE_STATE_NOT_ASSERTED",
  },
  textbooks,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ outputPath, ...artifact.summary }));
