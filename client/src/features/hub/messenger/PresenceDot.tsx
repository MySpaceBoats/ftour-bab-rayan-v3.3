export default function PresenceDot({ online, className = "" }: { online: boolean; className?: string }) {
  return (
    <span role="img" aria-label={online ? "En ligne" : "Hors ligne"} className={`inline-block h-3 w-3 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"} ${className}`} />
  );
}
