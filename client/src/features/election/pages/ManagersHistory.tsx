import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Trophy, Vote } from "lucide-react";
import { useManagersHistory } from "../electionApi";

export default function ManagersHistory() {
  const historyQuery = useManagersHistory();
  const history = historyQuery.data ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Trophy className="h-4 w-4" />
            Palmarès Bab Rayan
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-3">
            Managers des années précédentes
          </h1>
          <p className="text-stone-600 max-w-xl mx-auto">
            Ils ont guidé nos équipes de bénévoles avec dévouement. Merci à tous les managers Bab Rayan.
          </p>
        </div>

        {historyQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Aucun historique disponible pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {history.map(({ year, managers }) => (
              <div key={year}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-stone-200" />
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-[#4A4829] text-[#F2E9D3] rounded-full text-sm font-semibold">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    Ramadan {year}
                  </div>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>

                {managers.length === 0 ? (
                  <p className="text-center text-stone-400 text-sm">Aucun manager élu cette année.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {managers.map((manager, idx) => (
                      <Card
                        key={manager.id}
                        className="text-center hover:shadow-md transition-shadow"
                      >
                        <CardContent className="pt-5 pb-4 flex flex-col items-center gap-2">
                          <div className="relative">
                            <Avatar className="h-16 w-16 border-2 border-amber-200">
                              <AvatarImage
                                src={manager.photo_url ?? undefined}
                                alt={`${manager.first_name} ${manager.last_name}`}
                              />
                              <AvatarFallback className="bg-amber-100 text-amber-800 text-lg font-bold">
                                {manager.first_name[0]}{manager.last_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            {idx === 0 && (
                              <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5">
                                <Trophy className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-stone-900 text-sm leading-tight">
                              {manager.first_name} {manager.last_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-stone-500">
                            <Vote className="h-3 w-3" />
                            {manager.votes} votes
                          </div>
                          {idx < 3 && (
                            <Badge
                              className={
                                idx === 0
                                  ? "bg-yellow-100 text-yellow-700 border-yellow-200 text-xs"
                                  : idx === 1
                                  ? "bg-slate-100 text-slate-600 border-slate-200 text-xs"
                                  : "bg-amber-100 text-amber-700 border-amber-200 text-xs"
                              }
                            >
                              #{idx + 1}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
