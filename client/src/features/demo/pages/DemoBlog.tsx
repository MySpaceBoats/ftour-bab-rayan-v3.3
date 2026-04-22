import { Heart, MessageCircle, User } from "lucide-react";
import { DemoLayout } from "../components/DemoLayout";
import { formatDate, formatNumber } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";

export default function DemoBlog() {
  const data = useDemoData();
  const featured = data.blogPosts[0];
  const rest = data.blogPosts.slice(1);

  return (
    <DemoLayout
      title="Blog & Témoignages"
      subtitle="Histoires, coulisses et paroles de bénévoles"
      tooltip="Contenus publiés par les bénévoles et la communauté : retours d'expérience, coulisses, rencontres."
    >
      {featured && (
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 md:grid-cols-5">
            <div className="flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-amber-500 p-10 md:col-span-2 md:min-h-full">
              <span className="text-7xl md:text-8xl" aria-hidden="true">
                {featured.cover}
              </span>
            </div>
            <div className="flex flex-col gap-3 p-6 md:col-span-3 md:p-8">
              <span className="inline-flex w-fit items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                {featured.tag}
              </span>
              <h2 className="text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
                {featured.title}
              </h2>
              <p className="text-sm text-slate-600 md:text-base">{featured.excerpt}</p>
              <div className="mt-auto flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {featured.author}
                </span>
                <span>{formatDate(featured.publishedAt)}</span>
                <span className="inline-flex items-center gap-1 text-rose-500">
                  <Heart className="h-3.5 w-3.5" />
                  {formatNumber(featured.reactions)}
                </span>
                <span className="inline-flex items-center gap-1 text-sky-600">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {formatNumber(featured.comments)}
                </span>
              </div>
            </div>
          </div>
        </article>
      )}

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((p) => (
          <article
            key={p.id}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <span className="text-6xl" aria-hidden="true">
                {p.cover}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <span className="inline-flex w-fit items-center rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                {p.tag}
              </span>
              <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
                {p.title}
              </h3>
              <p className="line-clamp-3 text-sm text-slate-600">{p.excerpt}</p>
              <div className="mt-auto flex items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="truncate">{p.author}</span>
                <span>·</span>
                <span>{formatDate(p.publishedAt)}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-rose-500">
                  <Heart className="h-3 w-3" />
                  {formatNumber(p.reactions)}
                </span>
                <span className="inline-flex items-center gap-1 text-sky-600">
                  <MessageCircle className="h-3 w-3" />
                  {p.comments}
                </span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </DemoLayout>
  );
}
