import AdminReservationsCalendar from "@/features/restaurant/admin/AdminReservationsCalendar";

/**
 * Legacy compatibility wrapper.
 *
 * Some older bundles/routes still reference `AdminRamadanStats`.
 * Keep this component name stable and map it to the current
 * reservations calendar/stats admin screen.
 */
export default function AdminRamadanStats() {
  return <AdminReservationsCalendar />;
}
