import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

type SectionKey = 'partners' | 'testimonials' | 'faq';

type ContentItem = {
  id: number;
  title: string;
  subtitle?: string;
  active: boolean;
};

const INITIAL_DATA: Record<SectionKey, ContentItem[]> = {
  partners: [
    { id: 1, title: 'Fondation Exemple', subtitle: 'Partenaire principal', active: true },
  ],
  testimonials: [
    { id: 1, title: '“Une expérience humaine forte.”', subtitle: 'Amina, bénévole', active: true },
  ],
  faq: [
    { id: 1, title: 'Comment réserver ?', subtitle: 'Choisissez votre parcours puis validez votre demande.', active: true },
  ],
};

const SECTION_LABELS: Record<SectionKey, string> = {
  partners: 'Partenaires',
  testimonials: 'Témoignages',
  faq: 'FAQ',
};

export default function AdminContenu() {
  const [section, setSection] = useState<SectionKey>('partners');
  const [contentBySection, setContentBySection] = useState(INITIAL_DATA);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');

  const items = useMemo(() => contentBySection[section], [contentBySection, section]);

  const addItem = () => {
    if (!title.trim()) return;
    setContentBySection((prev) => ({
      ...prev,
      [section]: [
        ...prev[section],
        {
          id: Date.now(),
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          active: true,
        },
      ],
    }));
    setTitle('');
    setSubtitle('');
  };

  const updateItem = (id: number, field: keyof ContentItem, value: string | boolean) => {
    setContentBySection((prev) => ({
      ...prev,
      [section]: prev[section].map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const deleteItem = (id: number) => {
    setContentBySection((prev) => ({
      ...prev,
      [section]: prev[section].filter((item) => item.id !== id),
    }));
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Gestion du contenu</h1>
            <p className="text-xs text-muted-foreground">MVP admin interne (Partenaires / Témoignages / FAQ)</p>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
            <Button
              key={key}
              variant={section === key ? 'default' : 'outline'}
              onClick={() => setSection(key)}
            >
              {SECTION_LABELS[key]}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ajouter un élément - {SECTION_LABELS[section]}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <Label htmlFor="title">Titre</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
            </div>
            <div>
              <Label htmlFor="subtitle">Sous-titre / description</Label>
              <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Description" />
            </div>
            <Button onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />Ajouter
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Éléments ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-3">
                <Input value={item.title} onChange={(e) => updateItem(item.id, 'title', e.target.value)} />
                <Input
                  value={item.subtitle || ''}
                  onChange={(e) => updateItem(item.id, 'subtitle', e.target.value)}
                  placeholder="Description"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={item.active} onCheckedChange={(value) => updateItem(item.id, 'active', value)} />
                    Actif
                  </label>
                  <Button variant="destructive" size="sm" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />Supprimer
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Aucun élément dans cette section.</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
