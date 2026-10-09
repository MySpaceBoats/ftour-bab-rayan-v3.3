const COLORS = ["bg-rose-600", "bg-orange-600", "bg-amber-600", "bg-emerald-600", "bg-teal-600", "bg-sky-600", "bg-indigo-600", "bg-fuchsia-600"];

/** Round avatar: the member's photo, or coloured initials when there is none. */
export default function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (src) return <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
  const color = COLORS[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span aria-hidden style={{ ...style, fontSize: size * 0.4 }} className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color}`}>
      {initials}
    </span>
  );
}
