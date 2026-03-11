import { useState } from "react";
import { Link, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Vote, Trophy, Star, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  useElectionSettings,
  useElectionCandidates,
  useMyEligibility,
  useMyVote,
  useVoteMutation,
} from "../electionApi";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

function ParticipationBadge({ count }: { count: number }) {
  const stars = count >= 10 ? 3 : count >= 5 ? 2 : 1;
  const label = count >= 10 ? "Bénévole expert" : count >= 5 ? "Bénévole confirmé" : "Bénévole actif";
  return (
    <div className="flex items-center gap-1 text-amber-600">
      {Array.from({ length: stars }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
      ))}
      <span className="text-xs font-medium">{label} · {count} participations</span>
    </div>
  );
}

export default function ElectionManagers() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();

  const settingsQuery = useElectionSettings();
  const candidatesQuery = useElectionCandidates();
  const eligibilityQuery = useMyEligibility();
  const myVoteQuery = useMyVote();
  const voteMutation = useVoteMutation();

  const [confirmCandidate, setConfirmCandidate] = useState<{ id: string; name: string } | null>(null);

  const settings = settingsQuery.data;
  const candidates = candidatesQuery.data ?? [];
  const isOpen = settings?.is_open ?? false;

  const handleVoteClick = (candidateId: string, candidateName: string) => {
    if (!isAuthenticated) {
      setLocation(`/${lang}/connexion?redirectTo=/election-managers`);
      return;
    }
    if (!isOpen) return;
    if (myVoteQuery.data?.hasVoted) return;
    if (!eligibilityQuery.data?.eligible) return;
    setConfirmCandidate({ id: candidateId, name: candidateName });
  };

  const handleConfirmVote = async () => {
    if (!confirmCandidate) return;
    try {
      await voteMutation.mutateAsync({ candidateId: confirmCandidate.id });
      toast.success("Votre vote a été enregistré !");
      setConfirmCandidate(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du vote.";
      toast.error(msg);
      setConfirmCandidate(null);
    }
  };

  const isLoading = settingsQuery.isLoading || candidatesQuery.isLoading || authLoading;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Trophy className="h-4 w-4" />
            Election Ramadan {new Date().getFullYear()}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-3">
            Élection des Managers Bab Rayan
          </h1>
          <p className="text-stone-600 max-w-2xl mx-auto">
            Choisissez les managers qui guideront notre action solidaire durant le Ramadan.
            Seuls les bénévoles ayant participé à au moins 3 événements peuvent voter.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
          </div>
        ) : (
          <>
            {/* Status banner */}
            {!isOpen && (
              <Alert className="mb-8 max-w-2xl mx-auto border-amber-200 bg-amber-50">
                <Lock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  L'élection n'est pas encore ouverte. Revenez bientôt pour voter !
                </AlertDescription>
              </Alert>
            )}

            {/* Auth status for connected users */}
            {isAuthenticated && isOpen && (
              <div className="mb-8 max-w-2xl mx-auto">
                {myVoteQuery.data?.hasVoted ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 font-medium">
                      Votre vote a été enregistré. Merci pour votre participation !
                    </AlertDescription>
                  </Alert>
                ) : eligibilityQuery.data && !eligibilityQuery.data.eligible ? (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      Seuls les bénévoles ayant participé à au moins 3 actions Bab Rayan peuvent voter.
                      <br />
                      <span className="font-medium">
                        Vos participations : {eligibilityQuery.data.participationCount}/{eligibilityQuery.data.minRequired}
                      </span>
                    </AlertDescription>
                  </Alert>
                ) : eligibilityQuery.data?.eligible ? (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Vote className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Vous êtes éligible pour voter ({eligibilityQuery.data.participationCount} participations).
                      Cliquez sur "Voter" pour choisir votre candidat préféré.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}

            {/* CTA connexion */}
            {!isAuthenticated && isOpen && (
              <div className="mb-8 text-center">
                <p className="text-stone-600 mb-3">
                  Connectez-vous pour voter pour votre candidat préféré.
                </p>
                <Link href={`/${lang}/connexion?redirectTo=/election-managers`}>
                  <Button className="bg-[#4A4829] text-[#F2E9D3] hover:bg-[#3A3820]">
                    <Lock className="h-4 w-4 mr-2" />
                    Se connecter pour voter
                  </Button>
                </Link>
              </div>
            )}

            {/* Candidates grid */}
            {candidates.length === 0 ? (
              <div className="text-center py-16 text-stone-500">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Aucun candidat approuvé pour le moment.</p>
                <p className="text-sm mt-2">
                  Vous souhaitez vous présenter ?{" "}
                  <Link href={`/${lang}/candidature-manager`} className="text-amber-600 underline">
                    Déposer votre candidature
                  </Link>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {candidates.map(candidate => {
                  const hasVoted = myVoteQuery.data?.hasVoted;
                  const votedForThis = myVoteQuery.data?.candidateId === candidate.id;
                  const canVote = isOpen && isAuthenticated && !hasVoted && eligibilityQuery.data?.eligible;

                  return (
                    <Card
                      key={candidate.id}
                      className={`group transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border ${
                        votedForThis ? "border-green-400 bg-green-50" : "border-stone-200"
                      }`}
                    >
                      <CardContent className="pt-6 pb-4 flex flex-col items-center text-center gap-3">
                        {/* Photo */}
                        <div className="relative">
                          <Avatar className="h-24 w-24 border-2 border-stone-200 group-hover:border-amber-400 transition-colors">
                            <AvatarImage
                              src={candidate.photo_url ?? undefined}
                              alt={`${candidate.first_name} ${candidate.last_name}`}
                            />
                            <AvatarFallback className="bg-amber-100 text-amber-800 text-2xl font-bold">
                              {candidate.first_name[0]}{candidate.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          {votedForThis && (
                            <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                              <CheckCircle className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Name */}
                        <div>
                          <h3 className="font-bold text-stone-900 text-lg leading-tight">
                            {candidate.first_name} {candidate.last_name}
                          </h3>
                          <ParticipationBadge count={candidate.participation_count} />
                        </div>

                        {/* Motivation */}
                        {candidate.motivation_text && (
                          <p className="text-sm text-stone-600 line-clamp-3 italic">
                            "{candidate.motivation_text}"
                          </p>
                        )}

                        {/* Vote button */}
                        {votedForThis ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Votre choix
                          </Badge>
                        ) : hasVoted ? (
                          <Badge variant="secondary" className="text-stone-400">
                            Vote enregistré
                          </Badge>
                        ) : canVote ? (
                          <Button
                            size="sm"
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() =>
                              handleVoteClick(
                                candidate.id,
                                `${candidate.first_name} ${candidate.last_name}`
                              )
                            }
                          >
                            <Vote className="h-4 w-4 mr-1.5" />
                            Voter pour ce candidat
                          </Button>
                        ) : !isAuthenticated ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                              setLocation(`/${lang}/connexion?redirectTo=/election-managers`)
                            }
                          >
                            <Lock className="h-4 w-4 mr-1.5" />
                            Se connecter
                          </Button>
                        ) : !isOpen ? (
                          <Badge variant="outline" className="text-stone-400">
                            Vote fermé
                          </Badge>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Links */}
            <div className="mt-12 flex flex-wrap gap-4 justify-center text-sm">
              <Link href={`/${lang}/candidature-manager`}>
                <Button variant="outline" className="border-stone-300">
                  Déposer ma candidature
                </Button>
              </Link>
              <Link href={`/${lang}/resultats-election`}>
                <Button variant="outline" className="border-stone-300">
                  <Trophy className="h-4 w-4 mr-2" />
                  Voir le classement
                </Button>
              </Link>
              <Link href={`/${lang}/managers`}>
                <Button variant="outline" className="border-stone-300">
                  Historique des managers
                </Button>
              </Link>
            </div>
          </>
        )}
      </main>

      {/* Confirm vote dialog */}
      <Dialog open={!!confirmCandidate} onOpenChange={() => setConfirmCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer votre vote</DialogTitle>
            <DialogDescription>
              Vous allez voter pour{" "}
              <strong>{confirmCandidate?.name}</strong>. Ce choix est définitif.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmCandidate(null)}
            >
              Annuler
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmVote}
              disabled={voteMutation.isPending}
            >
              {voteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Vote className="h-4 w-4 mr-2" />
              )}
              Confirmer mon vote
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
