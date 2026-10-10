import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as mt from "../meetup/meetup-api";

const STATUS: Record<string, string> = { active: "Actif", cancelled: "Annulé", hidden: "Masqué" };

export default function MeetupAdmin() {
  const [meetups, setMeetups] = useState<mt.AdminMeetup[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setMeetups(await mt.adminMeetups()); } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Meetup : meetups ({meetups.length})</h2>
      {!loading && meetups.length === 0 && <p className="text-sm text-muted-foreground">Aucun meetup.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Titre</th><th className="p-2">Organisateur</th><th className="p-2">Lieu</th><th className="p-2">Début</th><th className="p-2">Inscrits</th><th className="p-2">Statut</th><th className="p-2" /></tr></thead>
          <tbody>
            {meetups.map(x => (
              <tr key={x.id} className="border-t">
                <td className="p-2 break-words">{x.title}</td>
                <td className="p-2">{x.organizer}</td>
                <td className="p-2">{x.city}, {x.country}</td>
                <td className="p-2 whitespace-nowrap">{x.starts_at.replace("T", " ")}</td>
                <td className="p-2 whitespace-nowrap">{x.going_count}/{x.capacity}{x.waitlist_count > 0 ? ` (+${x.waitlist_count})` : ""}</td>
                <td className="p-2">{STATUS[x.status] ?? x.status}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={busy || x.status === "hidden"} onClick={() => window.confirm(`Masquer le meetup « ${x.title} » ?`) && run(() => mt.adminHideMeetup(x.id), "Meetup masqué")}>Masquer</Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => window.confirm(`Supprimer définitivement le meetup « ${x.title} » et ses inscriptions ?`) && run(() => mt.adminDeleteMeetup(x.id), "Meetup supprimé")}>Supprimer</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
