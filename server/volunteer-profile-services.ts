import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase";

export type VolunteerRole = "blue" | "orange" | "yellow" | "red";

export interface VolunteerProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  role: VolunteerRole;
  points_total: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface VolunteerAttendance {
  id: number;
  volunteer_id: string;
  date: string;
  slot: string;
  status: "registered" | "confirmed" | "present" | "cancelled";
  points_earned: number;
  created_at: string;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export async function ensureVolunteerProfile(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client not configured");

  const { error } = await admin.rpc("ensure_volunteer_profile", {
    p_user_id: user.id,
    p_email: user.email ?? null,
    p_name: user.name ?? null,
    p_phone: user.phone ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function getRlsClient(accessToken: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase public credentials are missing");
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getMyVolunteerProfile(accessToken: string) {
  const client = getRlsClient(accessToken);
  const { data, error } = await client
    .from("volunteer_profiles")
    .select("*")
    .single<VolunteerProfile>();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateMyVolunteerProfile(
  accessToken: string,
  updates: Pick<VolunteerProfile, "first_name" | "last_name" | "phone">
) {
  const client = getRlsClient(accessToken);
  const { data, error } = await client
    .from("volunteer_profiles")
    .update(updates)
    .select("*")
    .single<VolunteerProfile>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getMyAttendance(
  accessToken: string,
  limit = 20,
  offset = 0
) {
  const client = getRlsClient(accessToken);
  const { data, error } = await client
    .from("volunteer_attendance_view")
    .select("*")
    .order("date", { ascending: false })
    .range(offset, offset + Math.max(1, limit) - 1);

  if (error) throw new Error(error.message);
  return (data ?? []) as VolunteerAttendance[];
}
