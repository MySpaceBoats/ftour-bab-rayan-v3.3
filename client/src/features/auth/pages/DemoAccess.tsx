import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { enableDemoAccess } from "@/_core/demoAccess";

export default function DemoAccess() {
  const [, navigate] = useLocation();

  useEffect(() => {
    enableDemoAccess();
    navigate("/admin/unified-dashboard", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border rounded-lg p-6 shadow-sm flex items-center gap-3 text-gray-700">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p>Activation de l&apos;accès démonstration…</p>
      </div>
    </div>
  );
}
