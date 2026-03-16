import { useState, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Loader2, Pencil, X, Users,
  Search, Upload, GripVertical, Eye, EyeOff, ChevronUp, ChevronDown,
} from "lucide-react";

// ============================================
// CONSTANTS
// ============================================
const DEFAULT_EDITION = 12;

// ============================================
// TYPES
// ============================================
interface TeamMember {
  id: number;
  firstName: string;
  lastName: string;
  role: string | null;
  citation: string | null;
  photoUrl: string | null;
  displayOrder: number;
  edition: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  role: string;
  citation: string;
  photoBase64: string;
  photoUrl: string;
  displayOrder: string;
  edition: string;
  isActive: boolean;
}

const emptyForm = (): FormState => ({
  firstName: "",
  lastName: "",
  role: "",
  citation: "",
  photoBase64: "",
  photoUrl: "",
  displayOrder: "0",
  edition: String(DEFAULT_EDITION),
  isActive: true,
});

// ============================================
// IMAGE UPLOAD HELPER
// ============================================
function useImageUpload(onSelect: (base64: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);

  const trigger = () => inputRef.current?.click();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop grande (max 5 MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => onSelect(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const inputEl = (
    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
  );

  return { trigger, inputEl };
}

// ============================================
// MEMBER FORM
// ============================================
function MemberForm({
  form, onChange, onSubmit, onCancel, isLoading, title,
}: {
  form: FormState;
  onChange: (f: Partial<FormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  title: string;
}) {
  const { trigger, inputEl } = useImageUpload((b64) => onChange({ photoBase64: b64 }));
  const previewSrc = form.photoBase64 || form.photoUrl;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Prénom *</Label>
            <Input value={form.firstName} onChange={(e) => onChange({ firstName: e.target.value })} placeholder="Prénom" />
          </div>
          <div className="space-y-1">
            <Label>Nom *</Label>
            <Input value={form.lastName} onChange={(e) => onChange({ lastName: e.target.value })} placeholder="Nom" />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Rôle</Label>
          <Input value={form.role} onChange={(e) => onChange({ role: e.target.value })} placeholder="Ex: Manager Logistique" />
        </div>

        <div className="space-y-1">
          <Label>Citation personnelle</Label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.citation}
            onChange={(e) => onChange({ citation: e.target.value })}
            placeholder="Une citation inspirante…"
          />
        </div>

        {/* Photo */}
        <div className="space-y-2">
          <Label>Photo</Label>
          <div className="flex items-start gap-4">
            {previewSrc ? (
              <div className="relative">
                <img src={previewSrc} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                <button
                  onClick={() => onChange({ photoBase64: "", photoUrl: "" })}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                <Users className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <Button type="button" variant="outline" size="sm" onClick={trigger} className="gap-2">
                <Upload className="w-4 h-4" />
                Choisir une photo
              </Button>
              {inputEl}
              <p className="text-xs text-muted-foreground">Format carré recommandé · Max 5 MB</p>
              <div className="space-y-1">
                <Label className="text-xs">Ou URL directe</Label>
                <Input
                  value={form.photoUrl}
                  onChange={(e) => onChange({ photoUrl: e.target.value, photoBase64: "" })}
                  placeholder="https://…"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Ordre d'affichage</Label>
            <Input
              type="number"
              min={0}
              value={form.displayOrder}
              onChange={(e) => onChange({ displayOrder: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Édition</Label>
            <Input
              type="number"
              min={1}
              value={form.edition}
              onChange={(e) => onChange({ edition: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => onChange({ isActive: v })}
            id="isActive"
          />
          <Label htmlFor="isActive">Actif (visible sur le site)</Label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={onSubmit} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Enregistrer
          </Button>
          <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MEMBER ROW
// ============================================
function MemberRow({
  member, onEdit, onDelete, onToggle, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  member: TeamMember;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${member.isActive ? "bg-background" : "bg-muted/40 opacity-70"}`}>
      {/* Reorder */}
      <div className="flex flex-col gap-0.5">
        <button disabled={isFirst} onClick={onMoveUp} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button disabled={isLast} onClick={onMoveDown} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Photo */}
      {member.photoUrl ? (
        <img src={member.photoUrl} alt={fullName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-semibold text-sm">{initials}</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{fullName}</p>
        {member.role && <p className="text-xs text-muted-foreground truncate">{member.role}</p>}
        {member.citation && (
          <p className="text-xs text-muted-foreground italic truncate max-w-xs">
            &ldquo;{member.citation}&rdquo;
          </p>
        )}
      </div>

      {/* Badges */}
      <div className="hidden sm:flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Éd. {member.edition}</Badge>
        <Badge variant="outline" className="text-xs">#{member.displayOrder}</Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggle}
          title={member.isActive ? "Désactiver" : "Activer"}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          {member.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function AdminTeam() {
  const utils = trpc.useUtils();
  const [editionFilter, setEditionFilter] = useState<number | undefined>(DEFAULT_EDITION);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  // ── Queries ──
  const { data: members = [], isLoading, error } = trpc.team.list.useQuery(
    { edition: editionFilter },
    { staleTime: 30_000 }
  );

  // ── Mutations ──
  const createMember = trpc.team.create.useMutation({
    onSuccess: () => { utils.team.list.invalidate(); toast.success("Membre créé"); setShowForm(false); setForm(emptyForm()); },
    onError: (e) => toast.error(e.message),
  });

  const updateMember = trpc.team.update.useMutation({
    onSuccess: () => { utils.team.list.invalidate(); toast.success("Membre mis à jour"); setEditingId(null); setForm(emptyForm()); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMember = trpc.team.delete.useMutation({
    onSuccess: () => { utils.team.list.invalidate(); toast.success("Membre supprimé"); },
    onError: (e) => toast.error(e.message),
  });

  const reorderMembers = trpc.team.reorder.useMutation({
    onSuccess: () => utils.team.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  // ── Filtered list ──
  const filtered = searchQuery
    ? members.filter((m: TeamMember) =>
        `${m.firstName} ${m.lastName} ${m.role ?? ""} ${m.citation ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : members;

  // ── Handlers ──
  const changeForm = (updates: Partial<FormState>) => setForm((f) => ({ ...f, ...updates }));

  const handleCreate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { toast.error("Prénom et Nom requis"); return; }
    createMember.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role.trim() || undefined,
      citation: form.citation.trim() || undefined,
      photoBase64: form.photoBase64 || undefined,
      photoUrl: form.photoUrl.trim() || undefined,
      displayOrder: parseInt(form.displayOrder) || 0,
      edition: parseInt(form.edition) || DEFAULT_EDITION,
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    if (!form.firstName.trim() || !form.lastName.trim()) { toast.error("Prénom et Nom requis"); return; }
    updateMember.mutate({
      id: editingId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role.trim() || undefined,
      citation: form.citation.trim() || undefined,
      photoBase64: form.photoBase64 || undefined,
      photoUrl: form.photoUrl.trim() || undefined,
      displayOrder: parseInt(form.displayOrder) || 0,
      edition: parseInt(form.edition) || DEFAULT_EDITION,
      isActive: form.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Supprimer ce membre définitivement ?")) return;
    deleteMember.mutate({ id });
  };

  const handleToggle = (member: TeamMember) => {
    updateMember.mutate({ id: member.id, isActive: !member.isActive });
  };

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setShowForm(false);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role ?? "",
      citation: member.citation ?? "",
      photoBase64: "",
      photoUrl: member.photoUrl ?? "",
      displayOrder: String(member.displayOrder),
      edition: String(member.edition),
      isActive: member.isActive,
    });
  };

  const cancelEdit = () => { setEditingId(null); setShowForm(false); setForm(emptyForm()); };

  const moveItem = (idx: number, direction: "up" | "down") => {
    const sorted = [...members].sort((a: TeamMember, b: TeamMember) => a.displayOrder - b.displayOrder);
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= sorted.length) return;
    [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
    reorderMembers.mutate({ orderedIds: sorted.map((m: TeamMember) => m.id) });
  };

  const sortedFiltered = [...filtered].sort((a: TeamMember, b: TeamMember) => a.displayOrder - b.displayOrder);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Équipe Ftour – Trombinoscope</h1>
            <p className="text-xs text-muted-foreground">
              {members.length} membre{members.length !== 1 ? "s" : ""} ·{" "}
              {members.filter((m: TeamMember) => m.isActive).length} actifs
            </p>
          </div>
          <Button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm()); }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {[undefined, 12, 11, 10].map((ed) => (
              <Button
                key={ed ?? "all"}
                size="sm"
                variant={editionFilter === ed ? "default" : "outline"}
                onClick={() => setEditionFilter(ed)}
              >
                {ed ? `Éd. ${ed}` : "Toutes"}
              </Button>
            ))}
          </div>
        </div>

        {/* Create Form */}
        {showForm && (
          <MemberForm
            form={form}
            onChange={changeForm}
            onSubmit={handleCreate}
            onCancel={cancelEdit}
            isLoading={createMember.isPending}
            title="Nouveau membre"
          />
        )}

        {/* Edit Form */}
        {editingId !== null && (
          <MemberForm
            form={form}
            onChange={changeForm}
            onSubmit={handleUpdate}
            onCancel={cancelEdit}
            isLoading={updateMember.isPending}
            title="Modifier le membre"
          />
        )}

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              {sortedFiltered.length} membre{sortedFiltered.length !== 1 ? "s" : ""} affiché{sortedFiltered.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {error && (
              <p className="text-center text-destructive py-8 text-sm">
                Erreur : {error.message}
              </p>
            )}
            {!isLoading && !error && sortedFiltered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun membre trouvé</p>
              </div>
            )}
            {sortedFiltered.map((member: TeamMember, idx: number) => (
              <div key={member.id}>
                {editingId === member.id ? null : (
                  <MemberRow
                    member={member}
                    isFirst={idx === 0}
                    isLast={idx === sortedFiltered.length - 1}
                    onEdit={() => startEdit(member)}
                    onDelete={() => handleDelete(member.id)}
                    onToggle={() => handleToggle(member)}
                    onMoveUp={() => moveItem(idx, "up")}
                    onMoveDown={() => moveItem(idx, "down")}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Preview section */}
        {members.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Aperçu trombinoscope – Membres actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {members
                  .filter((m: TeamMember) => m.isActive && (editionFilter === undefined || m.edition === editionFilter))
                  .sort((a: TeamMember, b: TeamMember) => a.displayOrder - b.displayOrder)
                  .map((member: TeamMember) => {
                    const initials = `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase();
                    return (
                      <div key={member.id} className="flex flex-col items-center gap-1.5 text-center">
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={`${member.firstName} ${member.lastName}`}
                            className="w-14 h-14 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-bold">{initials}</span>
                          </div>
                        )}
                        <p className="text-xs font-medium leading-tight">{member.firstName} {member.lastName}</p>
                        {member.role && <p className="text-[10px] text-muted-foreground leading-tight">{member.role}</p>}
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
