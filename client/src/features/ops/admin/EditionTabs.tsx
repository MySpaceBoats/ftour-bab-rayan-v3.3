import { useState, type ReactNode } from "react";
import { Archive } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// The editions procedures exist on the Worker router only; the client types come from the Node router.
type Status = "draft" | "active" | "archived";
export interface EditionRow { edition: number; status: Status; archived_at: string | null; days: number; volunteers: number }
const api = (trpc as unknown as { editions: { list: { useQuery: () => { data?: EditionRow[] } } } }).editions;

export interface EditionState {
  editions: EditionRow[];
  /** undefined until the list is loaded: queries then fall back to the server's active edition. */
  edition: number | undefined;
  readOnly: boolean;
  select: (edition: number) => void;
}

const fromUrl = (): number | undefined => {
  const n = Number(new URLSearchParams(window.location.search).get("edition"));
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Which edition the admin page shows: ?edition=N, else the active one, else the latest. An archived edition is read-only. */
export function useEdition(): EditionState {
  const { data } = api.list.useQuery();
  const [picked, setPicked] = useState<number | undefined>(fromUrl);
  const editions = (data ?? []).filter(e => e.status !== "draft" || e.days > 0);
  const fallback = editions.find(e => e.status === "active")?.edition ?? editions[editions.length - 1]?.edition;
  const edition = picked ?? fallback;
  const readOnly = editions.find(e => e.edition === edition)?.status === "archived";
  return { editions, edition, readOnly, select: setPicked };
}

/** Tabs on top of the page; an archived edition shows a banner and every control inside becomes inert. */
export function EditionFrame({ ed, children }: { ed: EditionState; children: ReactNode }) {
  if (ed.editions.length < 2) return <>{children}</>;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-2">
        <Tabs value={String(ed.edition)} onValueChange={v => ed.select(Number(v))}>
          <TabsList>
            {ed.editions.map(e => (
              <TabsTrigger key={e.edition} value={String(e.edition)}>
                Édition {e.edition}
                {e.status === "archived" && <span className="ml-1.5 text-xs text-amber-700">· archivée</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {ed.readOnly && (
        <div role="status" className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <Archive className="h-4 w-4 shrink-0" aria-hidden />
          Édition archivée : consultation en lecture seule.
        </div>
      )}
      <fieldset disabled={ed.readOnly} className="contents">{children}</fieldset>
    </>
  );
}
