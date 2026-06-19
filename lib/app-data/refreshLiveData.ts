import { buildAppData } from "@/lib/app-data/buildAppData";
import { readLatestAppState, writeLatestAppState } from "@/lib/app-data/storage";
import { fetchEspnScoreboard } from "@/lib/providers/espn";
import type { AppState } from "@/lib/schemas/appData";

export async function refreshLiveData(): Promise<AppState> {
  try {
    const provider = await fetchEspnScoreboard();
    const state = buildAppData({
      matches: provider.matches,
      providerMeta: {
        capturedAt: provider.capturedAt,
        lastSuccessfulFetchAt: provider.matches.length > 0 ? provider.capturedAt : null,
        stale: provider.matches.length === 0,
        message: provider.message,
      },
    });
    await writeLatestAppState(state);
    return state;
  } catch (error) {
    const lastGood = await readLatestAppState();
    return {
      ...lastGood,
      sources: {
        ...lastGood.sources,
        matches: {
          ...lastGood.sources.matches,
          stale: true,
          message: error instanceof Error ? error.message : "Provider refresh failed.",
        },
      },
    };
  }
}
