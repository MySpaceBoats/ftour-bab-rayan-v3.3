const DEMO_ACCESS_STORAGE_KEY = "ftour_demo_access";

export const isDemoPath = (path: string) => path === "/demo" || path.startsWith("/demo/");

export function isDemoAccessEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEMO_ACCESS_STORAGE_KEY) === "1";
}

export function enableDemoAccess(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_ACCESS_STORAGE_KEY, "1");
}

export function disableDemoAccess(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
}
