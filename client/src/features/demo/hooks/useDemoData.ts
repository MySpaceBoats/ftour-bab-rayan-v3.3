import { useSyncExternalStore } from "react";
import {
  getDemoDataset,
  subscribeDemoDataset,
} from "../data/store";
import type { DemoDataset } from "../data/types";

/**
 * Abonne un composant au dataset démo.
 * Renvoie toujours une référence stable jusqu'au prochain update publié
 * via le store, ce qui permet aux sélecteurs de useMemo de fonctionner.
 */
export function useDemoData(): DemoDataset {
  return useSyncExternalStore(subscribeDemoDataset, getDemoDataset, getDemoDataset);
}
