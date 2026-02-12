import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Users } from "lucide-react";

interface ReservationStatsProps {
  total: number;
  pending: number;
  confirmed: number;
  refused: number;
  totalParticipants: number;
}

export function ReservationStats({
  total,
  pending,
  confirmed,
  refused,
  totalParticipants,
}: ReservationStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="pt-4">
          <div className="text-sm font-medium text-blue-900 mb-1">Total</div>
          <div className="text-2xl font-bold text-blue-600">{total}</div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-900">En attente</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{pending}</div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Confirmées</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{confirmed}</div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-900">Refusées</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{refused}</div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">Participants</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">{totalParticipants}</div>
        </CardContent>
      </Card>
    </div>
  );
}
