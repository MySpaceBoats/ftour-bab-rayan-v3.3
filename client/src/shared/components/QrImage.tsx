import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrImageProps {
  data: string;
  size?: number;
  className?: string;
  alt?: string;
}

export default function QrImage({ data, size = 220, className, alt = "QR Code" }: QrImageProps) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (!data) return;
    QRCode.toDataURL(data, { margin: 2, width: size, errorCorrectionLevel: "H" })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [data, size]);

  if (!src) return <div className={className} style={{ background: "#f3f4f6" }} />;
  return <img src={src} alt={alt} className={className} />;
}
