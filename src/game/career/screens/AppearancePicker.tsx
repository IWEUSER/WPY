import { HAIR_SWATCHES, SKIN_SWATCHES } from '../../shooting/appearance';

export function AppearancePicker({
  skin,
  hair,
  onChange,
}: {
  skin: string;
  hair: string;
  onChange: (look: { skin: string; hair: string }) => void;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 text-left">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Skin</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SKIN_SWATCHES.map((tone) => (
            <button
              key={tone}
              type="button"
              aria-label={`Skin ${tone}`}
              onClick={() => onChange({ skin: tone, hair })}
              className={`h-8 w-8 rounded-full ring-2 transition ${
                skin.toLowerCase() === tone.toLowerCase() ? 'ring-emerald-300 scale-110' : 'ring-white/20'
              }`}
              style={{ backgroundColor: tone }}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Hair</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {HAIR_SWATCHES.map((tone) => (
            <button
              key={tone}
              type="button"
              aria-label={`Hair ${tone}`}
              onClick={() => onChange({ skin, hair: tone })}
              className={`h-8 w-8 rounded-full ring-2 transition ${
                hair.toLowerCase() === tone.toLowerCase() ? 'ring-emerald-300 scale-110' : 'ring-white/20'
              }`}
              style={{ backgroundColor: tone }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
