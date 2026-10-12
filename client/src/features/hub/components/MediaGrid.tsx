import { isVideoUrl } from "../media";

/** Media of a publication: one inline video, or the photo grid. */
export default function MediaGrid({ media, wideFirstOfThree = false }: { media: (string | null)[]; wideFirstOfThree?: boolean }) {
  const urls = media.filter((u): u is string => !!u);
  if (urls.length === 0) return null;
  const video = urls.find(isVideoUrl);
  if (video) return <video src={video} controls playsInline preload="metadata" aria-label="Vidéo" className="max-h-[28rem] w-full bg-black" />;
  return (
    <div className={`grid gap-0.5 ${urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {urls.map((u, i) => (
        <img key={u} src={u} alt="" loading="lazy" className={`w-full object-cover ${urls.length === 1 ? "max-h-[28rem]" : "aspect-square"} ${wideFirstOfThree && urls.length === 3 && i === 0 ? "col-span-2 !aspect-video" : ""}`} />
      ))}
    </div>
  );
}
