/**
 * Module Election Managers Bab Rayan
 * Système d'élection annuelle des managers du Ramadan par les bénévoles.
 *
 * Eligibilité : avoir participé à au moins 3 événements.
 */

import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "./supabase";

const MIN_PARTICIPATIONS = 3;
const CURRENT_YEAR = new Date().getFullYear();

// ============================================================
// ADMIN PROCEDURE
// ============================================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "super_admin", "admin_ops"];
  if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès administrateur requis",
    });
  }
  return next({ ctx });
});

// ============================================================
// HELPERS
// ============================================================

function getAdmin() {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase non configuré" });
  return admin;
}

async function getParticipationCount(email: string): Promise<number> {
  const admin = getAdmin();
  const { data, error } = await admin.rpc("count_volunteer_participations", {
    p_email: email.toLowerCase().trim(),
  });
  if (error) {
    // Fallback sur la table volunteers directement
    const { count, error: err2 } = await admin
      .from("volunteers")
      .select("*", { count: "exact", head: true })
      .ilike("email", email.trim())
      .in("status", ["present", "confirmed", "registered"]);
    if (err2) return 0;
    return count ?? 0;
  }
  return (data as number) ?? 0;
}

async function getElectionYear(): Promise<number> {
  return CURRENT_YEAR;
}

// ============================================================
// ROUTER
// ============================================================

