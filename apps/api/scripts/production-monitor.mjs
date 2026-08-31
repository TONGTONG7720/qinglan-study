import { readdir, stat } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import pg from "pg";

const { Client } = pg;

function positiveInteger(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

const databaseUrl = process.env.DATABASE_URL;
const apiUrl = process.env.MONITOR_API_URL ?? "http://api:3001/v1/health/ready";
const backupDirectory = process.env.MONITOR_BACKUP_DIR ?? "/backups";
const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
const intervalMs = positiveInteger("MONITOR_INTERVAL_SECONDS", "30", 10, 3_600) * 1_000;
const failureThreshold = positiveInteger("MONITOR_FAILURE_THRESHOLD", "3", 1, 20);
const backupMaximumAgeMs = positiveInteger(
  "BACKUP_MAX_AGE_SECONDS",
  "93600",
  300,
  2_592_000,
) * 1_000;

if (databaseUrl === undefined) {
  throw new Error("DATABASE_URL is required");
}

function writeLog(level, event, details = {}) {
  const line = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
  (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
}

async function checkApi() {
  const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }
}

async function checkDatabase() {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1 AS result");
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkBackup() {
  const entries = (await readdir(backupDirectory)).filter((name) => (
    /^qinglang-\d{8}T\d{6}Z\.dump$/u.test(name)
  ));
  if (entries.length === 0) {
    throw new Error("NO_VERIFIED_BACKUP");
  }
  const backupStats = await Promise.all(entries.map(async (name) => (
    stat(`${backupDirectory}/${name}`)
  )));
  const verifiedBackups = backupStats.filter((backupStat) => backupStat.size >= 1_024);
  if (verifiedBackups.length === 0) {
    throw new Error("NO_NONEMPTY_BACKUP");
  }
  const newestTimestamp = Math.max(...verifiedBackups.map((backupStat) => backupStat.mtimeMs));
  if (Date.now() - newestTimestamp > backupMaximumAgeMs) {
    throw new Error("BACKUP_TOO_OLD");
  }
}

async function deliverAlert(status, failedChecks) {
  if (webhookUrl === undefined || webhookUrl.length === 0) {
    writeLog("error", "production_alert_log_only", { status, failedChecks });
    return;
  }
  const parsedWebhook = new URL(webhookUrl);
  if (parsedWebhook.protocol !== "https:") {
    throw new Error("ALERT_WEBHOOK_URL must use HTTPS");
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: "qinglang-production",
      status,
      failedChecks,
      timestamp: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`ALERT_WEBHOOK_HTTP_${response.status}`);
  }
}

let consecutiveFailures = 0;
let incidentOpen = false;

async function runChecks() {
  const checks = [
    ["api", checkApi],
    ["database", checkDatabase],
    ["backup", checkBackup],
  ];
  const results = await Promise.all(checks.map(async ([name, check]) => {
    try {
      await check();
      return { name, ok: true };
    } catch {
      return { name, ok: false };
    }
  }));
  const failedChecks = results.filter((result) => !result.ok).map((result) => result.name);

  if (failedChecks.length === 0) {
    if (incidentOpen) {
      try {
        await deliverAlert("recovered", []);
      } catch {
        writeLog("error", "production_recovery_alert_delivery_failed");
      }
    }
    consecutiveFailures = 0;
    incidentOpen = false;
    writeLog("info", "production_checks_passed");
    return;
  }

  consecutiveFailures += 1;
  writeLog("error", "production_checks_failed", {
    failedChecks,
    consecutiveFailures,
  });
  if (consecutiveFailures >= failureThreshold && !incidentOpen) {
    try {
      await deliverAlert("failing", failedChecks);
    } catch {
      writeLog("error", "production_alert_delivery_failed", { failedChecks });
    }
    incidentOpen = true;
  }
}

const shutdownController = new AbortController();
const requestShutdown = () => shutdownController.abort();
process.once("SIGINT", requestShutdown);
process.once("SIGTERM", requestShutdown);

writeLog("info", "production_monitor_started", {
  intervalSeconds: intervalMs / 1_000,
  failureThreshold,
  alertDelivery: webhookUrl === undefined || webhookUrl.length === 0 ? "log-only" : "webhook",
});

while (!shutdownController.signal.aborted) {
  await runChecks();
  try {
    await delay(intervalMs, undefined, { signal: shutdownController.signal });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") {
      throw error;
    }
  }
}

writeLog("info", "production_monitor_stopped");
