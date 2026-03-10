import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  Trophy,
  CheckCircle,
  XCircle,
  Clock,
  Vote,
  Users,
  Settings,
  BarChart3,
  ArrowLeft,
  Star,
  RefreshCw,
} from "lucide-react";
import {
  useAdminCandidates,
  useAdminUpdateCandidateStatus,
  useAdminStats,
  useAdminLiveRanking,
  useAdminUpdateSettings,
  useAdminListVotes,
  useAdminDeleteCandidate,
  useElectionSettings,
} from "../electionApi";
import { toast } from "sonner";

const CURRENT_YEAR = new Date().getFullYear();

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending:  { label: "En attente", className: "bg-amber-100 text-amber-700 border-amber-200" },
    approved: { label: "Approuvé",   className: "bg-green-100 text-green-700 border-green-200" },
    rejected: { label: "Refusé",     className: "bg-red-100 text-red-700 border-red-200" },
  };
  const c = config[status] ?? { label: status, className: "" };
  return <Badge className={c.className}>{c.label}</Badge>;
}

export default function AdminElections() {
  const [tab, setTab] = useState("candidats");
  const [maxManagersInput, setMaxManagersInput] = useState("");

  const settingsQuery = useElectionSettings();
  const candidatesQuery = useAdminCandidates();
  const statsQuery = useAdminStats();
  const rankingQuery = useAdminLiveRanking();
  const votesQuery = useAdminListVotes();

  const updateStatus = useAdminUpdateCandidateStatus();
  const updateSettings = useAdminUpdateSettings();
  const deleteCandidate = useAdminDeleteCandidate();

  const settings = settingsQuery.data;
  const candidates = candidatesQuery.data ?? [];
  const stats = statsQuery.data;
  const ranking = rankingQuery.data ?? [];
  const votes = votesQuery.data ?? [];

  const handleApprove = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ candidateId: id, status: "approved" });
      toast.success("Candidat approuvé");
    } catch { toast.error("Erreur lors de l'approbation"); }
  };

  const handleReject = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ candidateId: id, status: "rejected" });
      toast.success("Candidat refusé");
    } catch { toast.error("Erreur lors du refus"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce candidat ? Cette action supprime aussi ses votes.")) return;
    try {
      await deleteCandidate.mutateAsync({ candidateId: id });
      toast.success("Candidat supprimé");
    } catch { toast.error("Erreur lors de la suppression"); }
  };

  const handleToggleElection = async (isOpen: boolean) => {
    try {
      await updateSettings.mutateAsync({ is_open: isOpen });
      toast.success(isOpen ? "Élection ouverte !" : "Élection fermée.");
    } catch { toast.error("Erreur lors de la mise à jour"); }
  };

  const handleUpdateMaxManagers = async () => {
    const n = parseInt(maxManagersInput);
    if (isNaN(n) || n < 1 || n > 50) {
      toast.error("Valeur invalide (1–50)");
      return;
    }
    try {
      await updateSettings.mutateAsync({ max_managers: n });
      setMaxManagersInput("");
      toast.success("Nombre de managers mis à jour");
    } catch { toast.error("Erreur lors de la mise à jour"); }
  };

  const isLoading = settingsQuery.isLoading || candidatesQuery.isLoading;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-[#4A4829] text-[#F2E9D3] px-6 py-4 flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="text-[#CDBB8A] hover:text-[#F2E9D3] hover:bg-[#5E5B34]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <Trophy className="h-5 w-5 text-amber-400" />
        <h1 className="text-xl font-bold">Election Managers — {CURRENT_YEAR}</h1>

        {settings && (
          <Badge className={settings.is_open ? "bg-green-600 text-white ml-auto" : "bg-stone-600 text-white ml-auto"}>
            {settings.is_open ? "Ouverte" : "Fermée"}
          </Badge>
        )}
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-stone-900">{stats.totalCandidates}</div>
                <div className="text-xs text-stone-500 mt-1 flex items-center justify-center gap-1">
                  <Users className="h-3 w-3" /> Candidats total
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.approvedCandidates}</div>
                <div className="text-xs text-stone-500 mt-1">Approuvés</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{stats.pendingCandidates}</div>
                <div className="text-xs text-stone-500 mt-1">En attente</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalVotes}</div>
                <div className="text-xs text-stone-500 mt-1 flex items-center justify-center gap-1">
                  <Vote className="h-3 w-3" /> Votes
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="candidats">
                <Users className="h-4 w-4 mr-1.5" /> Candidats
              </TabsTrigger>
              <TabsTrigger value="classement">
                <BarChart3 className="h-4 w-4 mr-1.5" /> Classement live
              </TabsTrigger>
              <TabsTrigger value="votes">
                <Vote className="h-4 w-4 mr-1.5" /> Votes
              </TabsTrigger>
              <TabsTrigger value="parametres">
                <Settings className="h-4 w-4 mr-1.5" /> Paramètres
              </TabsTrigger>
            </TabsList>

            {/* ── CANDIDATS ── */}
            <TabsContent value="candidats">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des candidatures ({candidates.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidat</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Participations</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {candidates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-stone-500 py-8">
                              Aucune candidature
                            </TableCell>
                          </TableRow>
                        ) : (
                          candidates.map(c => (
                            <TableRow key={c.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={c.photo_url ?? undefined} />
                                    <AvatarFallback className="bg-amber-100 text-amber-800 text-sm font-bold">
                                      {c.first_name[0]}{c.last_name[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium text-stone-900">
                                      {c.first_name} {c.last_name}
                                    </div>
                                    {c.motivation_text && (
                                      <div className="text-xs text-stone-400 truncate max-w-xs">
                                        {c.motivation_text}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-stone-600 text-sm">{c.email}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                  <span className="font-medium">{c.participation_count}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={c.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {c.status !== "approved" && (
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white h-7 px-2"
                                      onClick={() => handleApprove(c.id)}
                                      disabled={updateStatus.isPending}
                                    >
                                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                      Approuver
                                    </Button>
                                  )}
                                  {c.status !== "rejected" && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 px-2"
                                      onClick={() => handleReject(c.id)}
                                      disabled={updateStatus.isPending}
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-1" />
                                      Refuser
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-red-600 hover:bg-red-50"
                                    onClick={() => handleDelete(c.id)}
                                    disabled={deleteCandidate.isPending}
                                  >
                                    Suppr.
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── CLASSEMENT LIVE ── */}
            <TabsContent value="classement">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Classement en temps réel</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Mis à jour toutes les 10 secondes
                  </div>
                </CardHeader>
                <CardContent>
                  {ranking.length === 0 ? (
                    <p className="text-center text-stone-500 py-8">
                      Aucun résultat disponible.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ranking.map((c, idx) => {
                        const isElected = idx < (settings?.max_managers ?? 10);
                        const totalVotes = ranking.reduce((s, r) => s + r.votes, 0);
                        const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;

                        return (
                          <div
                            key={c.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${
                              isElected ? "border-green-200 bg-green-50" : "border-stone-100 bg-white"
                            }`}
                          >
                            <span className="w-6 text-center font-bold text-stone-500 text-sm">
                              {idx + 1}
                            </span>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={c.photo_url ?? undefined} />
                              <AvatarFallback className="bg-amber-100 text-amber-800 text-sm font-bold">
                                {c.first_name[0]}{c.last_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-stone-900 text-sm">
                                {c.first_name} {c.last_name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-stone-400 w-7">{pct}%</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <div className="font-bold text-stone-900">{c.votes}</div>
                              <div className="text-xs text-stone-400">votes</div>
                            </div>
                            {isElected && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs flex-shrink-0">
                                Élu
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── VOTES AUDIT ── */}
            <TabsContent value="votes">
              <Card>
                <CardHeader>
                  <CardTitle>Journal des votes ({votes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Votant</TableHead>
                          <TableHead>Candidat ID</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {votes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-stone-500 py-8">
                              Aucun vote enregistré
                            </TableCell>
                          </TableRow>
                        ) : (
                          votes.map(v => (
                            <TableRow key={v.id}>
                              <TableCell className="font-mono text-sm">{v.voter_email}</TableCell>
                              <TableCell className="font-mono text-xs text-stone-400 truncate max-w-xs">
                                {v.candidate_id}
                              </TableCell>
                              <TableCell className="text-sm text-stone-600">
                                {new Date(v.created_at).toLocaleString("fr-FR")}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── PARAMETRES ── */}
            <TabsContent value="parametres">
              <div className="space-y-4 max-w-lg">
                {/* Ouvrir/fermer l'élection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Contrôle de l'élection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Élection ouverte</Label>
                        <p className="text-sm text-stone-500">
                          Permettre aux bénévoles éligibles de voter.
                        </p>
                      </div>
                      <Switch
                        checked={settings?.is_open ?? false}
                        onCheckedChange={handleToggleElection}
                        disabled={updateSettings.isPending}
                      />
                    </div>

                    {settings?.is_open && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700 font-medium">Élection en cours</span>
                      </div>
                    )}
                    {settings && !settings.is_open && (
                      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                        <Clock className="h-4 w-4 text-stone-400" />
                        <span className="text-sm text-stone-500">Élection fermée</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Nombre max de managers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Nombre de managers à élire</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-stone-600">
                      Actuellement : <strong>{settings?.max_managers ?? 10}</strong> managers
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        placeholder="Ex : 10"
                        value={maxManagersInput}
                        onChange={e => setMaxManagersInput(e.target.value)}
                        className="max-w-[120px]"
                      />
                      <Button
                        onClick={handleUpdateMaxManagers}
                        disabled={updateSettings.isPending || !maxManagersInput}
                        className="bg-[#4A4829] text-[#F2E9D3] hover:bg-[#3A3820]"
                      >
                        {updateSettings.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Mettre à jour"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Liens publics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pages publiques</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Link href="/election-managers">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        Page élection (vote)
                      </Button>
                    </Link>
                    <Link href="/resultats-election">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        Page résultats
                      </Button>
                    </Link>
                    <Link href="/candidature-manager">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        Page candidature
                      </Button>
                    </Link>
                    <Link href="/managers">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        Historique managers
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
