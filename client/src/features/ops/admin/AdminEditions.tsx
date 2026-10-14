import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Archive, ArchiveRestore, CalendarPlus, Eye, Loader2, Play } from "lucide-react";
import { trpc } from "@/lib/trpc";
import RequireRole from "@/components/RequireRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RAMADAN_DATE_RANGES } from "@shared/config/ramadanDates";

// The editions procedures exist on the Worker router only; the client types come from the Node router.
type Status = "draft" | "active" | "archived";
interface EditionRow { edition: number; status: Status; archived_at: string | null; days: number; volunteers: number }
interface CalendarForm { edition: number; startDate: string; endDate: string; capacity: number; iftarTime: string; location: string }
type Mutation<I> = { useMutation: (o: { onSuccess: () => void; onError: (e: { message: string }) => void }) => { mutate: (i: I) => void; isPending: boolean } };
const api = (trpc as unknown as { editions: EditionsApi }).editions;
interface EditionsApi {
  list: { useQuery: () => { data?: EditionRow[]; isLoading: boolean; error: { message: string } | null; refetch: () => void } };
  archive: Mutation<{ edition: number }>;
  unarchive: Mutation<{ edition: number }>;
  activate: Mutation<{ edition: number }>;
  setupCalendar: Mutation<CalendarForm>;
}

const STATUS_LABEL: Record<Status, string> = { draft: "Brouillon", active: "Active", archived: "Archivée" };
const STATUS_CLASS: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-700",
  active: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-800",
};

/** Edition N is the Ramadan of year 2014 + N (edition 1 = 2015). Dates come from the shared Ramadan config when known. */
function defaultDates(edition: number): { startDate: string; endDate: string } {
  const range = RAMADAN_DATE_RANGES.find(r => r.year === 2014 + edition);
  return range ? { startDate: range.startDate, endDate: range.endDate } : { startDate: "", endDate: "" };
}

