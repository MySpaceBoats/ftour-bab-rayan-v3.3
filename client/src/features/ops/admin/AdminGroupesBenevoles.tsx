import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
} from "lucide-react";

const slotLabel: Record<string, string> = {
  preparation_ftour: "Préparation ftour",
  service_ftour: "Service ftour",
};

export default function AdminGroupesBenevoles() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const query = trpc.volunteers.listGroupRequests.useQuery();
  const utils = trpc.useUtils();

  const reviewMutation = trpc.volunteers.reviewGroupRequest.useMutation({
    onSuccess: () => {
      toast.success("Demande mise à jour");
      utils.volunteers.listGroupRequests.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.volunteers.deleteGroupRequest.useMutation({
    onSuccess: () => {
      toast.success("Demande supprimée");
      utils.volunteers.listGroupRequests.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.volunteers.updateGroupRequest.useMutation({
    onSuccess: (_result, variables) => {
      toast.success("Demande modifiée");
      utils.volunteers.listGroupRequests.setData(undefined, previous => {
        if (!previous || !editing) return previous;
        return previous.map((row: any) =>
          row.id === variables.requestId
            ? {
                ...row,
                groupName: editing.groupName,
                responsibleName: editing.responsibleName,
                responsibleEmail: editing.responsibleEmail,
                responsiblePhone: editing.responsiblePhone,
                estimatedSize: editing.estimatedSize,
              }
            : row
        );
      });
      setIsEditDialogOpen(false);
      setEditing(null);
      utils.volunteers.listGroupRequests.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const openEditDialog = (row: any) => {
    setEditing({
      ...row,
      estimatedSize: row.estimatedSize ?? "",
    });
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditing(null);
    }
  };

  const filtered = useMemo(() => {
    const rows = query.data || [];
    return rows.filter((row: any) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        row.groupName?.toLowerCase().includes(q) ||
        row.responsibleName?.toLowerCase().includes(q) ||
        row.responsibleEmail?.toLowerCase().includes(q)
      );
    });
  }, [query.data, search, statusFilter]);

  const handleDownloadAttachment = async (
    requestId: number,
    fallbackFileName: string
  ) => {
    try {
      const attachment = await utils.volunteers.getGroupRequestAttachment.fetch({
        requestId,
      });
      const raw = attachment.fileBase64.includes(",")
        ? attachment.fileBase64.split(",").pop() || ""
        : attachment.fileBase64;
      const blob = new Blob([
        Uint8Array.from(atob(raw), char => char.charCodeAt(0)),
      ]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        attachment.fileName || fallbackFileName || `groupe_${requestId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.message || "Impossible de télécharger la pièce jointe");
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Dashboard groupe bénévole</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demandes d'inscription groupes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input
              placeholder="Rechercher groupe/email"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="validated">Validé</SelectItem>
                <SelectItem value="refused">Refusé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {query.error ? (
            <div className="text-sm text-destructive">
              Erreur chargement demandes: {query.error.message}
            </div>
          ) : query.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Groupe</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Jour / Date</TableHead>
                  <TableHead>Effectif</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Pièce jointe</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.groupName}</div>
                      <div className="text-xs text-muted-foreground">
                        {(row.volunteerSlots || [])
                          .map((s: string) => slotLabel[s] || s)
                          .join(", ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{row.responsibleName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.responsibleEmail}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.day
                        ? `Jour ${row.day.dayNumber} — ${
                            row.day.date
                              ? new Date(row.day.date).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "long",
                                })
                              : "—"
                          }`
                        : "-"}
                    </TableCell>
                    <TableCell>{row.estimatedSize || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "validated"
                            ? "default"
                            : row.status === "refused"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownloadAttachment(
                            row.id,
                            row.fileName || `groupe_${row.id}.xlsx`
                          )
                        }
                      >
                        <Download className="h-4 w-4 mr-1" /> Télécharger
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          disabled={
                            row.status !== "pending" || reviewMutation.isPending
                          }
                          onClick={() =>
                            reviewMutation.mutate({
                              requestId: row.id,
                              action: "validate",
                            })
                          }
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={
                            row.status !== "pending" || reviewMutation.isPending
                          }
                          onClick={() => {
                            const reason =
                              window.prompt("Motif de refus (optionnel)") ||
                              undefined;
                            reviewMutation.mutate({
                              requestId: row.id,
                              action: "refuse",
                              rejectionReason: reason,
                            });
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Refuser
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            deleteMutation.mutate({ requestId: row.id })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={closeEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la demande</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nom groupe</Label>
                <Input
                  value={editing.groupName}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      groupName: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Responsable</Label>
                <Input
                  value={editing.responsibleName}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      responsibleName: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={editing.responsibleEmail}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      responsibleEmail: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input
                  value={editing.responsiblePhone}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      responsiblePhone: e.target.value,
                    })
                  }
                />
              </div>
              <Button
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    requestId: editing.id,
                    groupName: editing.groupName,
                    responsibleName: editing.responsibleName,
                    responsibleEmail: editing.responsibleEmail,
                    responsiblePhone: editing.responsiblePhone,
                    estimatedSize: editing.estimatedSize
                      ? Number(editing.estimatedSize)
                      : null,
                  })
                }
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  "Sauvegarder"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
