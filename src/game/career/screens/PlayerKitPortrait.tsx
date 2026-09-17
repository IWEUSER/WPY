import { useEffect, useRef } from 'react';
import { clubKit } from '../data/clubKits';
import { nationKitOrFallback } from '../data/nationColours';
import { kitFromScheme } from '../../shooting/kitPalette';
import { appearanceRegionForNation, pickPlayerLook } from '../../shooting/appearance';
import { drawStandingOutfielder } from '../../shooting/render';
import type { Club } from '../data/clubs';
import type { Nation } from '../data/nations';

function seedFrom(name: string, nationId: string | null | undefined): number {
  const raw = `${name}|${nationId ?? ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 33 + raw.charCodeAt(i)) >>> 0;
  return hash || 1;
}

function KitFigure({
  label,
  kitPrimary,
  kit,
  look,
}: {
  label: string;
  kitPrimary: string;
  kit: ReturnType<typeof kitFromScheme>;
  look: { skin: string; hair: string };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = 108;
    const h = 168;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawStandingOutfielder(ctx, w / 2, h - 14, 132, kit, look);
  }, [kit, look]);

  return (
    <div className="flex flex-1 flex-col items-center">
      <canvas ref={canvasRef} className="h-[168px] w-[108px]" />
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: kitPrimary }}>
        {label}
      </p>
    </div>
  );
}

export function PlayerKitPortrait({
  name,
  club,
  nation,
}: {
  name: string;
  club?: Club;
  nation?: Nation;
}) {
  const look = pickPlayerLook(seedFrom(name, nation?.id), appearanceRegionForNation(nation ?? null));
  if (!club && !nation) return null;
  return (
    <div className="mt-4 flex items-end justify-center gap-2">
      {club && (
        <KitFigure
          label={club.name}
          kitPrimary={clubKit(club).primary}
          kit={kitFromScheme(clubKit(club))}
          look={look}
        />
      )}
      {nation && (
        <KitFigure
          label={nation.name}
          kitPrimary={nationKitOrFallback(nation.id).primary}
          kit={kitFromScheme(nationKitOrFallback(nation.id))}
          look={look}
        />
      )}
    </div>
  );
}
