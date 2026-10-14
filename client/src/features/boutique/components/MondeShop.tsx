import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { toast } from "sonner";

interface Variant { id: number; title: string; price: number }
interface Product { id: string; title: string; description: string; image: string | null; variants: Variant[] }
interface CartLine { productId: string; variantId: number; quantity: number }

export default function MondeShop() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<{ currency: string; products: Product[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch("/api/monde/products")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
    const flag = new URLSearchParams(window.location.search).get("monde");
    if (flag === "success") toast.success(t.boutique.mondeSuccess);
    if (flag === "cancel") toast.info(t.boutique.mondeCancel);
  }, []);

  if (failed) return <p className="text-center text-[#E6DCC3] py-12">{t.boutique.mondeEmpty}</p>;
  if (!data) return <p className="text-center text-[#E6DCC3] py-12">{t.boutique.mondeLoading}</p>;
  if (data.products.length === 0) return <p className="text-center text-[#E6DCC3] py-12">{t.boutique.mondeEmpty}</p>;

  const money = (minor: number) =>
    new Intl.NumberFormat(lang, { style: "currency", currency: data.currency }).format(minor / 100);
  const find = (l: CartLine) => {
    const p = data.products.find((x) => x.id === l.productId)!;
    return { p, v: p.variants.find((x) => x.id === l.variantId)! };
  };
  const total = cart.reduce((n, l) => n + find(l).v.price * l.quantity, 0);

  const add = (p: Product) => {
    const variantId = pick[p.id] ?? p.variants[0].id;
    setCart((c) => {
      const hit = c.find((l) => l.productId === p.id && l.variantId === variantId);
      return hit
        ? c.map((l) => (l === hit ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l))
        : [...c, { productId: p.id, variantId, quantity: 1 }];
    });
  };

  const pay = async () => {
    setPaying(true);
    try {
      const res = await fetch("/api/monde/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart, email: email || undefined, lang }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error);
      window.location.href = body.url;
    } catch {
      toast.error(t.boutique.mondeError);
      setPaying(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8">
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {data.products.map((p) => (
          <div key={p.id} className="bg-[#6B3643] rounded-lg overflow-hidden border border-[#F2E9D3]/10">
            {p.image && <img src={p.image} alt={p.title} loading="lazy" className="w-full aspect-square object-cover" />}
            <div className="p-4 space-y-3">
              <h3 className="font-bold text-[#F2E9D3]">{p.title}</h3>
              <p className="text-sm text-[#E6DCC3] line-clamp-3">{p.description}</p>
              {p.variants.length > 1 && (
                <select
                  aria-label={p.title}
                  className="w-full rounded bg-[#864654] text-[#F2E9D3] p-2 text-sm"
                  value={pick[p.id] ?? p.variants[0].id}
                  onChange={(e) => setPick({ ...pick, [p.id]: Number(e.target.value) })}
                >
                  {p.variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.title} — {money(v.price)}</option>
                  ))}
                </select>
              )}
              <Button onClick={() => add(p)} className="w-full bg-[#d4a574] text-[#844653] hover:bg-[#c9955f]">
                {t.boutique.mondeAdd} · {money((p.variants.find((v) => v.id === (pick[p.id] ?? p.variants[0].id)) ?? p.variants[0]).price)}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <aside className="bg-[#6B3643] rounded-lg p-4 h-fit space-y-3 border border-[#F2E9D3]/10 lg:sticky lg:top-24">
        <h3 className="font-bold text-[#F2E9D3]">{t.boutique.mondeCart}</h3>
        {cart.map((l) => {
          const { p, v } = find(l);
          return (
            <div key={`${l.productId}:${l.variantId}`} className="flex justify-between gap-2 text-sm text-[#E6DCC3]">
              <span>{l.quantity}× {p.title} ({v.title})</span>
              <button
                className="underline shrink-0"
                onClick={() => setCart(cart.filter((x) => x !== l))}
              >
                {t.boutique.mondeRemove}
              </button>
            </div>
          );
        })}
        {cart.length > 0 && (
          <>
            <p className="font-bold text-[#F2E9D3]">{money(total)}</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.boutique.mondeEmail}
              className="w-full rounded bg-[#864654] text-[#F2E9D3] placeholder:text-[#E6DCC3]/60 p-2 text-sm"
            />
            <Button disabled={paying} onClick={pay} className="w-full bg-[#d4a574] text-[#844653] hover:bg-[#c9955f]">
              {t.boutique.mondeCheckout}
            </Button>
            <p className="text-xs text-[#E6DCC3]">{t.boutique.mondeShippingNote}</p>
          </>
        )}
      </aside>
    </div>
  );
}
