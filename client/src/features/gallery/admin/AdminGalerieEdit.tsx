import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AdminGalerieEdit() {
  const [, params] = useRoute("/admin/galerie/:id");
  const id = params?.id as string;
  const { data: photo } = trpc.gallery.getPhoto.useQuery(
    { id },
    { enabled: !!id }
  );
  const { data: albums } = trpc.gallery.listAlbums.useQuery();
  const update = trpc.gallery.updatePhoto.useMutation({
    onSuccess: () => toast.success("Photo mise à jour"),
    onError: e => toast.error(e.message),
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (!photo) return;
    setForm({
      eventDate: photo.event_date ?? "",
      tags: Array.isArray(photo.tags) ? photo.tags.join(", ") : "",
      albumId: photo.album_id ?? "none",
      sortOrder: photo.sort_order ?? 0,
      status: photo.status,
      isFeatured: photo.is_featured,
    });
  }, [photo]);

  if (!form || !photo) return <div className="p-8">Chargement...</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/galerie">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Modifier la photo</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Métadonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <img
              src={photo.image_thumb_url}
              alt={photo.title || "photo"}
              className="h-56 w-full rounded object-cover"
            />
            <div>
              <Label>Année xxxx ou édition xxxx</Label>
              <Input
                placeholder="Ex: 2026 ou édition 12"
                value={form.eventDate}
                onChange={e =>
                  setForm((f: any) => ({ ...f, eventDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Tags</Label>
              <Input
                value={form.tags}
                onChange={e =>
                  setForm((f: any) => ({ ...f, tags: e.target.value }))
                }
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Album</Label>
                <Select
                  value={form.albumId}
                  onValueChange={v =>
                    setForm((f: any) => ({ ...f, albumId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {(albums ?? []).map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: "draft" | "published") =>
                    setForm((f: any) => ({ ...f, status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="published">published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Mise en avant</Label>
              <Switch
                checked={form.isFeatured}
                onCheckedChange={v =>
                  setForm((f: any) => ({ ...f, isFeatured: v }))
                }
              />
            </div>
            <Button
              onClick={() =>
                update.mutate({
                  id,
                  eventDate: form.eventDate || undefined,
                  tags: form.tags
                    ? form.tags
                        .split(",")
                        .map((t: string) => t.trim())
                        .filter(Boolean)
                    : [],
                  albumId: form.albumId === "none" ? null : form.albumId,
                  sortOrder: Number(form.sortOrder || 0),
                  status: form.status,
                  isFeatured: form.isFeatured,
                })
              }
            >
              Enregistrer
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
