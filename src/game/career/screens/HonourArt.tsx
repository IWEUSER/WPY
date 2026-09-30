import { honourArtKind, honourArtSrc } from '../honourArt';

export function HonourArt({
  name,
  caption,
}: {
  name: string | null | undefined;
  caption?: string;
}) {
  const src = honourArtSrc(name);
  const kind = honourArtKind(name);
  const alt = name?.trim() || 'Award';
  return (
    <div className="mt-5 flex flex-col items-center">
      <img
        src={src}
        alt={alt}
        data-honour-kind={kind}
        className="h-48 w-48 rounded-2xl object-cover shadow-lg shadow-black/40 ring-1 ring-white/15"
      />
      {caption ? (
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">{caption}</p>
      ) : null}
    </div>
  );
}
