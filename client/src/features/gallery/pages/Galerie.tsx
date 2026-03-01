import { useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

export default function Galerie() {
  const [album, setAlbum] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "featured">(
    "featured"
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const albums = trpc.public.galleryAlbums.useQuery();
  const photos = trpc.public.galleryPhotos.useQuery({
    album: album === "all" ? undefined : album,
    tag: tag === "all" ? undefined : tag,
    sort,
    page: 1,
    pageSize: 50,
  });

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    (photos.data?.items ?? []).forEach((p: any) =>
      (p.tags ?? []).forEach((t: string) => tags.add(t))
    );
    return Array.from(tags).sort();
  }, [photos.data?.items]);

  const list = photos.data?.items ?? [];
  const current = lightboxIndex !== null ? list[lightboxIndex] : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10 space-y-6">
        <h1 className="text-3xl font-bold">Galerie</h1>

        <div className="grid md:grid-cols-3 gap-3">
          <Select value={album} onValueChange={setAlbum}>
            <SelectTrigger>
              <SelectValue placeholder="Album" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les albums</SelectItem>
              {(albums.data ?? []).map((a: any) => (
                <SelectItem key={a.id} value={a.slug}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger>
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les tags</SelectItem>
              {allTags.map(t => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured d'abord</SelectItem>
              <SelectItem value="recent">Récent</SelectItem>
              <SelectItem value="oldest">Ancien</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((photo: any, idx: number) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIndex(idx)}
              className="overflow-hidden rounded-xl bg-muted"
            >
              <img
                src={photo.image_thumb_url || photo.image_medium_url || photo.image_original_url}
                alt={`${photo.title || "Photo"} ${photo.description || ""}`.trim()}
                loading="lazy"
                className="h-44 md:h-56 w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          ))}
        </div>
      </main>
      <Footer />

      {current && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white"
            onClick={() => setLightboxIndex(null)}
          >
            <X />
          </button>
          <button
            className="absolute left-4 text-white text-2xl"
            onClick={e => {
              e.stopPropagation();
              setLightboxIndex(i =>
                i === null ? null : (i - 1 + list.length) % list.length
              );
            }}
          >
            ‹
          </button>
          <img
            src={current.image_medium_url || current.image_original_url}
            alt={`${current.title || "Photo"} ${current.description || ""}`.trim()}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute right-4 text-white text-2xl"
            onClick={e => {
              e.stopPropagation();
              setLightboxIndex(i =>
                i === null ? null : (i + 1) % list.length
              );
            }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
