import { honourArtKind, honourArtSrc } from '../honourArt';

export function HonourArt({
  name,
  caption,
  compact = false,
}: {
  name: string | null | undefined;
  caption?: string;
  compact?: boolean;
}) {
  const src = honourArtSrc(name);
  const kind = honourArtKind(name);
  const alt = name?.trim() || 'Award';
  return (
    <div className={`honour-stage flex flex-col items-center ${compact ? '' : 'mt-5'}`}>
      <img
        src={src}
        alt={alt}
        data-honour-kind={kind}
        className={`${compact ? 'h-32 w-32' : 'h-48 w-48'} rounded-2xl object-cover shadow-lg shadow-black/40 ring-1 ring-white/15`}
      />
      {caption ? (
        <p className="relative z-[1] mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">{caption}</p>
      ) : null}
    </div>
  );
}
