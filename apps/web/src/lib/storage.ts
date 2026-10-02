import type { AnalyzeSuccess } from "./types";

const STORAGE_KEY = "repocall:last-analysis:v1";

export interface StoredAnalysis {
  url: string;
  data: AnalyzeSuccess;
  savedAt: string;
}

export function loadLastAnalysis(): StoredAnalysis | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAnalysis;
    if (!parsed || typeof parsed.url !== "string" || !parsed.data?.analysis) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLastAnalysis(url: string, data: AnalyzeSuccess): void {
  try {
    const stored: StoredAnalysis = { url, data, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full or unavailable — the app still works, it just won't persist.
  }
}

export function clearLastAnalysis(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
