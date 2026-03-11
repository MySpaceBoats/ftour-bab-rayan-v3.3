import { trpc } from "@/lib/trpc";

export function useElectionSettings() {
  return trpc.election.getSettings.useQuery();
}

export function useElectionCandidates(year?: number) {
  return trpc.election.listCandidates.useQuery(year ? { year } : undefined);
}

export function useElectionResults(year?: number) {
  return trpc.election.getResults.useQuery(year ? { year } : undefined);
}

export function useManagersHistory() {
  return trpc.election.getManagersHistory.useQuery();
}

export function useMyEligibility() {
  return trpc.election.checkMyEligibility.useQuery(undefined, {
    retry: false,
  });
}

export function useMyVote() {
  return trpc.election.checkMyVote.useQuery(undefined, { retry: false });
}

export function useVoteMutation() {
  const utils = trpc.useUtils();
  return trpc.election.vote.useMutation({
    onSuccess: () => {
      utils.election.checkMyVote.invalidate();
      utils.election.getResults.invalidate();
      utils.election.listCandidates.invalidate();
    },
  });
}

export function useSubmitCandidacyMutation() {
  const utils = trpc.useUtils();
  return trpc.election.submitCandidacy.useMutation({
    onSuccess: () => {
      utils.election.listCandidates.invalidate();
    },
  });
}

export function useGetPhotoUploadUrl() {
  return trpc.election.getPhotoUploadUrl.useMutation();
}

// Admin
export function useAdminCandidates(year?: number, status?: string) {
  return trpc.election.admin_listCandidates.useQuery(
    year || status ? { year, status } : undefined
  );
}

export function useAdminUpdateCandidateStatus() {
  const utils = trpc.useUtils();
  return trpc.election.admin_updateCandidateStatus.useMutation({
    onSuccess: () => {
      utils.election.admin_listCandidates.invalidate();
      utils.election.admin_getStats.invalidate();
      utils.election.admin_getLiveRanking.invalidate();
    },
  });
}

export function useAdminStats(year?: number) {
  return trpc.election.admin_getStats.useQuery(year ? { year } : undefined);
}

export function useAdminLiveRanking(year?: number) {
  return trpc.election.admin_getLiveRanking.useQuery(
    year ? { year } : undefined,
    { refetchInterval: 10000 }
  );
}

export function useAdminUpdateSettings() {
  const utils = trpc.useUtils();
  return trpc.election.admin_updateSettings.useMutation({
    onSuccess: () => {
      utils.election.getSettings.invalidate();
      utils.election.admin_getStats.invalidate();
    },
  });
}

export function useAdminListVotes(year?: number) {
  return trpc.election.admin_listVotes.useQuery(year ? { year } : undefined);
}

export function useAdminDeleteCandidate() {
  const utils = trpc.useUtils();
  return trpc.election.admin_deleteCandidate.useMutation({
    onSuccess: () => {
      utils.election.admin_listCandidates.invalidate();
      utils.election.admin_getStats.invalidate();
    },
  });
}
