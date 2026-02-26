import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { CART_KEY } from './MenuSolidaire';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CartItem = { key: string; productId: number | null; name: string; type: 'GOODIE' | 'PASTRY' | 'TERROIR' | 'DONATION'; unitPriceMad: number; qty: number; meta?: Record<string, unknown> };

export default function MenuCheckout() {
  const [, navigate] = useLocation();
  const cart: CartItem[] = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const total = useMemo(() => cart.reduce((s, i) => s + i.unitPriceMad * i.qty, 0), [cart]);

  const submit = async () => {
    setLoading(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { firstName, lastName, email, phone: phone || null, acceptedTerms },
        items: cart,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return alert(data.error || 'Erreur');
    localStorage.removeItem(CART_KEY);
    navigate(`/proof/${data.reference}?t=${data.proofToken}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Checkout – Paiement en espèces</h1>
      <p>Total: <strong>{total} MAD</strong></p>
      <div className="space-y-2">
        <Label>Prénom *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Label>Nom *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Label>Téléphone (optionnel)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} /> J'accepte les conditions</label>
      </div>
      <Button disabled={loading || !firstName || !lastName || !email || !acceptedTerms || !cart.length} onClick={submit}>
        {loading ? 'Validation...' : 'Je paie en espèces'}
      </Button>
    </div>
  );
}
