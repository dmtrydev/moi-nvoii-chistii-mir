import { fetchFkkoTitlesBatched } from './rpnFkkoClient.js';
import { queryDistinctApprovedFkkoCodes, upsertFkkoOfficialTitles } from './fkkoOfficialTitles.js';

const FKKO_SYNC_CHUNK = 250;

/** @type {{ running: boolean, phase: string, total: number, processed: number, saved: number, lastError: string | null, startedAt: string | null, finishedAt: string | null }} */
let syncState = {
  running: false,
  phase: 'idle',
  total: 0,
  processed: 0,
  saved: 0,
  lastError: null,
  startedAt: null,
  finishedAt: null,
};

export function getFkkoTitlesSyncStatus() {
  return { ...syncState };
}

export function isFkkoTitlesSyncRunning() {
  return syncState.running;
}

export async function runFkkoOfficialTitlesSyncJob() {
  if (syncState.running) return;
  syncState = {
    running: true,
    phase: 'loading_codes',
    total: 0,
    processed: 0,
    saved: 0,
    lastError: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  try {
    const codes = await queryDistinctApprovedFkkoCodes();
    syncState.total = codes.length;
    syncState.phase = 'rpn_fetch';

    let savedTotal = 0;
    for (let i = 0; i < codes.length; i += FKKO_SYNC_CHUNK) {
      const slice = codes.slice(i, i + FKKO_SYNC_CHUNK);
      const part = await fetchFkkoTitlesBatched(slice, { concurrency: 2, delayMs: 300 });
      await upsertFkkoOfficialTitles(part);
      const n = Object.keys(part).length;
      savedTotal += n;
      syncState.processed += slice.length;
      syncState.saved = savedTotal;
    }

    syncState.phase = 'done';
    syncState.finishedAt = new Date().toISOString();
  } catch (e) {
    syncState.phase = 'error';
    syncState.lastError = e instanceof Error ? e.message : String(e);
    syncState.finishedAt = new Date().toISOString();
    console.error('fkko official titles sync failed:', e);
  } finally {
    syncState.running = false;
  }
}
