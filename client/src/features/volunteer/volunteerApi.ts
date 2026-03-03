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


export type VolunteerRegistration = {
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
};

export type VolunteerRemainingDay = {
  id: number;
  dayNumber: number;
  date: string;
  capacity: number;
  registeredCount: number;
  isOpen: boolean;
  iftarTime: string | null;
  location: string | null;
  alreadyRegistered: boolean;
};

export function getMyRegistrations() {
  return trpc.volunteerProfile.registrations.useQuery();
}

export function getMyRemainingDays() {
  return trpc.volunteerProfile.remainingDays.useQuery();
}

export function registerForDayFromProfile() {
  const utils = trpc.useUtils();
  return trpc.volunteerProfile.registerForDay.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.volunteerProfile.registrations.invalidate(),
        utils.volunteerProfile.remainingDays.invalidate(),
        utils.volunteerProfile.attendance.invalidate(),
      ]);
    },
  });
}