export const electionRouter = router({

  // ----------------------------------------------------------
  // PUBLIC : lire les paramètres de l'élection
  // ----------------------------------------------------------
  getSettings: publicProcedure.query(async () => {
    const admin = getAdmin();
    const year = await getElectionYear();

    const { data, error } = await admin
      .from("election_settings")
      .select("*")
      .eq("election_year", year)
      .maybeSingle();

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

    // Créer les paramètres si absents
    if (!data) {
      const { data: created, error: err2 } = await admin
        .from("election_settings")
        .insert({ election_year: year, is_open: false, max_managers: 10 })
        .select()
        .single();
      if (err2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err2.message });
      return created;
    }

    return data;
  }),

  // ----------------------------------------------------------
  // PUBLIC : liste des candidats approuvés
  // ----------------------------------------------------------
  listCandidates: publicProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const admin = getAdmin();
      const year = input?.year ?? CURRENT_YEAR;

      const { data, error } = await admin
        .from("manager_candidates")
        .select("*")
        .eq("election_year", year)
        .eq("status", "approved")
        .order("created_at", { ascending: true });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  // ----------------------------------------------------------
  // PUBLIC : classement (résultats)
  // ----------------------------------------------------------
  getResults: publicProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const admin = getAdmin();
      const year = input?.year ?? CURRENT_YEAR;

      // Récupère les candidats approuvés + leurs votes
      const { data: candidates, error: candErr } = await admin
        .from("manager_candidates")
        .select("id, first_name, last_name, photo_url, participation_count")
        .eq("election_year", year)
        .eq("status", "approved");

      if (candErr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: candErr.message });

      if (!candidates?.length) return [];

      // Compter les votes par candidat
      const { data: votes, error: voteErr } = await admin
        .from("manager_votes")
        .select("candidate_id")
        .eq("election_year", year);

      if (voteErr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: voteErr.message });

      const voteCounts: Record<string, number> = {};
      for (const v of votes ?? []) {
        voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] ?? 0) + 1;
      }

      return candidates
        .map(c => ({ ...c, votes: voteCounts[c.id] ?? 0 }))
        .sort((a, b) => b.votes - a.votes);
    }),

  // ----------------------------------------------------------
  // PUBLIC : historique des managers élus par année
  // ----------------------------------------------------------
  getManagersHistory: publicProcedure.query(async () => {
    const admin = getAdmin();

    // Récupère toutes les années ayant des paramètres
    const { data: settings, error: settingsErr } = await admin
      .from("election_settings")
      .select("election_year, max_managers")
      .order("election_year", { ascending: false });

    if (settingsErr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: settingsErr.message });

    const history: Array<{
      year: number;
      managers: Array<{ id: string; first_name: string; last_name: string; photo_url: string | null; votes: number }>;
    }> = [];

    for (const s of settings ?? []) {
      const { data: candidates } = await admin
        .from("manager_candidates")
        .select("id, first_name, last_name, photo_url")
        .eq("election_year", s.election_year)
        .eq("status", "approved");

      if (!candidates?.length) continue;

      const { data: votes } = await admin
        .from("manager_votes")
        .select("candidate_id")
        .eq("election_year", s.election_year);

      const voteCounts: Record<string, number> = {};
      for (const v of votes ?? []) {
        voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] ?? 0) + 1;
      }

      const ranked = candidates
        .map(c => ({ ...c, votes: voteCounts[c.id] ?? 0 }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, s.max_managers);

      history.push({ year: s.election_year, managers: ranked });
    }

    return history;
  }),

  // ----------------------------------------------------------
  // PROTECTED : vérifier mon éligibilité
  // ----------------------------------------------------------
  checkMyEligibility: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.user.email;
    if (!email) return { eligible: false, participationCount: 0, minRequired: MIN_PARTICIPATIONS };

    const count = await getParticipationCount(email);
    return {
      eligible: count >= MIN_PARTICIPATIONS,
      participationCount: count,
      minRequired: MIN_PARTICIPATIONS,
    };
  }),

  // ----------------------------------------------------------
  // PROTECTED : vérifier si j'ai déjà voté
  // ----------------------------------------------------------
  checkMyVote: protectedProcedure.query(async ({ ctx }) => {
    const admin = getAdmin();
    const email = ctx.user.email;
    if (!email) return { hasVoted: false, candidateId: null };

    const year = CURRENT_YEAR;

    const { data, error } = await admin
      .from("manager_votes")
      .select("candidate_id")
      .eq("voter_email", email.toLowerCase().trim())
      .eq("election_year", year)
      .maybeSingle();

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { hasVoted: !!data, candidateId: data?.candidate_id ?? null };
  }),

  // ----------------------------------------------------------
  // PROTECTED : voter pour un candidat
  // ----------------------------------------------------------
  vote: protectedProcedure
    .input(z.object({ candidateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const admin = getAdmin();
      const email = ctx.user.email;
      if (!email) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email introuvable" });

      const year = CURRENT_YEAR;

      // Vérifier que l'élection est ouverte
      const { data: settings } = await admin
        .from("election_settings")
        .select("is_open")
        .eq("election_year", year)
        .maybeSingle();

      if (!settings?.is_open) {
        throw new TRPCError({ code: "FORBIDDEN", message: "L'élection n'est pas ouverte." });
      }

      // Vérifier si déjà voté
      const { data: existing } = await admin
        .from("manager_votes")
        .select("id")
        .eq("voter_email", email.toLowerCase().trim())
        .eq("election_year", year)
        .maybeSingle();

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Vous avez déjà voté." });
      }

      // Vérifier que le candidat existe et est approuvé
      const { data: candidate } = await admin
        .from("manager_candidates")
        .select("id")
        .eq("id", input.candidateId)
        .eq("election_year", year)
        .eq("status", "approved")
        .maybeSingle();

      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Candidat introuvable." });
      }

      // Enregistrer le vote
      const { error } = await admin.from("manager_votes").insert({
        voter_email: email.toLowerCase().trim(),
        candidate_id: input.candidateId,
        election_year: year,
      });

      if (error) {
        if (error.code === "23505") {
          throw new TRPCError({ code: "CONFLICT", message: "Vous avez déjà voté." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  // ----------------------------------------------------------
  // PROTECTED : soumettre une candidature
  // ----------------------------------------------------------
  submitCandidacy: protectedProcedure
    .input(z.object({
      first_name:       z.string().min(2).max(100),
      last_name:        z.string().min(2).max(100),
      email:            z.string().email(),
      phone:            z.string().optional(),
      photo_url:        z.string().url().optional(),
      motivation_text:  z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const admin = getAdmin();
      const userEmail = ctx.user.email ?? input.email;
      const year = CURRENT_YEAR;

      // Compter les participations (sans vérification minimale)
      const count = await getParticipationCount(userEmail);

      // Vérifier si candidature déjà soumise
      const { data: existing } = await admin
        .from("manager_candidates")
        .select("id, status")
        .ilike("email", userEmail.trim())
        .eq("election_year", year)
        .maybeSingle();

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Vous avez déjà soumis une candidature pour cette année.",
        });
      }

      const { data, error } = await admin
        .from("manager_candidates")
        .insert({
          first_name:        input.first_name,
          last_name:         input.last_name,
          email:             userEmail.toLowerCase().trim(),
          phone:             input.phone ?? null,
          photo_url:         input.photo_url ?? null,
          motivation_text:   input.motivation_text ?? null,
          participation_count: count,
          election_year:     year,
          status:            "pending",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new TRPCError({ code: "CONFLICT", message: "Candidature déjà soumise." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  // ----------------------------------------------------------
  // PROTECTED : générer upload URL pour photo candidat
  // ----------------------------------------------------------
  getPhotoUploadUrl: protectedProcedure
    .input(z.object({ fileName: z.string(), contentType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const admin = getAdmin();
      const userId = ctx.user.openId ?? ctx.user.id.toString();
      const ext = input.fileName.split(".").pop() ?? "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { data, error } = await admin.storage
        .from("manager-candidates")
        .createSignedUploadUrl(path);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const publicUrl = admin.storage.from("manager-candidates").getPublicUrl(path).data.publicUrl;

      return { signedUrl: data.signedUrl, token: data.token, path, publicUrl };
    }),

  // ============================================================
  // ADMIN PROCEDURES
  // ============================================================

  // Admin : liste de tous les candidats (tous statuts)
  admin_listCandidates: adminProcedure
    .input(z.object({ year: z.number().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const admin = getAdmin();
      const year = input?.year ?? CURRENT_YEAR;

      let query = admin
        .from("manager_candidates")
        .select("*")
        .eq("election_year", year)
        .order("created_at", { ascending: false });

      if (input?.status) {
        query = query.eq("status", input.status);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  // Admin : approuver / refuser une candidature
  admin_updateCandidateStatus: adminProcedure
    .input(z.object({
      candidateId: z.string().uuid(),
      status: z.enum(["approved", "rejected", "pending"]),
    }))
    .mutation(async ({ input }) => {
      const admin = getAdmin();

      const { data, error } = await admin
        .from("manager_candidates")
        .update({ status: input.status })
        .eq("id", input.candidateId)
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  // Admin : statistiques
  admin_getStats: adminProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const admin = getAdmin();
      const year = input?.year ?? CURRENT_YEAR;

      const [
        { count: totalCandidates },
        { count: approvedCandidates },
        { count: pendingCandidates },
        { count: totalVotes },
      ] = await Promise.all([
        admin.from("manager_candidates").select("*", { count: "exact", head: true }).eq("election_year", year),
        admin.from("manager_candidates").select("*", { count: "exact", head: true }).eq("election_year", year).eq("status", "approved"),
        admin.from("manager_candidates").select("*", { count: "exact", head: true }).eq("election_year", year).eq("status", "pending"),
        admin.from("manager_votes").select("*", { count: "exact", head: true }).eq("election_year", year),
      ]);

      return {
        totalCandidates: totalCandidates ?? 0,
        approvedCandidates: approvedCandidates ?? 0,
        pendingCandidates: pendingCandidates ?? 0,
        totalVotes: totalVotes ?? 0,
      };
    }),

  // Admin : classement live (tous candidats approuvés + nb votes)
  admin_getLiveRanking: adminProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const admin = getAdmin();
      const year = input?.year ?? CURRENT_YEAR;

      const { data: candidates, error } = await admin
        .from("manager_candidates")
        .select("id, first_name, last_name, photo_url, participation_count, status")
        .eq("election_year", year)
        .eq("status", "approved");

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const { data: votes } = await admin
        .from("manager_votes")
        .select("candidate_id")
        .eq("election_year", year);

      const voteCounts: Record<string, number> = {};
      for (const v of votes ?? []) {
        voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] ?? 0) + 1;
      }

      return (candidates ?? [])
        .map(c => ({ ...c, votes: voteCounts[c.id] ?? 0 }))
        .sort((a, b) => b.votes - a.votes);
    }),

  // Admin : ouvrir/fermer l'élection
  admin_updateSettings: adminProcedure
    .input(z.object({
      year:         z.number().optional(),
      is_open:      z.boolean().optional(),
      max_managers: z.number().int().min(1).max(50).optional(),
    }))
    .mutation(async ({ input }) => {
      const admin = getAdmin();
      const year = input.year ?? CURRENT_YEAR;

      const updates: Record<string, unknown> = {};
      if (input.is_open !== undefined) updates.is_open = input.is_open;
      if (input.max_managers !== undefined) updates.max_managers = input.max_managers;

      const { data, error } = await admin
        .from("election_settings")
        .upsert({ election_year: year, ...updates }, { onConflict: "election_year" })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  // Admin : liste des votants (pour audit)
  admin_listVotes: adminProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const admin = getAdmin();
      const year = input?.year ?? CURRENT_YEAR;

      const { data, error } = await admin
        .from("manager_votes")
        .select("id, voter_email, candidate_id, created_at")
        .eq("election_year", year)
        .order("created_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  // Admin : supprimer un candidat
  admin_deleteCandidate: adminProcedure
    .input(z.object({ candidateId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const admin = getAdmin();
      const { error } = await admin
        .from("manager_candidates")
        .delete()
        .eq("id", input.candidateId);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});
