import type { CorpusPayload, FindingsPayload, NoteAnalysis, NoteDetail, RunSummary } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload as T;
}

export async function fetchCorpus(): Promise<CorpusPayload> {
  const payload = await request<{ ok: true; index: CorpusPayload['index']; notes: NoteDetail[] }>('/api/corpus');
  return { index: payload.index, notes: payload.notes };
}

export async function fetchFindings(runId?: string): Promise<FindingsPayload> {
  const query = runId ? `?runId=${encodeURIComponent(runId)}` : '';
  const payload = await request<{ ok: true } & FindingsPayload>(`/api/findings${query}`);
  return payload;
}

export async function fetchRuns(): Promise<{ runs: RunSummary[]; archive: RunSummary[] }> {
  const payload = await request<{ ok: true; runs: RunSummary[]; archive: RunSummary[] }>('/api/runs');
  return { runs: payload.runs, archive: payload.archive };
}

export async function fetchNote(noteId: string, runId?: string): Promise<{ note: NoteDetail; analysis?: NoteAnalysis | null }> {
  const query = runId ? `?runId=${encodeURIComponent(runId)}` : '';
  const payload = await request<{ ok: true; note: NoteDetail; analysis?: NoteAnalysis | null }>(
    `/api/notes/${encodeURIComponent(noteId)}${query}`
  );
  return { note: payload.note, analysis: payload.analysis };
}

export async function triggerIngest(): Promise<void> {
  await request('/api/ingest', { method: 'POST', body: JSON.stringify({}) });
}

export async function triggerRun(config?: Record<string, unknown>): Promise<void> {
  await request('/api/runs', {
    method: 'POST',
    body: JSON.stringify(config ?? {})
  });
}

export async function archiveRun(runId: string, reason: string): Promise<void> {
  await request(`/api/experiments/${encodeURIComponent(runId)}/archive`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}
