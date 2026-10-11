/** OpenRouter client with model fallback + reply helpers. Pure: fetch is injected, nothing touches D1 or HTTP routing. */
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
export class AiUnavailable extends Error {}

export const ESCALATE = "[ESCALADE]";
export const DEFAULT_MODELS = "openrouter/free";
const URL = "https://openrouter.ai/api/v1/chat/completions";

export const parseModels = (v?: string): string[] => {
  const l = (v ?? DEFAULT_MODELS).split(",").map(s => s.trim()).filter(Boolean);
  return l.length ? l : [DEFAULT_MODELS];
};

/** First non-empty reply wins; 429/5xx/network/empty falls through to the next model. */
export async function complete(fetchFn: FetchLike, apiKey: string | undefined, models: string[], messages: ChatMsg[]): Promise<string> {
  if (!apiKey) throw new AiUnavailable("OPENROUTER_API_KEY missing");
  for (const model of models) {
    try {
      const res = await fetchFn(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Ftour Bab Rayan" },
        body: JSON.stringify({ model, messages, max_tokens: 700 }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) { console.error(`[ai] ${model} -> ${res.status}`); continue; }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e) {
      console.error(`[ai] ${model} failed`, e);
    }
  }
  throw new AiUnavailable("all models failed");
}

export const splitEscalation = (text: string): { reply: string; escalate: boolean } => ({
  reply: text.replaceAll(ESCALATE, "").trim(),
  escalate: text.includes(ESCALATE),
});
export const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
/** Case summary when no model can write one: the last 6 raw lines. */
export const fallbackSummary = (lines: string[]) => lines.slice(-6).join("\n");
