import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

type ProductType = "goodies" | "terroir" | "patisserie";

const TITLES: Record<ProductType, string> = {
  goodies: "Goodies",
  terroir: "Terroir",
  patisserie: "Pâtisserie",
};

export default function BoutiqueProductTypePage({ productType }: { productType: ProductType }) {
  const { data, isLoading } = trpc.catalogProducts.listPublic.useQuery({ productType });
  const { addToCart } = useCart();

  return (
    <div className="min-h-screen flex flex-col bg-[#0F172A]">
      <Navbar />
      <main className="flex-1 container py-12">
        <h1 className="text-4xl text-[#F8FAFC] mb-8">Boutique {TITLES[productType]}</h1>
        {isLoading ? (
          <p className="text-[#CBD5E1]">Chargement...</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(data || []).map((item: any) => (
              <Card key={item.id} className="overflow-hidden bg-[#1E293B] border-[#F8FAFC]/10">
                <div className="aspect-[4/3] bg-[#0F172A]">{item.image && <img src={item.image} className="h-full w-full object-cover" />}</div>
                <CardContent className="p-4 text-[#F8FAFC]">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-[#CBD5E1] line-clamp-2">{item.description || "Pas de description"}</p>
                  <div className="flex items-center justify-between mt-3">
                    <p>{item.price} DH</p>
                    <Button size="sm" onClick={() => {
                      addToCart({ productType, productId: item.id, name: item.name, price: Number(item.price || 0), quantity: 1, imageUrl: item.image || undefined });
                      toast.success("Produit ajouté au panier");
                    }}>Ajouter</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
