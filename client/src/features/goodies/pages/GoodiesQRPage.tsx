import { useParams } from "wouter";
import GoodiesConfirmation from "@/components/GoodiesConfirmation";
import NotFound from "@/features/public/pages/NotFound";

export default function GoodiesQRPage() {
  const { reference } = useParams<{ reference: string }>();

  if (!reference) {
    return <NotFound />;
  }

  return <GoodiesConfirmation orderReference={reference} />;
}
