import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_INTERVAL_SECONDS = 30;
const DEFAULT_BASE_URL = "http://localhost:3000";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");

  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] ??= value;
    }
  } catch {
    // .env.local is optional; environment variables may already be exported.
  }
}

function parseIntervalSeconds() {
  const raw = process.env.LOCAL_REFRESH_INTERVAL_SECONDS;
  if (!raw) return DEFAULT_INTERVAL_SECONDS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("LOCAL_REFRESH_INTERVAL_SECONDS must be a positive number.");
  }

  return parsed;
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolveDelay) => {
    if (signal.aborted) {
      resolveDelay();
      return;
    }

    const timeout = setTimeout(resolveDelay, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolveDelay();
      },
      { once: true },
    );
  });
}

async function refreshOnce(baseUrl: string, cronSecret: string, signal: AbortSignal) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/cron/refresh`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
    signal,
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Refresh failed with ${response.status}: ${body}`);
  }

  return body;
}

async function main() {
  loadEnvLocal();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET is required. Add it to .env.local or export it before running this script.");
  }

  const baseUrl = process.env.LOCAL_REFRESH_BASE_URL ?? DEFAULT_BASE_URL;
  const intervalSeconds = parseIntervalSeconds();
  const controller = new AbortController();

  process.on("SIGINT", () => controller.abort());
  process.on("SIGTERM", () => controller.abort());

  console.log(`Refreshing ${baseUrl}/api/cron/refresh every ${intervalSeconds}s. Press Ctrl-C to stop.`);

  while (!controller.signal.aborted) {
    const startedAt = new Date();
    try {
      const body = await refreshOnce(baseUrl, cronSecret, controller.signal);
      console.log(`[${startedAt.toISOString()}] ${body}`);
    } catch (error) {
      if (controller.signal.aborted) break;
      const message = error instanceof Error ? error.message : "Unknown refresh error.";
      console.error(`[${startedAt.toISOString()}] ${message}`);
    }

    await delay(intervalSeconds * 1000, controller.signal);
  }

  console.log("Stopped local refresh loop.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
