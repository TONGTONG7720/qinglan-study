import { readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspace = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const prototypesRoot = path.join(workspace, "docs", "design", "current-product-design", "prototypes");
const requestedScript = process.argv[2] ?? "build";
if (!new Set(["build", "typecheck", "test:sites"]).has(requestedScript)) {
  throw new Error(`Unsupported prototype script: ${requestedScript}`);
}
const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const commandArgs = process.platform === "win32"
  ? ["/d", "/s", "/c", `npm.cmd run ${requestedScript} --silent`]
  : ["run", requestedScript, "--silent"];
const directories = readdirSync(prototypesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

let failures = 0;
for (const directory of directories) {
  const cwd = path.join(prototypesRoot, directory);
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status === 0) {
    process.stdout.write(`PASS\t${directory}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL\t${directory}\n`);
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (result.error !== undefined) process.stderr.write(`${result.error.message}\n`);
  }
}

process.stdout.write(`SUMMARY\tpass=${String(directories.length - failures)}\tfailed=${String(failures)}\trealRoot=${workspace}\n`);
if (failures > 0) process.exitCode = 1;
