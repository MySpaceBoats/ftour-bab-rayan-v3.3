import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import RequireRole from "@/components/RequireRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Filters = {
  userId?: string;
  action?: string;
  module?: string;
  text?: string;
  dateFrom?: string;
  dateTo?: string;
};

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queryInput = useMemo(
    () => ({
      page,
      pageSize: 50,
      ...filters,
    }),
    [filters, page],
  );

  const logsQuery = trpc.audit.list.useQuery(queryInput);
  const detailsQuery = trpc.audit.detail.useQuery(
    { id: selectedId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: !!selectedId },
  );

  const exportQuery = trpc.audit.exportCsv.useQuery(queryInput, { enabled: false });

  const handleExport = async () => {
    const csv = await exportQuery.refetch();
    if (!csv.data) return;

    const blob = new Blob([csv.data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRole allowedRoles={["admin", "super_admin"]}>
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Journal des actions</h1>
            <p className="text-muted-foreground">Traçabilité, audit sécurité et debug backend</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>Exporter logs</Button>
            <Link href="/admin"><Button variant="ghost">Retour</Button></Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Utilisateur (ID)" value={filters.userId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value || undefined }))} />
            <Input placeholder="Action" value={filters.action ?? ""} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value || undefined }))} />
            <Input placeholder="Module (entity_type)" value={filters.module ?? ""} onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value || undefined }))} />
            <Input placeholder="Recherche texte" value={filters.text ?? ""} onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value || undefined }))} />
            <Input type="date" value={filters.dateFrom ?? ""} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))} />
            <Input type="date" value={filters.dateTo ?? ""} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2">Date</th><th className="p-2">Utilisateur</th><th className="p-2">Email</th><th className="p-2">Action</th><th className="p-2">Type objet</th><th className="p-2">ID objet</th><th className="p-2">Description</th><th className="p-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {(logsQuery.data?.items ?? []).map((log: any) => (
                  <tr key={log.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedId(log.id)}>
                    <td className="p-2">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-2">{log.user_id || "-"}</td>
                    <td className="p-2">{log.user_email || "-"}</td>
                    <td className="p-2">{log.action}</td>
                    <td className="p-2">{log.entity_type || "-"}</td>
                    <td className="p-2">{log.entity_id || "-"}</td>
                    <td className="p-2">{log.description || "-"}</td>
                    <td className="p-2">{log.ip_address || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total: {logsQuery.data?.total ?? 0}</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</Button>
            <Button variant="outline" disabled={page >= (logsQuery.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>

        <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Détail du log</DialogTitle>
              <DialogDescription>Metadata JSON, user agent, IP et payload complet.</DialogDescription>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs">
              {JSON.stringify(detailsQuery.data ?? {}, null, 2)}
            </pre>
          </DialogContent>
        </Dialog>
      </div>
    </RequireRole>
  );
}
