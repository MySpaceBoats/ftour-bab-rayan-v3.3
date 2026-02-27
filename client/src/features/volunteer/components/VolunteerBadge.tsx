import { Badge } from "@/components/ui/badge";
import type { VolunteerRole } from "../volunteerApi";

const ROLE_UI: Record<VolunteerRole, { label: string; className: string }> = {
  blue: { label: "Bénévole", className: "bg-blue-100 text-blue-800" },
  orange: { label: "Staff", className: "bg-orange-100 text-orange-800" },
  yellow: { label: "Manager", className: "bg-yellow-100 text-yellow-800" },
  red: { label: "Responsable", className: "bg-red-100 text-red-800" },
};

export default function VolunteerBadge({ role }: { role: VolunteerRole }) {
  const ui = ROLE_UI[role] ?? ROLE_UI.blue;
  return <Badge className={ui.className}>{ui.label}</Badge>;
}