export default function AdminEditions() {
  const { data, isLoading, error, refetch } = api.list.useQuery();
  const [confirm, setConfirm] = useState<{ kind: "archive" | "activate" | "unarchive"; edition: number } | null>(null);
  const [calendar, setCalendar] = useState<CalendarForm | null>(null);

  const done = (msg: string) => () => { toast.success(msg); setConfirm(null); setCalendar(null); refetch(); };
  const fail = (e: { message: string }) => toast.error(e.message);
  const archive = api.archive.useMutation({ onSuccess: done("Édition archivée"), onError: fail });
  const unarchive = api.unarchive.useMutation({ onSuccess: done("Édition désarchivée (brouillon)"), onError: fail });
  const activate = api.activate.useMutation({ onSuccess: done("Édition activée"), onError: fail });
  const setup = api.setupCalendar.useMutation({ onSuccess: done("Calendrier créé"), onError: fail });

  const activeEdition = data?.find(e => e.status === "active")?.edition;
  const busy = archive.isPending || unarchive.isPending || activate.isPending;

  const confirmCopy = {
    archive: { title: "Archiver l'édition", body: "Toutes ses journées sont fermées aux inscriptions. Rien n'est supprimé : les données restent consultables en lecture seule et l'archivage est réversible.", cta: "Archiver" },
    activate: { title: "Activer l'édition", body: "Elle devient l'édition du site public, des inscriptions et de l'admin par défaut.", cta: "Activer" },
    unarchive: { title: "Désarchiver l'édition", body: "Elle repasse en brouillon, ses journées restent fermées. Vous pourrez ensuite l'activer.", cta: "Désarchiver" },
  } as const;

  return (
    <RequireRole allowedRoles={["admin", "super_admin"]}>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Éditions</h1>
          <p className="text-sm text-muted-foreground">Une seule édition est active à la fois. Une édition archivée garde toutes ses données, en lecture seule.</p>
        </div>

        {isLoading && <Loader2 className="h-6 w-6 animate-spin" aria-label="Chargement" />}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-900">{error.message}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {data?.map(e => (
            <Card key={e.edition}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Édition {e.edition}</CardTitle>
                <Badge className={STATUS_CLASS[e.status]}>{STATUS_LABEL[e.status]}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {e.days} jour{e.days > 1 ? "s" : ""} · {e.volunteers} bénévole{e.volunteers > 1 ? "s" : ""}
                  {e.archived_at && ` · archivée le ${new Date(e.archived_at).toLocaleDateString("fr-FR")}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {e.status === "active" && (
                    <Button variant="outline" disabled={busy} onClick={() => setConfirm({ kind: "archive", edition: e.edition })}>
                      <Archive className="mr-2 h-4 w-4" /> Archiver
                    </Button>
                  )}
                  {e.status === "archived" && (
                    <>
                      <Button asChild variant="outline"><Link href={`/admin/jours?edition=${e.edition}`}><Eye className="mr-2 h-4 w-4" /> Consulter</Link></Button>
                      <Button variant="outline" disabled={busy} onClick={() => setConfirm({ kind: "unarchive", edition: e.edition })}>
                        <ArchiveRestore className="mr-2 h-4 w-4" /> Désarchiver
                      </Button>
                    </>
                  )}
                  {e.status === "draft" && e.days === 0 && (
                    <Button onClick={() => setCalendar({ edition: e.edition, ...defaultDates(e.edition), capacity: 120, iftarTime: "18:30", location: "" })}>
                      <CalendarPlus className="mr-2 h-4 w-4" /> Préparer le calendrier
                    </Button>
                  )}
                  {e.status === "draft" && e.days > 0 && (
                    <Button disabled={busy || activeEdition !== undefined} onClick={() => setConfirm({ kind: "activate", edition: e.edition })}>
                      <Play className="mr-2 h-4 w-4" /> Activer
                    </Button>
                  )}
                </div>
                {e.status === "draft" && e.days > 0 && activeEdition !== undefined && (
                  <p className="text-xs text-muted-foreground">Archivez d'abord l'édition {activeEdition} pour pouvoir activer celle-ci.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <AlertDialog open={confirm !== null} onOpenChange={o => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm && `${confirmCopy[confirm.kind].title} ${confirm.edition}`}</AlertDialogTitle>
              <AlertDialogDescription>{confirm && confirmCopy[confirm.kind].body}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={ev => {
                  ev.preventDefault();
                  if (!confirm) return;
                  const input = { edition: confirm.edition };
                  if (confirm.kind === "archive") archive.mutate(input);
                  else if (confirm.kind === "activate") activate.mutate(input);
                  else unarchive.mutate(input);
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirm && confirmCopy[confirm.kind].cta}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={calendar !== null} onOpenChange={o => !o && setCalendar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Calendrier de l'édition {calendar?.edition}</DialogTitle>
              <DialogDescription>Une journée est créée pour chaque date (fermée aux inscriptions : l'ouverture se fait ensuite au fil des jours). Vous pourrez modifier chaque journée.</DialogDescription>
            </DialogHeader>
            {calendar && (
              <form
                id="calendar-form"
                className="grid grid-cols-2 gap-4"
                onSubmit={ev => { ev.preventDefault(); setup.mutate(calendar); }}
              >
                <div className="space-y-1.5"><Label htmlFor="cal-start">Premier jour</Label><Input id="cal-start" type="date" required value={calendar.startDate} onChange={ev => setCalendar({ ...calendar, startDate: ev.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="cal-end">Dernier jour</Label><Input id="cal-end" type="date" required value={calendar.endDate} onChange={ev => setCalendar({ ...calendar, endDate: ev.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="cal-cap">Capacité par jour</Label><Input id="cal-cap" type="number" min={1} required value={calendar.capacity} onChange={ev => setCalendar({ ...calendar, capacity: Number(ev.target.value) })} /></div>
                <div className="space-y-1.5"><Label htmlFor="cal-iftar">Heure d'iftar</Label><Input id="cal-iftar" type="time" value={calendar.iftarTime} onChange={ev => setCalendar({ ...calendar, iftarTime: ev.target.value })} /></div>
                <div className="col-span-2 space-y-1.5"><Label htmlFor="cal-loc">Lieu</Label><Input id="cal-loc" value={calendar.location} onChange={ev => setCalendar({ ...calendar, location: ev.target.value })} /></div>
              </form>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCalendar(null)}>Annuler</Button>
              <Button type="submit" form="calendar-form" disabled={setup.isPending}>
                {setup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer les journées"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequireRole>
  );
}
