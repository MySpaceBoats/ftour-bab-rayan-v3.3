import { trpc } from "@/lib/trpc";

export type VolunteerRole = "blue" | "orange" | "yellow" | "red";

export type VolunteerProfile = {
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
};

export type VolunteerAttendance = {
  id: number;
  volunteer_id: string;
  date: string;
  slot: string;
  status: "registered" | "confirmed" | "present" | "cancelled";
  points_earned: number;
  created_at: string;
};

export function getMyVolunteerProfile() {
  return trpc.volunteerProfile.me.useQuery();
}

export function updateMyVolunteerProfile() {
  const utils = trpc.useUtils();
  return trpc.volunteerProfile.updateMe.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.volunteerProfile.me.invalidate(),
        utils.volunteerProfile.attendance.invalidate(),
      ]);
    },
  });
}

export function getMyAttendance(limit = 20, offset = 0) {
  return trpc.volunteerProfile.attendance.useQuery({ limit, offset });
}
