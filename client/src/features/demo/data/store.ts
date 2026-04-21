// =============================================================================
// Store démo — source de vérité unique, stockée dans localStorage.
// Pub/sub minimaliste pour que tous les composants abonnés se re-rendent
// après un changement.
// =============================================================================

import { DEMO_DATASET_VERSION, generateDemoDataset } from "./generate";
import type { DemoDataset } from "./types";

const STORAGE_KEY = "ftour_demo_dataset_v1";

type Listener = () => void;

let cache: DemoDataset | null = null;
const listeners = new Set<Listener>();

function safeParse(raw: string | null): DemoDataset | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoDataset;
    if (parsed && parsed.version === DEMO_DATASET_VERSION) return parsed;
    return null;
  } catch {
    return null;
  }
}

function persist(dataset: DemoDataset) {
  cache = dataset;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      // Quota dépassé ou mode privé : on garde simplement le cache en mémoire.
    }
  }
  listeners.forEach((l) => l());
}

export function getDemoDataset(): DemoDataset {
  if (cache) return cache;
  if (typeof window !== "undefined") {
    const existing = safeParse(window.localStorage.getItem(STORAGE_KEY));
    if (existing) {
      cache = existing;
      return existing;
    }
  }
  const fresh = generateDemoDataset();
  persist(fresh);
  return fresh;
}

export function regenerateDemoDataset(): DemoDataset {
  const fresh = generateDemoDataset();
  persist(fresh);
  return fresh;
}

export function resetDemoDataset(): DemoDataset {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  cache = null;
  return getDemoDataset();
}

export function updateDemoDataset(
  updater: (prev: DemoDataset) => DemoDataset,
): DemoDataset {
  const current = getDemoDataset();
  const next = updater(current);
  persist(next);
  return next;
}

export function subscribeDemoDataset(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Helpers ciblés — utilisés par les pages pour simplifier les updates.

export function addDemoActivityEntry(
  activity: DemoDataset["activity"][number],
) {
  return updateDemoDataset((prev) => ({
    ...prev,
    activity: [activity, ...prev.activity].slice(0, 80),
  }));
}
