import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Pencil, X,
  Users, MessageSquare, HelpCircle, Search,
} from 'lucide-react';

type SectionKey = 'partners' | 'testimonials' | 'faq';

const SECTION_CONFIG: Record<SectionKey, { label: string; icon: typeof Users }> = {
  partners: { label: 'Partenaires', icon: Users },
  testimonials: { label: 'Témoignages', icon: MessageSquare },
  faq: { label: 'FAQ', icon: HelpCircle },
};

const FAQ_CATEGORIES = [
  { value: 'benevole', label: 'Bénévolat' },
  { value: 'don', label: 'Dons' },
  { value: 'goodies', label: 'Goodies' },
  { value: 'evenement', label: 'Événement' },
];

export default function AdminContenu() {
  const utils = trpc.useUtils();
  const [section, setSection] = useState<SectionKey>('partners');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<Record<string, string>>({});

  // ============ DATA QUERIES ============
  const { data: partners = [], isLoading: loadingPartners, error: errorPartners } = trpc.content.partners.list.useQuery();
  const { data: testimonials = [], isLoading: loadingTestimonials, error: errorTestimonials } = trpc.content.testimonials.list.useQuery();
  const { data: faqs = [], isLoading: loadingFaqs, error: errorFaqs } = trpc.content.faq.list.useQuery();

  // ============ MUTATIONS ============
  // Partners
  const createPartner = trpc.content.partners.create.useMutation({
    onSuccess: () => { utils.content.partners.list.invalidate(); toast.success('Partenaire créé'); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updatePartner = trpc.content.partners.update.useMutation({
    onSuccess: () => { utils.content.partners.list.invalidate(); toast.success('Partenaire mis à jour'); setEditingId(null); },
    onError: (err: any) => toast.error(err.message),
  });
  const deletePartner = trpc.content.partners.delete.useMutation({
    onSuccess: () => { utils.content.partners.list.invalidate(); toast.success('Partenaire supprimé'); },
    onError: (err: any) => toast.error(err.message),
  });
  const togglePartner = trpc.content.partners.update.useMutation({
    onSuccess: () => { utils.content.partners.list.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  // Testimonials
  const createTestimonial = trpc.content.testimonials.create.useMutation({
    onSuccess: () => { utils.content.testimonials.list.invalidate(); toast.success('Témoignage créé'); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateTestimonial = trpc.content.testimonials.update.useMutation({
    onSuccess: () => { utils.content.testimonials.list.invalidate(); toast.success('Témoignage mis à jour'); setEditingId(null); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteTestimonial = trpc.content.testimonials.delete.useMutation({
    onSuccess: () => { utils.content.testimonials.list.invalidate(); toast.success('Témoignage supprimé'); },
    onError: (err: any) => toast.error(err.message),
  });
  const toggleTestimonial = trpc.content.testimonials.update.useMutation({
    onSuccess: () => { utils.content.testimonials.list.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  // FAQ
  const createFaq = trpc.content.faq.create.useMutation({
    onSuccess: () => { utils.content.faq.list.invalidate(); toast.success('FAQ créée'); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateFaq = trpc.content.faq.update.useMutation({
    onSuccess: () => { utils.content.faq.list.invalidate(); toast.success('FAQ mise à jour'); setEditingId(null); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteFaq = trpc.content.faq.delete.useMutation({
    onSuccess: () => { utils.content.faq.list.invalidate(); toast.success('FAQ supprimée'); },
    onError: (err: any) => toast.error(err.message),
  });
  const toggleFaq = trpc.content.faq.update.useMutation({
    onSuccess: () => { utils.content.faq.list.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  // ============ HELPERS ============
  const resetForm = () => setFormData({});

  const isLoading = section === 'partners' ? loadingPartners : section === 'testimonials' ? loadingTestimonials : loadingFaqs;
  const error = section === 'partners' ? errorPartners : section === 'testimonials' ? errorTestimonials : errorFaqs;

  const items: any[] = useMemo(() => {
    const raw = section === 'partners' ? partners : section === 'testimonials' ? testimonials : faqs;
    if (!searchQuery) return raw as any[];
    return (raw as any[]).filter((item: any) => {
      const text = JSON.stringify(item).toLowerCase();
      return text.includes(searchQuery.toLowerCase());
    });
  }, [section, partners, testimonials, faqs, searchQuery]);

  // ============ FORM HANDLERS ============
  const handleCreate = () => {
    if (section === 'partners') {
      if (!formData.name?.trim()) { toast.error('Nom requis'); return; }
      createPartner.mutate({ name: formData.name, description: formData.description, websiteUrl: formData.websiteUrl, logoUrl: formData.logoUrl });
    } else if (section === 'testimonials') {
      if (!formData.content?.trim() || !formData.authorName?.trim()) { toast.error('Contenu et auteur requis'); return; }
      createTestimonial.mutate({ content: formData.content, authorName: formData.authorName, authorRole: formData.authorRole, rating: formData.rating ? parseInt(formData.rating) : undefined });
    } else {
      if (!formData.question?.trim() || !formData.answer?.trim()) { toast.error('Question et réponse requises'); return; }
      createFaq.mutate({ question: formData.question, answer: formData.answer, category: formData.category || 'evenement' });
    }
  };

  const handleUpdate = (id: number) => {
    if (section === 'partners') {
      updatePartner.mutate({ id, name: formData.name, description: formData.description, websiteUrl: formData.websiteUrl, logoUrl: formData.logoUrl });
    } else if (section === 'testimonials') {
      updateTestimonial.mutate({ id, content: formData.content, authorName: formData.authorName, authorRole: formData.authorRole, rating: formData.rating ? parseInt(formData.rating) : undefined });
    } else {
      updateFaq.mutate({ id, question: formData.question, answer: formData.answer, category: formData.category });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm('Supprimer cet élément ?')) return;
    if (section === 'partners') deletePartner.mutate({ id });
    else if (section === 'testimonials') deleteTestimonial.mutate({ id });
    else deleteFaq.mutate({ id });
  };

  const handleToggle = (id: number, isActive: boolean) => {
    if (section === 'partners') togglePartner.mutate({ id, isActive: !isActive });
    else if (section === 'testimonials') toggleTestimonial.mutate({ id, isActive: !isActive });
    else toggleFaq.mutate({ id, isActive: !isActive });
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    if (section === 'partners') {
      setFormData({ name: item.name || '', description: item.description || '', websiteUrl: item.websiteUrl || '', logoUrl: item.logoUrl || '' });
    } else if (section === 'testimonials') {
      setFormData({ content: item.content || '', authorName: item.authorName || '', authorRole: item.authorRole || '', rating: String(item.rating || 5) });
    } else {
      setFormData({ question: item.question || '', answer: item.answer || '', category: item.category || '' });
    }
  };

  const isCreating = createPartner.isPending || createTestimonial.isPending || createFaq.isPending;
  const isUpdating = updatePartner.isPending || updateTestimonial.isPending || updateFaq.isPending;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Gestion du contenu</h1>
            <p className="text-xs text-muted-foreground">Partenaires / Témoignages / FAQ — {items.length} éléments</p>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SECTION_CONFIG) as SectionKey[]).map((key) => {
            const Icon = SECTION_CONFIG[key].icon;
            return (
              <Button
                key={key}
                variant={section === key ? 'default' : 'outline'}
                onClick={() => { setSection(key); setEditingId(null); resetForm(); setSearchQuery(''); }}
              >
                <Icon className="h-4 w-4 mr-2" />
                {SECTION_CONFIG[key].label}
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="pl-10" />
        </div>

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50 p-4">
            <p className="text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error.message}</p>
          </Card>
        )}

        {/* Create / Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Modifier' : 'Ajouter'} — {SECTION_CONFIG[section].label}</CardTitle>
          </CardHeader>
          <CardContent>
            {section === 'partners' && (
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label>Nom *</Label><Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nom du partenaire" /></div>
                <div><Label>Description</Label><Input value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description" /></div>
                <div><Label>Site web</Label><Input value={formData.websiteUrl || ''} onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })} placeholder="https://..." /></div>
                <div><Label>Logo URL</Label><Input value={formData.logoUrl || ''} onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} placeholder="https://..." /></div>
              </div>
            )}
            {section === 'testimonials' && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2"><Label>Contenu *</Label><Input value={formData.content || ''} onChange={(e) => setFormData({ ...formData, content: e.target.value })} placeholder="Le témoignage..." /></div>
                <div><Label>Auteur *</Label><Input value={formData.authorName || ''} onChange={(e) => setFormData({ ...formData, authorName: e.target.value })} placeholder="Nom de l'auteur" /></div>
                <div><Label>Rôle</Label><Input value={formData.authorRole || ''} onChange={(e) => setFormData({ ...formData, authorRole: e.target.value })} placeholder="Bénévole, Donateur..." /></div>
                <div><Label>Note (1-5)</Label><Input type="number" min="1" max="5" value={formData.rating || '5'} onChange={(e) => setFormData({ ...formData, rating: e.target.value })} /></div>
              </div>
            )}
            {section === 'faq' && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2"><Label>Question *</Label><Input value={formData.question || ''} onChange={(e) => setFormData({ ...formData, question: e.target.value })} placeholder="Comment...?" /></div>
                <div className="md:col-span-2"><Label>Réponse *</Label><Input value={formData.answer || ''} onChange={(e) => setFormData({ ...formData, answer: e.target.value })} placeholder="La réponse..." /></div>
                <div>
                  <Label>Catégorie</Label>
                  <select
                    value={formData.category || 'evenement'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    {FAQ_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              {editingId ? (
                <>
                  <Button onClick={() => handleUpdate(editingId)} disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
                    Enregistrer
                  </Button>
                  <Button variant="outline" onClick={() => { setEditingId(null); resetForm(); }}>
                    <X className="h-4 w-4 mr-2" /> Annuler
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Ajouter
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Items List */}
        {!isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Éléments ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun élément dans cette section.</p>
              )}
              {items.map((item: any) => (
                <div key={item.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {section === 'partners' && (
                      <>
                        <p className="font-medium">{item.name}</p>
                        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                        {item.websiteUrl && <p className="text-xs text-blue-600 truncate">{item.websiteUrl}</p>}
                      </>
                    )}
                    {section === 'testimonials' && (
                      <>
                        <p className="text-sm italic">"{item.content}"</p>
                        <p className="text-sm font-medium mt-1">— {item.authorName}{item.authorRole ? `, ${item.authorRole}` : ''}</p>
                        {item.rating && <p className="text-xs text-amber-500">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</p>}
                      </>
                    )}
                    {section === 'faq' && (
                      <>
                        <p className="font-medium">{item.question}</p>
                        <p className="text-sm text-muted-foreground mt-1">{item.answer}</p>
                        <Badge variant="outline" className="mt-1">{FAQ_CATEGORIES.find(c => c.value === item.category)?.label || item.category}</Badge>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-1 text-xs">
                      <Switch checked={item.isActive !== false} onCheckedChange={() => handleToggle(item.id, item.isActive !== false)} />
                      <span className="sr-only">Actif</span>
                    </label>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
