import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Trophy, Medal, Vote, Star } from "lucide-react";
import { useElectionResults, useElectionSettings } from "../electionApi";

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-stone-400 font-bold text-sm w-5 text-center">{rank}</span>;
}

const RANK_COLORS: Record<number, string> = {
  1: "border-yellow-300 bg-yellow-50",
  2: "border-slate-300 bg-slate-50",
  3: "border-amber-300 bg-amber-50",
};

export default function ResultatsElection() {
  const settingsQuery = useElectionSettings();
  const resultsQuery = useElectionResults();

  const settings = settingsQuery.data;
  const results = resultsQuery.data ?? [];
  const maxManagers = settings?.max_managers ?? 10;
  const totalVotes = results.reduce((sum, c) => sum + c.votes, 0);

  const isLoading = settingsQuery.isLoading || resultsQuery.isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Trophy className="h-4 w-4" />
            Classement — Ramadan {new Date().getFullYear()}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-3">
            Résultats de l'élection
          </h1>
          <p className="text-stone-600">
            Les {maxManagers} candidats les plus votés deviennent managers Bab Rayan.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
          </div>
        ) : results.length === 0 ? (
          <Alert className="text-center">
            <AlertDescription className="text-stone-600">
              Aucun résultat disponible pour le moment.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center bg-white border border-stone-200 rounded-xl p-4">
                <div className="text-2xl font-bold text-stone-900">{results.length}</div>
                <div className="text-xs text-stone-500 mt-1">Candidats</div>
              </div>
              <div className="text-center bg-white border border-stone-200 rounded-xl p-4">
                <div className="text-2xl font-bold text-amber-600">{totalVotes}</div>
                <div className="text-xs text-stone-500 mt-1">Votes total</div>
              </div>
              <div className="text-center bg-white border border-stone-200 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-600">{Math.min(maxManagers, results.length)}</div>
                <div className="text-xs text-stone-500 mt-1">Managers élus</div>
              </div>
            </div>

            {/* Ranking */}
            <div className="space-y-3">
              {results.map((candidate, index) => {
                const rank = index + 1;
                const isElected = rank <= maxManagers;
                const percentage = totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0;

                return (
                  <Card
                    key={candidate.id}
                    className={`transition-all ${
                      RANK_COLORS[rank] ?? (isElected ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-70")
                    }`}
                  >
                    <CardContent className="py-4 px-4 flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex items-center justify-center w-8 flex-shrink-0">
                        <MedalIcon rank={rank} />
                      </div>

                      {/* Avatar */}
                      <Avatar className="h-12 w-12 border border-stone-200 flex-shrink-0">
                        <AvatarImage
                          src={candidate.photo_url ?? undefined}
                          alt={`${candidate.first_name} ${candidate.last_name}`}
                        />
                        <AvatarFallback className="bg-amber-100 text-amber-800 font-bold">
                          {candidate.first_name[0]}{candidate.last_name[0]}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-stone-900">
                            {candidate.first_name} {candidate.last_name}
                          </span>
                          {isElected && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              Manager élu
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs text-stone-500">
                            {candidate.participation_count} participations
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-stone-500 w-8 text-right">{percentage}%</span>
                        </div>
                      </div>

                      {/* Votes */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xl font-bold text-stone-900 flex items-center gap-1">
                          <Vote className="h-4 w-4 text-amber-500" />
                          {candidate.votes}
                        </div>
                        <div className="text-xs text-stone-500">votes</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
