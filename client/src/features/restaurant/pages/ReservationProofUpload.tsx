import { useEffect, useMemo, useRef, useState } from "react";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

export default function ReservationProofUpload() {
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get("token") || "",
    []
  );
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [info, setInfo] = useState<{
    reservation_ref?: string;
    due_date?: string;
    amount?: number;
    email?: string;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`/api/reservations/proof/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: any) => {
        setValid(Boolean(data.valid));
        if (data.valid) setInfo(data);
      })
      .catch(() => setValid(false))
      .finally(() => setLoading(false));
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFileError("");
    if (!f) { setFile(null); return; }
    if (!ALLOWED_MIME.has(f.type)) {
      setFileError("Format non autorisé. Veuillez choisir un fichier PDF, JPG ou PNG.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError("Fichier trop volumineux (maximum 10 Mo).");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(f);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !token) return;
    setSubmitting(true);
    setErrorMsg("");
    const form = new FormData();
    form.append("token", token);
    form.append("file", file);
    if (note.trim()) form.append("note", note.trim());
    try {
      const res = await fetch("/api/reservations/proof/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json() as any;
      if (res.ok && data.success) {
        setSubmitted(true);
        return;
      }
      setErrorMsg(data.message || "Une erreur est survenue. Veuillez réessayer.");
    } catch {
      setErrorMsg("Impossible de contacter le serveur. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
          <p className="text-gray-500">Vérification du lien…</p>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">🔒</div>
          <h1 className="mb-2 text-xl font-bold text-red-800">Lien invalide ou expiré</h1>
          <p className="text-sm text-red-700">
            Ce lien de dépôt de preuve de virement n'est plus valide. Il est possible qu'il ait
            déjà été utilisé ou qu'il ait expiré.
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Pour toute question, contactez-nous à{" "}
            <a
              href="mailto:contact@ftourbabrayan.ma"
              className="text-green-700 underline"
            >
              contact@ftourbabrayan.ma
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">✅</div>
          <h1 className="mb-2 text-2xl font-bold text-green-800">Preuve envoyée !</h1>
          <p className="mb-4 text-gray-700">
            Votre preuve de virement pour la réservation{" "}
            <strong>{info?.reservation_ref}</strong> a bien été reçue.
          </p>
          <p className="text-sm text-gray-600">
            Notre équipe va vérifier votre virement et vous confirmera votre réservation dans les
            plus brefs délais.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Une copie a été transmise à notre équipe administrative.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mb-3 text-5xl">🏦</div>
        <h1 className="text-2xl font-bold text-gray-900">Déposer ma preuve de virement</h1>
        <p className="mt-1 text-sm text-gray-500">
          Téléversez votre preuve de virement pour confirmer votre acompte.
        </p>
      </div>

      {/* Reservation info card */}
      {info?.reservation_ref && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-5 py-4">
          <p className="text-sm font-medium text-green-800">
            Réservation :{" "}
            <span className="font-bold">{info.reservation_ref}</span>
          </p>
          {info.amount != null && (
            <p className="mt-1 text-sm text-green-700">
              Montant de l'acompte : <strong>{info.amount} DH</strong>
            </p>
          )}
          {info.due_date && (
            <p className="mt-1 text-sm text-green-700">
              Date limite : <strong>{info.due_date}</strong>
            </p>
          )}
        </div>
      )}

      {/* Upload form */}
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {/* File input */}
        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Fichier de preuve <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            required
            className="block w-full cursor-pointer rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-700
              file:mr-4 file:cursor-pointer file:rounded-l-lg file:border-0
              file:bg-green-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white
              hover:file:bg-green-800"
          />
          <p className="mt-1 text-xs text-gray-500">
            Formats acceptés : PDF, JPG, PNG — Taille max : 10 Mo
          </p>
          {fileError && (
            <p className="mt-1 text-sm font-medium text-red-600">{fileError}</p>
          )}
          {file && !fileError && (
            <p className="mt-1 text-sm text-green-700">
              ✓ {file.name}{" "}
              <span className="text-gray-500">
                ({(file.size / 1024 / 1024).toFixed(2)} Mo)
              </span>
            </p>
          )}
        </div>

        {/* Note optionnelle */}
        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Note (optionnel)
          </label>
          <textarea
            placeholder="Ex : virement effectué le 01/03/2026"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800
              placeholder-gray-400 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !file || Boolean(fileError)}
          className="w-full rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white
            shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Envoi en cours…
            </span>
          ) : (
            "Envoyer la preuve de virement"
          )}
        </button>
      </form>

      {/* Privacy note */}
      <p className="mt-4 text-center text-xs text-gray-400">
        Ce lien est personnel et à usage unique. Vos données sont traitées de manière sécurisée.
      </p>
    </div>
  );
}
