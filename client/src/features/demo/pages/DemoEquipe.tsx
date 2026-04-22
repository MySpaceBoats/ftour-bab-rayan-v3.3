import { Mail, MapPin, Sparkles } from "lucide-react";
import { DemoLayout } from "../components/DemoLayout";
import { formatDate } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";

export default function DemoEquipe() {
  const data = useDemoData();

  return (
    <DemoLayout
      title="Équipe"
      subtitle="Trombinoscope des responsables et référents"
      tooltip="Chaque membre porte une responsabilité clé pour le bon déroulement de l'édition."
    >
      <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Une équipe engagée, plusieurs villes
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Nos référents couvrent l'ensemble des volets : bénévoles, logistique,
              communication, partenariats, hygiène, sécurité. Chacun coordonne ses
              opérations en lien avec le bureau.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.team.map((m) => (
          <article
            key={m.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, #fb923c, #f97316)`,
                }}
              >
                {m.avatar}
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-slate-900">
                  {m.firstName} {m.lastName}
                </h3>
                <p className="truncate text-xs font-medium text-orange-600">
                  {m.role}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 line-clamp-3">{m.bio}</p>
            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {m.city}
              </span>
              <span>·</span>
              <span>Depuis {formatDate(m.joinedAt)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Mail className="h-3 w-3" />
              <span className="truncate">
                {m.firstName.toLowerCase()}.{m.lastName.toLowerCase().replace(/\s+/g, "")}
                @ftourbabrayan.ma
              </span>
            </div>
          </article>
        ))}
      </section>
    </DemoLayout>
  );
}
