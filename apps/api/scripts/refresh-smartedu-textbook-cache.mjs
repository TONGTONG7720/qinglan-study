import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const versionUrl = "https://s-file-1.ykt.cbern.com.cn/zxx/ndrs/resources/tch_material/version/data_version.json";
const allowedHosts = new Set(["s-file-1.ykt.cbern.com.cn", "s-file-2.ykt.cbern.com.cn"]);
const outputArgument = process.argv[2] ?? process.env.SMARTEDU_CATALOG_CACHE_PATH;
if (outputArgument === undefined || outputArgument.trim().length === 0) {
  throw new Error("Pass a Git-external output path or set SMARTEDU_CATALOG_CACHE_PATH");
}
const outputPath = resolve(outputArgument);

const versionResponse = await fetchOfficialJson(versionUrl);
if (
  typeof versionResponse !== "object"
  || versionResponse === null
  || Array.isArray(versionResponse)
  || typeof versionResponse.module_version !== "number"
  || typeof versionResponse.urls !== "string"
) {
  throw new Error("SmartEdu version descriptor is invalid");
}
const partUrls = versionResponse.urls.split(",").map((value) => value.trim()).filter((value) => value.length > 0);
if (partUrls.length === 0) throw new Error("SmartEdu version descriptor contains no catalog parts");

const parts = await Promise.all(partUrls.map(async (url) => {
  const decoded = await fetchOfficialJson(url);
  if (!Array.isArray(decoded)) throw new Error(`SmartEdu catalog part is not an array: ${url}`);
  return decoded;
}));
const rawRecords = parts.flat();
const flattenedById = new Map();
for (const record of rawRecords) {
  const flattened = flattenRecord(record);
  if (flattened === null) continue;
  const existing = flattenedById.get(flattened.content_id);
  if (existing === undefined || Number(flattened.timestamp) > Number(existing.timestamp)) {
    flattenedById.set(flattened.content_id, flattened);
  }
}
const flattened = [...flattenedById.values()].sort((left, right) => (
  left.stage.localeCompare(right.stage, "zh-CN")
  || left.subject.localeCompare(right.subject, "zh-CN")
  || left.grade.localeCompare(right.grade, "zh-CN")
  || left.volume.localeCompare(right.volume, "zh-CN")
  || left.title.localeCompare(right.title, "zh-CN")
));
if (flattened.length === 0) throw new Error("SmartEdu catalog refresh produced no usable textbook records");
const serialized = `${JSON.stringify(flattened)}\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, serialized, "utf8");
process.stdout.write(JSON.stringify({
  refreshed: true,
  source: versionUrl,
  moduleVersion: versionResponse.module_version,
  partCount: parts.length,
  rawRecords: rawRecords.length,
  flattenedRecords: flattened.length,
  sha256: createHash("sha256").update(serialized, "utf8").digest("hex"),
  outputPath,
}));

async function fetchOfficialJson(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error(`SmartEdu catalog URL is not allowlisted: ${url.origin}`);
  }
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`SmartEdu catalog request failed with HTTP ${String(response.status)}`);
  return response.json();
}

function flattenRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value;
  if (record.status !== "ONLINE" || !Array.isArray(record.tag_list)) return null;
  const title = text(record.title) ?? localizedText(record.global_title);
  const contentId = text(record.version_id) ?? text(record.id);
  const tags = new Map();
  for (const tag of record.tag_list) {
    if (typeof tag === "object" && tag !== null && !Array.isArray(tag)) {
      const dimension = text(tag.tag_dimension_id);
      const name = text(tag.tag_name);
      if (dimension !== null && name !== null) tags.set(dimension, name);
    }
  }
  const preview = previewUrl(record);
  const previewMatch = preview?.match(/\/assets\/([0-9a-f-]+)\.t\/zh-CN\/(\d+)\/transcode\//u) ?? null;
  const previewAssetId = previewMatch?.[1] ?? null;
  const timestamp = previewMatch?.[2] ?? null;
  const providers = Array.isArray(record.provider_list)
    ? record.provider_list.map((provider) => (
      typeof provider === "object" && provider !== null && !Array.isArray(provider) ? text(provider.name) : null
    )).filter((provider) => provider !== null)
    : [];
  const stage = tags.get("zxxxd");
  const subject = tags.get("zxxxk");
  const grade = tags.get("zxxnj");
  const version = tags.get("zxxbb");
  const volume = tags.get("zxxcc");
  if (
    title === null
    || contentId === null
    || timestamp === null
    || stage === undefined
    || subject === undefined
    || grade === undefined
    || version === undefined
    || volume === undefined
    || providers.length === 0
  ) return null;
  return {
    title,
    stage,
    subject,
    grade,
    volume,
    version,
    publisher: providers.join("、"),
    content_id: contentId,
    preview_asset_id: previewAssetId ?? contentId,
    timestamp,
  };
}

function previewUrl(record) {
  if (typeof record.custom_properties !== "object" || record.custom_properties === null || Array.isArray(record.custom_properties)) return null;
  const preview = record.custom_properties.preview;
  if (typeof preview !== "object" || preview === null || Array.isArray(preview)) return null;
  return text(preview.Slide1) ?? Object.values(preview).map((entry) => text(entry)).find((entry) => entry !== null) ?? null;
}

function localizedText(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return text(value["zh-CN"]);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
