import { useEffect } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { useI18n } from "@/i18n";

/** Old inbox/conversation URLs (bookmarks, links) keep working. `from` is the old route prefix, `source` the thread kind. */
export function RedirectMessages({ from, source }: { from: string; source?: "pro" | "market" }) {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const [, params] = useRoute(`${from}/:threadId`);
  const search = useSearch();
  useEffect(() => {
    const base = `/${lang}/benevole/espace/messages`;
    setLocation(`${source && params?.threadId ? `${base}/${source}/${params.threadId}` : base}${search ? `?${search}` : ""}`, { replace: true });
  }, [lang, params?.threadId, search, setLocation, source]);
  return null;
}
