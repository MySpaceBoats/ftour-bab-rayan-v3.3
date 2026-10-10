import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import * as hub from "./api";

/** Current hub member; sends the visitor back to the login screen when the session is missing or revoked. */
export function useHubMember(): hub.Member | undefined {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const [me, setMe] = useState<hub.Member | undefined>();
  useEffect(() => {
    const login = `/${lang}/benevole/espace`;
    hub.getMe().then(setMe).catch(() => setLocation(login));
    const back = () => setLocation(login);
    window.addEventListener("hub:unauthorized", back);
    return () => window.removeEventListener("hub:unauthorized", back);
  }, [lang, setLocation]);
  return me;
}
