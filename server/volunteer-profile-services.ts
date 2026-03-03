import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_RAMADAN_TIMEZONE, getDateStringInTimeZone } from "@shared/ramadan";
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

export interface VolunteerProfileRegistration {
  id: number;
  day_id: number;
  qr_token: string;
  qr_status: string;
  status: string;
  date: string;
  day_number: number;
  location: string | null;
  iftar_time: string | null;
  volunteer_slots: string[];
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

export async function getMyVolunteerRegistrations(accessToken: string) {
  const profile = await getMyVolunteerProfile(accessToken);
  const normalizedEmail = String(profile.email ?? "").toLowerCase().trim();
  if (!normalizedEmail) return [] as VolunteerProfileRegistration[];

  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client not configured");

  const { data, error } = await admin
    .from("volunteers")
    .select("id, day_id, qr_token, qr_status, status, created_at, volunteer_slots, ramadan_days(day_number, date, location, iftar_time)")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    day_id: row.day_id,
    qr_token: row.qr_token,
    qr_status: row.qr_status,
    status: row.status,
    date: row.ramadan_days?.date,
    day_number: row.ramadan_days?.day_number,
    location: row.ramadan_days?.location ?? null,
    iftar_time: row.ramadan_days?.iftar_time ?? null,
    volunteer_slots: Array.isArray(row.volunteer_slots) ? row.volunteer_slots : [],
    created_at: row.created_at,
  })) as VolunteerProfileRegistration[];
}

export async function getVolunteerRemainingDays(accessToken: string) {
  const today = getDateStringInTimeZone(new Date(), DEFAULT_RAMADAN_TIMEZONE);
  const registrations = await getMyVolunteerRegistrations(accessToken);
  const registeredDayIds = new Set(
    registrations
      .filter((row) => row.status !== "cancelled")
      .map((row) => row.day_id)
  );

  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client not configured");

  const { data, error } = await admin
    .from("ramadan_days")
    .select("id, day_number, date, capacity, registered_count, is_open, iftar_time, location")
    .gte("date", today)
    .order("day_number", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((day: any) => ({
    id: day.id,
    dayNumber: day.day_number,
    date: day.date,
    capacity: day.capacity,
    registeredCount: day.registered_count,
    isOpen: day.is_open,
    iftarTime: day.iftar_time ?? null,
    location: day.location ?? null,
    alreadyRegistered: registeredDayIds.has(day.id),
  }));
}
