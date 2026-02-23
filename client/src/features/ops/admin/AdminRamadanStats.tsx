import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-MA').format(value || 0);
}

export default function AdminRamadanStats() {
  const [configForm, setConfigForm] = useState({ hijriYear: '1447', gregorianStartDate: '', timezone: 'Africa/Casablanca' });
  const [form, setForm] = useState({ ramadanDay: 1, beneficiariesServed: 0, mealsDistributed: 0, volunteersPresent: 0, notes: '' });
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [period, setPeriod] = useState<'7'|'14'|'30'|'custom'>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const configQuery = trpc.ramadan.getConfig.useQuery();
  const summaryQuery = trpc.ramadan.publicSummary.useQuery();

  const activeConfig = configQuery.data?.active;
  const activeConfigId = activeConfig?.id;
  const activeStartDate = (activeConfig as any)?.gregorianStartDate ?? (activeConfig as any)?.gregorian_start_date;

  const range = useMemo(() => {
    if (!activeConfig || !activeStartDate) return { from: undefined, to: undefined };
    if (period === 'custom') return { from: customFrom || undefined, to: customTo || undefined };

    const fromDay = period === '7' ? 24 : period === '14' ? 17 : 1;
    const start = new Date(`${activeStartDate}T00:00:00Z`);

    if (Number.isNaN(start.getTime())) {
      return { from: undefined, to: undefined };
    }

    start.setUTCDate(start.getUTCDate() + fromDay - 1);
    return { from: start.toISOString().slice(0, 10), to: undefined };
  }, [activeConfig, activeStartDate, period, customFrom, customTo]);

  const statsQuery = trpc.ramadan.listStats.useQuery(
    activeConfigId ? { configId: activeConfigId, from: range.from, to: range.to } : undefined as any,
    { enabled: Boolean(activeConfigId) }
  );

  const utils = trpc.useUtils();

  const refresh = async () => {
    await Promise.all([
      utils.ramadan.getConfig.invalidate(),
      utils.ramadan.publicSummary.invalidate(),
      utils.ramadan.listStats.invalidate(),
    ]);
  };

  const createConfig = trpc.ramadan.createConfig.useMutation({
    onSuccess: () => { toast.success('Configuration Ramadan enregistrée'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const upsert = trpc.ramadan.upsertStat.useMutation({
    onSuccess: () => {
      toast.success(editingRowId ? 'Statistiques modifiées' : 'Statistiques enregistrées');
      setEditingRowId(null);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.ramadan.deleteStat.useMutation({
    onSuccess: () => { toast.success('Ligne supprimée'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const onCreateConfig = () => {
    if (!configForm.gregorianStartDate) return toast.error('Date de début requise');
    createConfig.mutate({ ...configForm, isActive: true });
  };

  const onSave = () => {
    if (!activeConfigId) return toast.error('Créer/activer une configuration Ramadan d’abord');
    upsert.mutate({ configId: activeConfigId, ...form });
  };

  const onEditRow = (row: any) => {
    setEditingRowId(row.id);
    setForm({
      ramadanDay: row.ramadan_day,
      beneficiariesServed: row.beneficiaries_served,
      mealsDistributed: row.meals_distributed,
      volunteersPresent: row.volunteers_present,
      notes: row.notes ?? '',
    });
  };

  const onCancelEdit = () => {
    setEditingRowId(null);
    setForm({ ramadanDay: 1, beneficiariesServed: 0, mealsDistributed: 0, volunteersPresent: 0, notes: '' });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <div>
              <h1 className="font-bold text-lg">Stats Ftour – Ramadan {summaryQuery.data?.hijriYear ?? '1447'}</h1>
              <p className="text-xs text-muted-foreground">Données saisies quotidiennement + cumul et périodes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Jour Ramadan (aujourd’hui)</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{summaryQuery.data?.todayRamadanDay ?? '—'}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total repas (à date)</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{formatNumber(summaryQuery.data?.totalsToDate.meals || 0)}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total bénéficiaires (à date)</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{formatNumber(summaryQuery.data?.totalsToDate.beneficiaries || 0)}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bénévoles (présences cumulées)</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{formatNumber(summaryQuery.data?.totalsToDate.volunteersPresence || 0)}</CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Configuration Ramadan active</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <div><Label>Année hijri</Label><Input value={configForm.hijriYear} onChange={(e)=>setConfigForm(v=>({...v,hijriYear:e.target.value}))} /></div>
            <div><Label>1er jour (grégorien)</Label><Input type="date" value={configForm.gregorianStartDate} onChange={(e)=>setConfigForm(v=>({...v,gregorianStartDate:e.target.value}))} /></div>
            <div><Label>Timezone</Label><Input value={configForm.timezone} onChange={(e)=>setConfigForm(v=>({...v,timezone:e.target.value}))} /></div>
            <div className="flex items-end"><Button onClick={onCreateConfig} disabled={createConfig.isPending}>{createConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer / Activer</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{editingRowId ? 'Modifier une saisie' : 'Saisie du jour'}</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-5 gap-4">
            <div><Label>Jour Ramadan</Label><Select value={String(form.ramadanDay)} onValueChange={(v)=>setForm(s=>({...s,ramadanDay:Number(v)}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({length:30}).map((_,i)=><SelectItem key={i+1} value={String(i+1)}>{i+1}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Bénéficiaires</Label><Input type="number" min={0} value={form.beneficiariesServed} onChange={(e)=>setForm(s=>({...s,beneficiariesServed:Number(e.target.value)}))} /></div>
            <div><Label>Repas</Label><Input type="number" min={0} value={form.mealsDistributed} onChange={(e)=>setForm(s=>({...s,mealsDistributed:Number(e.target.value)}))} /></div>
            <div><Label>Bénévoles</Label><Input type="number" min={0} value={form.volunteersPresent} onChange={(e)=>setForm(s=>({...s,volunteersPresent:Number(e.target.value)}))} /></div>
            <div className="flex items-end gap-2">
              <Button onClick={onSave} disabled={upsert.isPending}>{editingRowId ? 'Mettre à jour' : 'Enregistrer'}</Button>
              {editingRowId ? <Button variant="outline" onClick={onCancelEdit}>Annuler</Button> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Données journalières</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={period==='7'?'default':'outline'} onClick={()=>setPeriod('7')}>7 jours</Button>
              <Button size="sm" variant={period==='14'?'default':'outline'} onClick={()=>setPeriod('14')}>14 jours</Button>
              <Button size="sm" variant={period==='30'?'default':'outline'} onClick={()=>setPeriod('30')}>Mois complet</Button>
              <Button size="sm" variant={period==='custom'?'default':'outline'} onClick={()=>setPeriod('custom')}>Intervalle custom</Button>
              {period === 'custom' && <><Input type="date" value={customFrom} onChange={(e)=>setCustomFrom(e.target.value)} className="w-40" /><Input type="date" value={customTo} onChange={(e)=>setCustomTo(e.target.value)} className="w-40" /></>}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Jour Ramadan</TableHead><TableHead>Date</TableHead><TableHead>Bénéficiaires</TableHead><TableHead>Repas</TableHead><TableHead>Bénévoles</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {(statsQuery.data?.rows || []).map((row: any)=>(
                  <TableRow key={row.id}><TableCell>{row.ramadan_day}</TableCell><TableCell>{row.gregorian_date}</TableCell><TableCell>{formatNumber(row.beneficiaries_served)}</TableCell><TableCell>{formatNumber(row.meals_distributed)}</TableCell><TableCell>{formatNumber(row.volunteers_present)}</TableCell><TableCell><div className="flex items-center gap-1"><Button size="icon" variant="ghost" onClick={()=>onEditRow(row)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={()=>remove.mutate({ id: row.id })}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-sm font-medium">Totaux période — Repas: {formatNumber(statsQuery.data?.totals.meals || 0)} · Bénéficiaires: {formatNumber(statsQuery.data?.totals.beneficiaries || 0)} · Bénévoles (présences): {formatNumber(statsQuery.data?.totals.volunteersPresence || 0)}</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
