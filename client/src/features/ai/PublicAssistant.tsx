import { useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import * as ai from "./ai-api";

// ponytail: three tiny dictionaries instead of touching the big i18n files; the bot itself answers in the visitor's language.
const T = {
  fr: { open: "Poser une question", title: "Assistant Ftour Bab Rayan", ph: "Votre question…", empty: "Posez votre question sur le ftour, les réservations, le bénévolat ou les dons.", s: ["Comment réserver un ftour ?", "Comment devenir bénévole ?", "Comment faire un don ?"] },
  en: { open: "Ask a question", title: "Ftour Bab Rayan assistant", ph: "Your question…", empty: "Ask about the iftar, reservations, volunteering or donations.", s: ["How do I book an iftar?", "How do I volunteer?", "How can I donate?"] },
  ar: { open: "اطرح سؤالاً", title: "مساعد فطور باب الريان", ph: "سؤالك…", empty: "اسأل عن الإفطار أو الحجز أو التطوع أو التبرع.", s: ["كيف أحجز إفطاراً؟", "كيف أصبح متطوعاً؟", "كيف أتبرع؟"] },
} as const;

/** Floating assistant for the public site. Hidden inside the volunteer hub and the admin area. */
export default function PublicAssistant() {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const lang = (["fr", "en", "ar"] as const).find(l => path.startsWith(`/${l}`)) ?? "fr";
  const t = T[lang];
  if (path.includes("/benevole/espace") || path.startsWith("/admin") || path.startsWith("/scanner")) return null;

  const send = async (content: string) => {
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const reply = await ai.askPublic(next.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      toast.error((e as Error).message);
      setMessages(messages); // drop the unanswered question so the user can retry
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed bottom-5 left-5 z-50" dir={lang === "ar" ? "rtl" : "ltr"}>
      {open ? (
        <div className="w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between bg-blue-800 px-4 py-2 text-sm font-semibold text-white">
            {t.title}
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="rounded p-1 hover:bg-blue-700"><X size={16} aria-hidden /></button>
          </div>
          <AIChatBox messages={messages} onSendMessage={send} isLoading={busy} placeholder={t.ph} height="420px" emptyStateMessage={t.empty} suggestedPrompts={[...t.s]} />
        </div>
      ) : (
        <button onClick={() => setOpen(true)} aria-label={t.open} className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-800 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2">
          <MessageCircle size={26} aria-hidden />
        </button>
      )}
    </div>
  );
}
