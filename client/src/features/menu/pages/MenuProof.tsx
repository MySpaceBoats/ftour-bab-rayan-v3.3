import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'wouter';
import QRCode from 'qrcode';

type ProofData = { reference: string; status: string; totalMad: number; createdAt: string; items: Array<{ name_snapshot: string; qty: number; unit_price_mad: number }> };

export default function MenuProof() {
  const params = useParams<{ reference: string }>();
  const [proof, setProof] = useState<ProofData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const url = useMemo(() => new URL(window.location.href), []);

  useEffect(() => {
    const t = url.searchParams.get('t') || '';
    fetch(`/api/proof/${params.reference}?t=${encodeURIComponent(t)}`).then((r) => r.json()).then(setProof);
    QRCode.toDataURL(window.location.href, { margin: 1, width: 220 }).then(setQrDataUrl);
  }, [params.reference, url]);

  if (!proof) return <div className="container mx-auto p-8">Chargement…</div>;

  return (
    <div className="container mx-auto p-8 max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold text-green-700">Commande enregistrée – À montrer à l’hôtesse</h1>
      <p>Référence: <strong>{proof.reference}</strong></p>
      <p>Total: <strong>{proof.totalMad} MAD</strong></p>
      <ul className="list-disc pl-6">
        {proof.items.map((i, idx) => <li key={idx}>{i.name_snapshot} x{i.qty}</li>)}
      </ul>
      {qrDataUrl && <img src={qrDataUrl} alt="QR preuve" className="w-56 h-56 border p-2 rounded" />}
    </div>
  );
}
