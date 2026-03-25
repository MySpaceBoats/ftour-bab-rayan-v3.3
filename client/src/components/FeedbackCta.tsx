import { Link } from "wouter";
import { MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";

type FeedbackType =
  | "volunteer"
  | "event"
  | "restaurant"
  | "product"
  | "general";
type FeedbackSource = "home" | "volunteer" | "event" | "restaurant" | "product";

export default function FeedbackCta({
  type,
  source,
}: {
  type: FeedbackType;
  source: FeedbackSource;
}) {
  return (
    <div className="fixed bottom-6 right-[5.5rem] sm:right-6 z-40">
      <Link href={`/feedback/new?type=${type}&source=${source}`}>
        <Button className="bg-[#C9B97A] hover:bg-[#B5A56A] text-[#3D3B1E] shadow-lg font-semibold">
          <MessageSquareHeart className="w-4 h-4 mr-2" />
          Laisser un feedback
        </Button>
      </Link>
    </div>
  );
}
