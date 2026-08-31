import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const sourceRoots = ["apps", "packages"].filter(existsSync);
const forbidden = [
  { label: "explicit any", pattern: /\bany\b/u },
  { label: "ts-ignore", pattern: /@ts-ignore/u },
  { label: "ts-expect-error", pattern: /@ts-expect-error/u },
];

const sourceFiles = [];

function collect(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      if (entry !== "dist" && entry !== "generated" && entry !== "node_modules") {
        collect(path);
      }
    } else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      sourceFiles.push(path);
    }
  }
}

for (const root of sourceRoots) {
  collect(root);
}

assert.equal(existsSync("apps/web"), true, "apps/web is required after frontend authorization");

for (const path of sourceFiles) {
  const source = readFileSync(path, "utf8");
  for (const rule of forbidden) {
    assert.equal(rule.pattern.test(source), false, `${rule.label} found in ${path}`);
  }
}

console.log(`Forbidden-pattern scan passed for ${sourceFiles.length} TypeScript files.`);
