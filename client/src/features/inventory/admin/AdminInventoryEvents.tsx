import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import RequireRole from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Warehouse, MapPin, ArrowLeftRight,
  BarChart3, Package, Edit, RotateCcw,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; variant: any; color: string }> = {
  draft:    { label: 'Brouillon', variant: 'secondary', color: 'text-gray-600' },
  open:     { label: 'Ouvert',    variant: 'default',   color: 'text-green-600' },
  closed:   { label: 'Fermé',     variant: 'outline',   color: 'text-red-600' },
  archived: { label: 'Archivé',   variant: 'secondary', color: 'text-muted-foreground' },
};

const emptyEventForm = { name: "", description: "", startsAt: "", endsAt: "", status: "draft" as const };
const emptyLocForm = { type: "EVENT_BUFFER" as const, code: "", name: "" };
const emptyTransferForm = { productId: "", quantity: "", fromLocationId: "", toLocationId: "", reason: "" };
const emptyReturnForm = { productId: "", quantity: "", fromPosId: "", toBufferId: "", reason: "" };

export default function AdminInventoryEvents() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [showCreateLoc, setShowCreateLoc] = useState(false);
  const [locForm, setLocForm] = useState(emptyLocForm);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState(emptyTransferForm);
  const [showReturn, setShowReturn] = useState(false);
  const [returnForm, setReturnForm] = useState(emptyReturnForm);

  // Queries
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = trpc.inventory.events.list.useQuery({});
  const { data: products } = trpc.inventory.products.list.useQuery({ isActive: true });
  const { data: globalLoc } = trpc.inventory.locations.globalLocation.useQuery();

  const { data: eventLocations, refetch: refetchLocs } = trpc.inventory.locations.list.useQuery(
    { eventId: selectedEventId! },
    { enabled: selectedEventId !== null }
  );
  const { data: eventReport, refetch: refetchReport } = trpc.inventory.events.report.useQuery(
    { eventId: selectedEventId! },
    { enabled: selectedEventId !== null }
  );

  const bufferLocation = (eventLocations ?? []).find((l: any) => l.type === 'EVENT_BUFFER');
  const posLocations   = (eventLocations ?? []).filter((l: any) => l.type === 'POS');

  // Mutations
  const createEvent = trpc.inventory.events.create.useMutation({
    onSuccess: () => { toast.success("Événement créé"); setShowCreateEvent(false); setEventForm(emptyEventForm); refetchEvents(); },
    onError: (e) => toast.error(e.message),
  });
  const updateEvent = trpc.inventory.events.update.useMutation({
    onSuccess: () => { toast.success("Événement mis à jour"); refetchEvents(); },
    onError: (e) => toast.error(e.message),
  });
  const createLocation = trpc.inventory.locations.create.useMutation({
    onSuccess: () => { toast.success("Emplacement créé"); setShowCreateLoc(false); setLocForm(emptyLocForm); refetchLocs(); },
    onError: (e) => toast.error(e.message),
  });
  const doTransfer = trpc.inventory.stock.transfer.useMutation({
    onSuccess: () => { toast.success("Transfert effectué"); setShowTransfer(false); setTransferForm(emptyTransferForm); refetchReport(); },
    onError: (e) => toast.error(e.message),
  });
  const doReturn = trpc.inventory.stock.recordReturn.useMutation({
    onSuccess: () => { toast.success("Retour enregistré"); setShowReturn(false); setReturnForm(emptyReturnForm); refetchReport(); },
    onError: (e) => toast.error(e.message),
  });

  const handleCreateLoc = () => {
    if (!selectedEventId) return;
    const code = locForm.code || `${locForm.type}-EVT${selectedEventId}-${Date.now()}`;
    createLocation.mutate({
      type: locForm.type,
      code,
      name: locForm.name,
      eventId: selectedEventId,
      parentLocationId: locForm.type === 'POS' ? (bufferLocation?.id ?? null) : null,
    });
  };

  const handleTransfer = () => {
    doTransfer.mutate({
      productId: parseInt(transferForm.productId),
      quantity: parseInt(transferForm.quantity),
      fromLocationId: parseInt(transferForm.fromLocationId),
      toLocationId: parseInt(transferForm.toLocationId),
      eventId: selectedEventId,
      reason: transferForm.reason || undefined,
    });
  };

  const handleReturn = () => {
    doReturn.mutate({
      productId: parseInt(returnForm.productId),
      quantity: parseInt(returnForm.quantity),
      fromPosLocationId: parseInt(returnForm.fromPosId),
      toBufferLocationId: parseInt(returnForm.toBufferId),
      eventId: selectedEventId,
      reason: returnForm.reason || undefined,
    });
  };

  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_ops", "admin_boutique", "admin_patisserie", "admin_terroir"]}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/inventory">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-green-700" /> Événements & Stocks
            </h1>
            <p className="text-muted-foreground text-sm">Gérer les stocks par événement et points de vente</p>
          </div>
          <Button onClick={() => setShowCreateEvent(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nouvel événement
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Events list */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Événements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {eventsLoading ? (
                <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : !(events ?? []).length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Aucun événement</p>
                </div>
              ) : (
                <div className="divide-y">
                  {(events ?? []).map((e: any) => {
                    const s = STATUS_LABELS[e.status] ?? STATUS_LABELS.draft;
                    return (
                      <button
                        key={e.id}
                        className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${selectedEventId === e.id ? 'bg-muted' : ''}`}
                        onClick={() => { setSelectedEventId(e.id); setActiveTab("overview"); }}
                      >
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-sm">{e.name}</p>
                          <Badge variant={s.variant} className="text-xs shrink-0 ml-2">{s.label}</Badge>
                        </div>
                        {e.starts_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(e.starts_at).toLocaleDateString('fr-FR')}
                            {e.ends_at && ` → ${new Date(e.ends_at).toLocaleDateString('fr-FR')}`}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event detail */}
          <div className="lg:col-span-2">
            {!selectedEventId ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Warehouse className="h-12 w-12 mb-3 opacity-30" />
                  <p>Sélectionnez un événement</p>
                </CardContent>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                  <TabsTrigger value="pos">Points de vente</TabsTrigger>
                  <TabsTrigger value="transfer">Transfert</TabsTrigger>
                  <TabsTrigger value="return">Retours</TabsTrigger>
                </TabsList>

                {/* Overview */}
                <TabsContent value="overview" className="space-y-4">
                  {/* Buffer status */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Warehouse className="h-4 w-4" /> Stock buffer de l'événement
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={() => setShowCreateLoc(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter emplacement
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {!bufferLocation ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          <p>Pas encore de stock buffer pour cet événement.</p>
                          <Button size="sm" className="mt-2" onClick={() => { setLocForm({ ...emptyLocForm, type: 'EVENT_BUFFER' }); setShowCreateLoc(true); }}>
                            Créer le stock buffer
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-green-700">{bufferLocation.name}</p>
                          <p className="text-xs text-muted-foreground">Code : {bufferLocation.code}</p>
                          {/* Buffer balances from report */}
                          <div className="mt-3 space-y-1">
                            {(eventReport?.balances ?? [])
                              .filter((b: any) => b.location_id === bufferLocation.id)
                              .map((b: any) => (
                                <div key={b.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                                  <span>{b.inventory_products?.name}</span>
                                  <span className="font-bold">{b.quantity_on_hand}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* POS list */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Points de vente ({posLocations.length})
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={() => { setLocForm({ ...emptyLocForm, type: 'POS' }); setShowCreateLoc(true); }}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter POS
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {!posLocations.length ? (
                        <p className="text-muted-foreground text-sm text-center py-2">Aucun point de vente</p>
                      ) : (
                        <div className="divide-y">
                          {posLocations.map((pos: any) => {
                            const report = (eventReport?.posReports ?? []).find((r: any) => r.location?.id === pos.id);
                            return (
                              <div key={pos.id} className="py-3">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-sm">{pos.name}</p>
                                  <Badge variant="outline" className="text-xs">{pos.code}</Badge>
                                </div>
                                {report && (
                                  <div className="grid grid-cols-4 gap-2 mt-2 text-xs text-center">
                                    <div><p className="text-muted-foreground">Dispatché</p><p className="font-bold text-blue-600">{report.dispatched}</p></div>
                                    <div><p className="text-muted-foreground">Vendu</p><p className="font-bold text-red-600">{report.sold}</p></div>
                                    <div><p className="text-muted-foreground">Retourné</p><p className="font-bold text-amber-600">{report.returned}</p></div>
                                    <div><p className="text-muted-foreground">Stock</p><p className={`font-bold ${report.currentStock === 0 ? 'text-red-500' : 'text-green-600'}`}>{report.currentStock}</p></div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* POS detail */}
                <TabsContent value="pos">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Bilan par point de vente</CardTitle></CardHeader>
                    <CardContent>
                      {!(eventReport?.posReports ?? []).length ? (
                        <p className="text-muted-foreground text-sm text-center py-4">Aucun POS pour cet événement</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Point de vente</TableHead>
                              <TableHead className="text-right">Dispatché</TableHead>
                              <TableHead className="text-right">Vendu</TableHead>
                              <TableHead className="text-right">Retourné</TableHead>
                              <TableHead className="text-right">Stock actuel</TableHead>
                              <TableHead className="text-right">Écart</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(eventReport?.posReports ?? []).map((r: any) => (
                              <TableRow key={r.location?.id}>
                                <TableCell className="font-medium">{r.location?.name}</TableCell>
                                <TableCell className="text-right">{r.dispatched}</TableCell>
                                <TableCell className="text-right text-red-600">{r.sold}</TableCell>
                                <TableCell className="text-right text-amber-600">{r.returned}</TableCell>
                                <TableCell className="text-right font-bold">{r.currentStock}</TableCell>
                                <TableCell className="text-right">
                                  <span className={r.variance !== 0 ? 'text-red-500 font-bold' : 'text-muted-foreground'}>
                                    {r.variance > 0 ? `+${r.variance}` : r.variance}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Transfer */}
                <TabsContent value="transfer">
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Transfert de stock</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Produit *</Label>
                        <Select value={transferForm.productId} onValueChange={v => setTransferForm(f => ({ ...f, productId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                          <SelectContent>
                            {(products ?? []).map((p: any) => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantité *</Label>
                        <Input type="number" min={1} value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Depuis *</Label>
                        <Select value={transferForm.fromLocationId} onValueChange={v => setTransferForm(f => ({ ...f, fromLocationId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Emplacement source" /></SelectTrigger>
                          <SelectContent>
                            {globalLoc && <SelectItem value={globalLoc.id.toString()}>Stock Global — {globalLoc.name}</SelectItem>}
                            {bufferLocation && <SelectItem value={bufferLocation.id.toString()}>Buffer — {bufferLocation.name}</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Vers *</Label>
                        <Select value={transferForm.toLocationId} onValueChange={v => setTransferForm(f => ({ ...f, toLocationId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Emplacement destination" /></SelectTrigger>
                          <SelectContent>
                            {bufferLocation && <SelectItem value={bufferLocation.id.toString()}>Buffer — {bufferLocation.name}</SelectItem>}
                            {posLocations.map((p: any) => (
                              <SelectItem key={p.id} value={p.id.toString()}>POS — {p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Motif</Label>
                        <Input value={transferForm.reason} onChange={e => setTransferForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ex: Approvisionnement stand 1" />
                      </div>
                      <Button
                        className="w-full"
                        disabled={!transferForm.productId || !transferForm.quantity || !transferForm.fromLocationId || !transferForm.toLocationId || doTransfer.isPending}
                        onClick={handleTransfer}
                      >
                        {doTransfer.isPending ? "Transfert en cours..." : "Effectuer le transfert"}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Return */}
                <TabsContent value="return">
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Retour POS → Buffer</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Produit *</Label>
                        <Select value={returnForm.productId} onValueChange={v => setReturnForm(f => ({ ...f, productId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                          <SelectContent>
                            {(products ?? []).map((p: any) => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantité retournée *</Label>
                        <Input type="number" min={1} value={returnForm.quantity} onChange={e => setReturnForm(f => ({ ...f, quantity: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Point de vente source *</Label>
                        <Select value={returnForm.fromPosId} onValueChange={v => setReturnForm(f => ({ ...f, fromPosId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Choisir le POS" /></SelectTrigger>
                          <SelectContent>
                            {posLocations.map((p: any) => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Buffer destination *</Label>
                        <Select value={returnForm.toBufferId} onValueChange={v => setReturnForm(f => ({ ...f, toBufferId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Buffer de destination" /></SelectTrigger>
                          <SelectContent>
                            {bufferLocation && <SelectItem value={bufferLocation.id.toString()}>{bufferLocation.name}</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Motif *</Label>
                        <Input value={returnForm.reason} onChange={e => setReturnForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ex: Fin de service, invendus" />
                      </div>
                      <Button
                        className="w-full"
                        disabled={!returnForm.productId || !returnForm.quantity || !returnForm.fromPosId || !returnForm.toBufferId || !returnForm.reason || doReturn.isPending}
                        onClick={handleReturn}
                      >
                        {doReturn.isPending ? "Enregistrement..." : "Enregistrer le retour"}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Create Event Dialog */}
        <Dialog open={showCreateEvent} onOpenChange={v => { if (!v) setShowCreateEvent(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nouvel événement</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Ftour Bab Rayan - 15 mars 2026" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Début</Label>
                  <Input type="datetime-local" value={eventForm.startsAt} onChange={e => setEventForm(f => ({ ...f, startsAt: e.target.value }))} />
                </div>
                <div>
                  <Label>Fin</Label>
                  <Input type="datetime-local" value={eventForm.endsAt} onChange={e => setEventForm(f => ({ ...f, endsAt: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={eventForm.status} onValueChange={v => setEventForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([v, { label }]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreateEvent(false)}>Annuler</Button>
                <Button onClick={() => createEvent.mutate(eventForm)} disabled={!eventForm.name || createEvent.isPending}>
                  {createEvent.isPending ? "Création..." : "Créer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Location Dialog */}
        <Dialog open={showCreateLoc} onOpenChange={v => { if (!v) setShowCreateLoc(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Ajouter un emplacement</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type *</Label>
                <Select value={locForm.type} onValueChange={v => setLocForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EVENT_BUFFER">Buffer d'événement</SelectItem>
                    <SelectItem value="POS">Point de vente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nom *</Label>
                <Input value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Stand 1 — Entrée" />
              </div>
              <div>
                <Label>Code (optionnel, auto-généré si vide)</Label>
                <Input value={locForm.code} onChange={e => setLocForm(f => ({ ...f, code: e.target.value }))} placeholder="Ex: POS-STAND-1" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreateLoc(false)}>Annuler</Button>
                <Button onClick={handleCreateLoc} disabled={!locForm.name || createLocation.isPending}>
                  {createLocation.isPending ? "Création..." : "Créer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RequireRole>
  );
}
