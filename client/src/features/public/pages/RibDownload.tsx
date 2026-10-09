import { mediaUrl } from "@/lib/media";
import { useEffect } from "react";

const RIB_PDF_URL =
  mediaUrl("RIB/RIBBABRAYAN (1).pdf") + "?download=RIBBABRAYAN.pdf";

export default function RibDownload() {
  useEffect(() => {
    window.location.replace(RIB_PDF_URL);
  }, []);

  return (
    <main className="container mx-auto px-4 py-16 text-center">
      <h1 className="mb-4 text-2xl font-bold">Téléchargement du RIB</h1>
      <p className="mb-6 text-muted-foreground">
        Votre téléchargement devrait démarrer automatiquement.
      </p>
      <a
        href={RIB_PDF_URL}
        className="font-medium text-primary underline"
        download
      >
        Cliquez ici si le téléchargement ne démarre pas
      </a>
    </main>
  );
}
