import { useBrowserLocation } from "wouter/use-browser-location";

/**
 * Sous-domaines applicatifs: l'URL affichée est courte, les routes internes restent inchangées.
 *   communityspace.ftourbabrayan.ma/amis  <->  /fr/benevole/espace/amis
 *   admin.ftourbabrayan.ma/commandes      <->  /admin/commandes
 */
export const COMMUNITY_URL = "https://communityspace.ftourbabrayan.ma";
export const ADMIN_URL = "https://admin.ftourbabrayan.ma";

type Space = "community" | "admin";

const host = typeof window === "undefined" ? "" : window.location.hostname;
const SPACE: Space | null = host.startsWith("communityspace.")
  ? "community"
  : host.startsWith("admin.")
    ? "admin"
    : null;

const LANGS = ["fr", "en", "ar", "amz"];
const HUB_SEGMENTS = "messages|marketplace|hebergement|meetup|pro|amis|membre|profil";
const LANG_RE = new RegExp(`^/(${LANGS.join("|")})(/|$)`);
const HUB_RE = new RegExp(`^/(${HUB_SEGMENTS})(/|$)`);
const HUB_INTERNAL_RE = new RegExp(`^/(${LANGS.join("|")})/benevole/espace(?=/|$)`);
// chemins qui restent tels quels sur le sous-domaine admin
const ADMIN_PASSTHROUGH_RE = /^\/(admin3?|scanner|checkin|connexion|404)(\/|$)/;

const storedLang = () => {
  try {
    const l = localStorage.getItem("ftour-lang");
    return l && LANGS.includes(l) ? l : "fr";
  } catch {
    return "fr";
  }
};

export function toInternal(ext: string): string {
  if (SPACE === "community") {
    if (ext === "/") return `/${storedLang()}/benevole/espace`;
    if (HUB_RE.test(ext)) return `/${storedLang()}/benevole/espace${ext}`;
  } else if (SPACE === "admin") {
    if (ext === "/") return "/admin";
    if (!ADMIN_PASSTHROUGH_RE.test(ext) && !LANG_RE.test(ext)) return `/admin${ext}`;
  }
  return ext;
}

export function toExternal(int: string): string {
  if (SPACE === "community") {
    const m = HUB_INTERNAL_RE.exec(int);
    if (m) return int.slice(m[0].length) || "/";
  } else if (SPACE === "admin" && /^\/admin(\/|$)/.test(int)) {
    return int.slice("/admin".length) || "/";
  }
  return int;
}

type Navigate = (to: string, options?: { replace?: boolean; state?: unknown }) => void;

export const useSubdomainLocation = Object.assign(
  (): [string, Navigate] => {
    const [ext, navigate] = useBrowserLocation();
    return [toInternal(ext), (to, opts) => (navigate as Navigate)(toExternal(to), opts)];
  },
  { hrefs: toExternal }
);

export const isSubdomainSpace = SPACE !== null;
