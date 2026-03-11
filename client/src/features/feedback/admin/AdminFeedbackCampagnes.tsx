import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Send,
  Mail,
  Users,
  CheckCircle,
  Eye,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ============================================
// CONSTANTES
// ============================================

const STATUS_CONFIG = {
  draft: { label: "Brouillon", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
  scheduled: { label: "Planifiée", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  sent: { label: "Envoyée", color: "bg-green-500/20 text-green-300 border-green-500/30" },
} as const;

const TARGET_GROUP_LABELS: Record<string, string> = {
  volunteers: "Bénévoles",
  restaurant_clients: "Clients restaurant",
  foodstore_clients: "Clients foodstore",
  all: "Tous",
  test: "Test (équipe interne)",
};

const DEFAULT_EMAIL_CONTENT = `Merci d'avoir participé aux actions de Bab Rayan pendant ce Ramadan.

Nous aimerions connaître votre ressenti afin d'améliorer nos actions.

Cliquez sur le bouton ci-dessous pour partager votre avis.

Cela prend moins de 2 minutes.

Merci pour votre contribution.`;

// ============================================
// CREATE CAMPAIGN DIALOG
// ============================================

function CreateCampaignDialog({
  forms,
  onClose,
  onCreated,
}: {
  forms: any[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [targetGroup, setTargetGroup] = useState<string>("volunteers");
  const [formId, setFormId] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("Votre avis compte pour nous — Bab Rayan");
  const [emailContent, setEmailContent] = useState(DEFAULT_EMAIL_CONTENT);

  const createMutation = trpc.feedback.createCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campagne créée avec succès");
      onCreated();
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de la création"),
  });

  const handleCreate = () => {
    if (!title.trim()) { toast.error("Nom requis"); return; }
    if (!formId) { toast.error("Veuillez sélectionner un formulaire"); return; }
    if (!emailSubject.trim()) { toast.error("Objet email requis"); return; }
    if (!emailContent.trim()) { toast.error("Contenu email requis"); return; }

    createMutation.mutate({
      title,
      targetGroup: targetGroup as any,
      formId: parseInt(formId),
      emailSubject,
      emailContent,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#2D2B15] border-[#F2E9D3]/20 text-[#F2E9D3] max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F2E9D3] flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#C9B97A]" />
            Nouvelle campagne
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[#C9B97A] text-sm mb-1 block">Nom de la campagne *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Feedback Ramadan 2026"
              className="bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3] placeholder:text-[#F2E9D3]/30"
            />
          </div>

          <div>
            <Label className="text-[#C9B97A] text-sm mb-1 block">Groupe destinataire *</Label>
            <Select value={targetGroup} onValueChange={setTargetGroup}>
              <SelectTrigger className="bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2D2B15] border-[#F2E9D3]/20">
                <SelectItem value="test" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">🧪 Test (équipe interne)</SelectItem>
                <SelectItem value="volunteers" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">Bénévoles</SelectItem>
                <SelectItem value="restaurant_clients" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">Clients restaurant</SelectItem>
                <SelectItem value="foodstore_clients" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">Clients foodstore</SelectItem>
                <SelectItem value="all" className="text-[#F2E9D3] focus:bg-[#3D3B1E]">Tous</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[#C9B97A] text-sm mb-1 block">Formulaire *</Label>
            <Select value={formId} onValueChange={setFormId}>
              <SelectTrigger className="bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3]">
                <SelectValue placeholder="Choisir un formulaire..." />
              </SelectTrigger>
              <SelectContent className="bg-[#2D2B15] border-[#F2E9D3]/20">
                {forms.map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)} className="text-[#F2E9D3] focus:bg-[#3D3B1E]">
                    {f.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[#C9B97A] text-sm mb-1 block">Objet de l'email *</Label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3] placeholder:text-[#F2E9D3]/30"
            />
          </div>

          <div>
            <Label className="text-[#C9B97A] text-sm mb-1 block">Corps de l'email *</Label>
            <Textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={8}
              className="bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3] placeholder:text-[#F2E9D3]/30"
            />
            <p className="text-[#C9B97A]/50 text-xs mt-1">
              Un bouton "Donner mon feedback" sera automatiquement ajouté avec le lien personnalisé.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-[#C9B97A]/60">
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="bg-[#C9B97A] hover:bg-[#B5A56A] text-[#2D2B15] font-semibold"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Créer la campagne
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// SEND SELECTION DIALOG — sélection multi email
// ============================================

function SendSelectionDialog({
  campaign,
  onClose,
  onSent,
}: {
  campaign: any;
  onClose: () => void;
  onSent: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const emailsQuery = trpc.feedback.getGroupEmails.useQuery(
    { targetGroup: campaign.target_group },
    {
      onSuccess: (emails: string[]) => {
        if (!initialized) {
          setSelected(new Set(emails)); // tout coché par défaut
          setInitialized(true);
        }
      },
    }
  );

  const allEmails: string[] = emailsQuery.data ?? [];

  const filtered = useMemo(
    () => allEmails.filter((e) => e.toLowerCase().includes(search.toLowerCase())),
    [allEmails, search]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(e));

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((e) => next.delete(e));
      } else {
        filtered.forEach((e) => next.add(e));
      }
      return next;
    });
  };

  const sendMutation = trpc.feedback.sendCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(`Campagne envoyée : ${data.sent} emails envoyés${data.failed > 0 ? `, ${data.failed} échecs` : ""}`);
      onSent();
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'envoi"),
  });

  const handleSend = () => {
    if (selected.size === 0) {
      toast.error("Sélectionnez au moins un destinataire");
      return;
    }
    sendMutation.mutate({
      campaignId: campaign.id,
      selectedEmails: Array.from(selected),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#2D2B15] border-[#F2E9D3]/20 text-[#F2E9D3] max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[#F2E9D3] flex items-center gap-2">
            <Send className="w-5 h-5 text-[#C9B97A]" />
            Sélectionner les destinataires
          </DialogTitle>
          <p className="text-[#C9B97A]/70 text-sm">
            {campaign.title} — <span className="text-[#C9B97A]">{TARGET_GROUP_LABELS[campaign.target_group] ?? campaign.target_group}</span>
          </p>
        </DialogHeader>

        {emailsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-[#C9B97A]" />
          </div>
        ) : allEmails.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[#C9B97A]/60">Aucun email trouvé pour ce groupe.</p>
          </div>
        ) : (
          <>
            {/* Barre de recherche + compteurs */}
            <div className="space-y-3 px-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9B97A]/50" />
                <Input
                  placeholder="Rechercher une adresse…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-[#3D3B1E] border-[#F2E9D3]/20 text-[#F2E9D3] placeholder:text-[#F2E9D3]/30"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C9B97A]/50 hover:text-[#C9B97A]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  className="flex items-center gap-2 text-[#C9B97A] hover:text-[#F2E9D3] transition-colors"
                >
                  <Checkbox
                    checked={allFilteredSelected}
                    className="border-[#C9B97A] data-[state=checked]:bg-[#C9B97A] pointer-events-none"
                  />
                  {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}
                  {search && <span className="text-[#C9B97A]/50">({filtered.length} visibles)</span>}
                </button>
                <span className="text-[#C9B97A]/60">
                  <span className="text-[#F2E9D3] font-semibold">{selected.size}</span> / {allEmails.length} sélectionné{selected.size > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto border border-[#F2E9D3]/10 rounded-lg divide-y divide-[#F2E9D3]/5 min-h-0 max-h-[340px]">
              {filtered.length === 0 ? (
                <p className="text-center text-[#C9B97A]/40 py-6 text-sm">Aucun résultat pour "{search}"</p>
              ) : (
                filtered.map((email) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => toggle(email)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#3D3B1E]/60 ${
                      selected.has(email) ? "bg-[#C9B97A]/5" : ""
                    }`}
                  >
                    <Checkbox
                      checked={selected.has(email)}
                      className="border-[#C9B97A] data-[state=checked]:bg-[#C9B97A] pointer-events-none shrink-0"
                    />
                    <span className={`text-sm font-mono ${selected.has(email) ? "text-[#F2E9D3]" : "text-[#F2E9D3]/50"}`}>
                      {email}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="text-[#C9B97A]/60" disabled={sendMutation.isPending}>
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || selected.size === 0 || emailsQuery.isLoading}
            className="bg-[#C9B97A] hover:bg-[#B5A56A] text-[#2D2B15] font-semibold"
          >
            {sendMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi en cours…</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Envoyer à {selected.size} destinataire{selected.size > 1 ? "s" : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// CAMPAIGN STATS DIALOG
// ============================================

function CampaignStatsDialog({ campaignId, onClose }: { campaignId: number; onClose: () => void }) {
  const statsQuery = trpc.feedback.getCampaignStats.useQuery({ campaignId });
  const stats = statsQuery.data;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#2D2B15] border-[#F2E9D3]/20 text-[#F2E9D3] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F2E9D3]">Statistiques campagne</DialogTitle>
        </DialogHeader>

        {statsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#C9B97A]" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-[#3D3B1E] rounded-lg">
              <p className="text-3xl font-bold text-[#F2E9D3]">{stats?.total ?? 0}</p>
              <p className="text-[#C9B97A] text-xs mt-1">Envoyés</p>
            </div>
            <div className="text-center p-4 bg-[#3D3B1E] rounded-lg">
              <p className="text-3xl font-bold text-blue-400">{stats?.opened ?? 0}</p>
              <p className="text-[#C9B97A] text-xs mt-1">Ouverts</p>
              {(stats?.total ?? 0) > 0 && (
                <p className="text-[#C9B97A]/50 text-xs">{Math.round(((stats?.opened ?? 0) / (stats?.total ?? 1)) * 100)}%</p>
              )}
            </div>
            <div className="text-center p-4 bg-[#3D3B1E] rounded-lg">
              <p className="text-3xl font-bold text-green-400">{stats?.submitted ?? 0}</p>
              <p className="text-[#C9B97A] text-xs mt-1">Répondus</p>
              {(stats?.total ?? 0) > 0 && (
                <p className="text-[#C9B97A]/50 text-xs">{Math.round(((stats?.submitted ?? 0) / (stats?.total ?? 1)) * 100)}%</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminFeedbackCampagnes() {
  const [showCreate, setShowCreate] = useState(false);
  const [sendTarget, setSendTarget] = useState<any | null>(null); // campaign object
  const [viewStats, setViewStats] = useState<number | null>(null);

  const campaignsQuery = trpc.feedback.listCampaigns.useQuery();
  const formsQuery = trpc.feedback.listForms.useQuery();

  const campaigns = campaignsQuery.data ?? [];
  const forms = formsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[#1A1910] text-[#F2E9D3] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/feedback">
            <Button variant="ghost" size="sm" className="text-[#C9B97A] hover:text-[#F2E9D3]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Feedbacks
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#F2E9D3] flex items-center gap-2">
              <Mail className="w-6 h-6 text-[#C9B97A]" />
              Campagnes email
            </h1>
            <p className="text-[#C9B97A]/70 text-sm">Envoi de demandes de feedback par email</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#C9B97A] hover:bg-[#B5A56A] text-[#2D2B15] font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle campagne
        </Button>
      </div>

      {/* Info box */}
      <Card className="bg-[#2D2B15] border-[#C9B97A]/30 mb-6">
        <CardContent className="p-4 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-[#C9B97A] shrink-0 mt-0.5" />
          <div className="text-sm text-[#F2E9D3]/80">
            <strong className="text-[#C9B97A]">Comment ça marche :</strong> Créez une campagne, puis cliquez "Envoyer campagne" pour choisir précisément les destinataires.
            Chaque personne reçoit un lien unique sécurisé. Vous pouvez cocher/décocher individuellement ou par groupe.
          </div>
        </CardContent>
      </Card>

      {/* Campaigns list */}
      {campaignsQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9B97A]" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="bg-[#2D2B15] border-[#F2E9D3]/10">
          <CardContent className="p-12 text-center">
            <Mail className="w-12 h-12 text-[#C9B97A]/40 mx-auto mb-4" />
            <p className="text-[#C9B97A]/60">Aucune campagne créée</p>
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-4 bg-[#C9B97A] hover:bg-[#B5A56A] text-[#2D2B15] font-semibold"
            >
              Créer la première campagne
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign: any) => {
            const statusCfg = STATUS_CONFIG[campaign.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
            const form = (campaign.feedback_forms as any);

            return (
              <Card key={campaign.id} className="bg-[#2D2B15] border-[#F2E9D3]/10">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-[#F2E9D3]">{campaign.title}</h3>
                        <Badge className={`text-xs border ${statusCfg.color}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#C9B97A]/70">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {TARGET_GROUP_LABELS[campaign.target_group] ?? campaign.target_group}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {campaign.email_subject}
                        </span>
                        {form?.title && (
                          <span>Formulaire : {form.title}</span>
                        )}
                        {campaign.sent_at && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            Envoyé le {format(new Date(campaign.sent_at), "dd MMM yyyy", { locale: fr })}
                          </span>
                        )}
                        {!campaign.sent_at && (
                          <span className="text-[#F2E9D3]/40">
                            Créé le {format(new Date(campaign.created_at), "dd MMM yyyy", { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {campaign.status === "sent" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#C9B97A]/30 text-[#C9B97A] hover:bg-[#C9B97A]/10"
                          onClick={() => setViewStats(campaign.id)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Stats
                        </Button>
                      )}
                      {campaign.status !== "sent" && (
                        <Button
                          size="sm"
                          className="bg-[#C9B97A] hover:bg-[#B5A56A] text-[#2D2B15] font-semibold"
                          onClick={() => setSendTarget(campaign)}
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          Envoyer campagne
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateCampaignDialog
          forms={forms}
          onClose={() => setShowCreate(false)}
          onCreated={() => campaignsQuery.refetch()}
        />
      )}

      {/* Multi-select send dialog */}
      {sendTarget !== null && (
        <SendSelectionDialog
          campaign={sendTarget}
          onClose={() => setSendTarget(null)}
          onSent={() => campaignsQuery.refetch()}
        />
      )}

      {/* Stats dialog */}
      {viewStats !== null && (
        <CampaignStatsDialog
          campaignId={viewStats}
          onClose={() => setViewStats(null)}
        />
      )}
    </div>
  );
}
