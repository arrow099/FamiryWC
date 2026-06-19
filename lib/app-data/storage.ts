import { del, get, put } from "@vercel/blob";
import fallbackState from "@/public/data.json";
import type { AppState } from "@/lib/schemas/appData";

const APP_STATE_BLOB_NAME = "app-state/latest.json";
let inMemoryAppState: AppState | null = null;

export async function readLatestAppState(): Promise<AppState> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return inMemoryAppState ?? (fallbackState as AppState);
  }

  try {
    const blob = await get(APP_STATE_BLOB_NAME, { access: "private", token, useCache: false });
    if (!blob) throw new Error("Latest app state blob does not exist.");
    return (await new Response(blob.stream).json()) as AppState;
  } catch {
    return inMemoryAppState ?? (fallbackState as AppState);
  }
}

export async function writeLatestAppState(appState: AppState): Promise<void> {
  inMemoryAppState = appState;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return;
  }

  await put(APP_STATE_BLOB_NAME, JSON.stringify(appState, null, 2), {
    access: "private",
    contentType: "application/json",
    token,
    allowOverwrite: true,
    addRandomSuffix: false,
  });
}

export async function clearLatestAppState(): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  await del(APP_STATE_BLOB_NAME, { token });
}
