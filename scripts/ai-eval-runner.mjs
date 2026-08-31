import { readFileSync } from "node:fs";

const path = process.argv[2];
if (path === "--help") {
  console.log("Usage: node scripts/ai-eval-runner.mjs <reviewed-outcomes.jsonl>");
  process.exit(0);
}
if (path === undefined) throw new Error("evaluation outcome path is required");
const requiredSubjects = ["CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY", "PHYSICS", "CHEMISTRY"];
const rows = readFileSync(path, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
if (rows.length < 100) throw new Error("at least 100 reviewed outcomes are required");
const subjects = new Map();
const ids = new Set();
let passed = 0;
for (const row of rows) {
  if (typeof row.id !== "string" || typeof row.subjectCode !== "string" || typeof row.questionType !== "string" || typeof row.passed !== "boolean" || typeof row.fabricatedCitation !== "boolean") throw new Error("invalid outcome row");
  if (ids.has(row.id)) throw new Error(`duplicate outcome id: ${row.id}`);
  ids.add(row.id);
  if (!requiredSubjects.includes(row.subjectCode)) throw new Error(`unknown subject: ${row.subjectCode}`);
  if (row.fabricatedCitation) throw new Error("fabricated citation detected");
  if (row.passed) passed += 1;
  const subject = subjects.get(row.subjectCode) ?? { total: 0, passed: 0, types: new Set() };
  subject.total += 1; if (row.passed) subject.passed += 1; subject.types.add(row.questionType); subjects.set(row.subjectCode, subject);
}
const overall = passed / rows.length;
if (overall < 0.95) throw new Error("overall threshold not met");
for (const subjectCode of requiredSubjects) {
  const subject = subjects.get(subjectCode);
  if (subject === undefined || subject.total < 10 || subject.types.size < 3 || subject.passed / subject.total < 0.9) throw new Error(`subject threshold not met: ${subjectCode}`);
}
console.log(JSON.stringify({ total: rows.length, overallPassRate: overall, subjects: [...subjects].map(([subjectCode, value]) => ({ subjectCode, total: value.total, passRate: value.passed / value.total, questionTypes: value.types.size })) }));
