import { createHash } from "node:crypto";

import { TextbookSummarySchema } from "@study/contracts";

import {
  curriculumDraftSummary,
  readCurriculumDrafts,
} from "./curriculum-draft-manifest.mjs";

const { manifestPath, drafts } = await readCurriculumDrafts(process.argv[2]);
const baseUrl = (process.env.CURRICULUM_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/u, "");
const loginId = process.env.CURRICULUM_ADMIN_LOGIN_ID;
const password = process.env.CURRICULUM_ADMIN_PASSWORD;

if (loginId === undefined || password === undefined || password.length < 12) {
  throw new Error("CURRICULUM_ADMIN_LOGIN_ID and a 12+ character CURRICULUM_ADMIN_PASSWORD are required");
}
const parsedBaseUrl = new URL(baseUrl);
if (
  parsedBaseUrl.protocol !== "https:"
  && !(parsedBaseUrl.protocol === "http:" && new Set(["127.0.0.1", "localhost"]).has(parsedBaseUrl.hostname))
) {
  throw new Error("CURRICULUM_API_BASE_URL must use HTTPS unless it targets loopback");
}

const loginResponse = await fetch(`${baseUrl}/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Qinglang-CSRF": "1" },
  body: JSON.stringify({ loginId, password }),
});
if (!loginResponse.ok) {
  throw new Error(`Curriculum admin login failed with HTTP ${String(loginResponse.status)}`);
}
const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
if (cookie === undefined) {
  throw new Error("Curriculum admin login did not return a session cookie");
}
const proofResponse = await fetch(`${baseUrl}/v1/auth/reauthenticate`, {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json", "X-Qinglang-CSRF": "1" },
  body: JSON.stringify({ password }),
});
if (!proofResponse.ok) {
  throw new Error(`Curriculum admin reauthentication failed with HTTP ${String(proofResponse.status)}`);
}
const proofBody = await proofResponse.json();
if (
  typeof proofBody !== "object"
  || proofBody === null
  || !("proof" in proofBody)
  || typeof proofBody.proof !== "string"
) {
  throw new Error("Curriculum admin reauthentication proof is invalid");
}

const imported = [];
try {
  for (const draft of drafts) {
    const digest = createHash("sha256").update(JSON.stringify(draft), "utf8").digest("hex");
    const response = await fetch(`${baseUrl}/v1/curriculum/textbooks`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "X-Qinglang-CSRF": "1",
        "idempotency-key": `curriculum-import:${digest.slice(0, 48)}`,
        "x-reauth-proof": proofBody.proof,
      },
      body: JSON.stringify(draft),
    });
    if (!response.ok) {
      throw new Error(`Curriculum draft import failed with HTTP ${String(response.status)}`);
    }
    const textbook = TextbookSummarySchema.parse(await response.json());
    if (textbook.status !== "DRAFT") {
      throw new Error("Curriculum importer may only create DRAFT textbooks");
    }
    imported.push(textbook);
  }
} finally {
  await fetch(`${baseUrl}/v1/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie, "X-Qinglang-CSRF": "1" },
  }).catch(() => undefined);
}

process.stdout.write(JSON.stringify({
  imported: true,
  manifestPath,
  ...curriculumDraftSummary(drafts),
  textbookIds: imported.map((textbook) => textbook.id),
}));
