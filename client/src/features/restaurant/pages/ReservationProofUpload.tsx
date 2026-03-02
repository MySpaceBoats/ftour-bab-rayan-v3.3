import { useEffect, useMemo, useState } from "react";

export default function ReservationProofUpload() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [message, setMessage] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`/api/reservations/proof/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        setValid(Boolean(data.valid));
        setInfo(data);
      })
      .catch(() => {
        setValid(false);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !token) return;
    setSubmitting(true);
    setMessage("");
    const form = new FormData();
    form.append("token", token);
    form.append("file", file);
    if (note.trim()) form.append("note", note.trim());

    const res = await fetch("/api/reservations/proof/upload", { method: "POST", body: form });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok && data.success) {
      setMessage("Preuve envoyée avec succès. Merci !");
      setFile(null);
      return;
    }
    setMessage(data.message || "Échec de l'envoi");
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Déposer ma preuve de virement</h1>
      {loading && <p>Vérification du lien...</p>}
      {!loading && !valid && <p>Lien invalide ou expiré.</p>}
      {!loading && valid && (
        <>
          <p className="mb-4 text-sm text-gray-600">Référence: <strong>{info?.reservation_ref}</strong></p>
          <form onSubmit={onSubmit} className="space-y-4 rounded border p-4">
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <textarea
              placeholder="Note (optionnel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border p-2"
            />
            <button disabled={submitting || !file} className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">
              {submitting ? "Envoi..." : "Envoyer la preuve"}
            </button>
          </form>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </>
      )}
    </div>
  );
}
