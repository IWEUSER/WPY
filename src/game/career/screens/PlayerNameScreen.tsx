import { useMemo, useState } from 'react';
import { appearanceRegionForNation, pickPlayerLook } from '../../shooting/appearance';
import { getNation } from '../international';
import { useCareerStore } from '../store';
import { AppearancePicker } from './AppearancePicker';

const MAX_LENGTH = 32;

function validPlayerName(value: string): string | null {
  const name = value.replace(/\s+/g, ' ').trim();
  if (name.length < 2) return 'Use at least two letters.';
  if (name.length > MAX_LENGTH) return `Keep it under ${MAX_LENGTH} characters.`;
  if (!/^[\p{L}][\p{L} .'-]*[\p{L}.]$/u.test(name) && !/^[\p{L}]{2,}$/u.test(name)) {
    return 'Letters, spaces, hyphens, and apostrophes only.';
  }
  if (!/[\p{L}]{2,}/u.test(name)) return 'Use at least two letters.';
  return null;
}

export default function PlayerNameScreen() {
  const confirmPlayerName = useCareerStore((s) => s.confirmPlayerName);
  const backFromSetup = useCareerStore((s) => s.backFromSetup);
  const nationality = useCareerStore((s) => s.nationality);
  const [value, setValue] = useState('');
  const suggested = useMemo(() => {
    const nation = nationality ? getNation(nationality) : undefined;
    return pickPlayerLook(1, appearanceRegionForNation(nation ?? null));
  }, [nationality]);
  const [skin, setSkin] = useState(suggested.skin);
  const [hair, setHair] = useState(suggested.hair);
  const error = value.trim() ? validPlayerName(value) : null;

  return (
    <div className="flex h-full w-full flex-col items-center gap-5 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <button
          type="button"
          onClick={backFromSetup}
          className="mb-3 text-xs font-semibold text-white/50 underline underline-offset-2"
        >
          Back
        </button>
        <p className="text-sm text-white/50">Career identity</p>
        <h1 className="font-display text-2xl font-bold">Name the player</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          This is the name that appears on your profile, records, and season review. Pick a skin and hair colour so the portrait matches.
        </p>
      </div>

      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const problem = validPlayerName(value);
          if (problem) return;
          confirmPlayerName(value.replace(/\s+/g, ' ').trim(), { skin, hair });
        }}
      >
        <input
          autoFocus
          type="text"
          value={value}
          maxLength={MAX_LENGTH}
          onChange={(event) => setValue(event.target.value)}
          placeholder="First and last name"
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-lg text-white placeholder:text-white/40 outline-none focus:border-emerald-400/60"
        />
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <AppearancePicker
          skin={skin}
          hair={hair}
          onChange={(look) => {
            setSkin(look.skin);
            setHair(look.hair);
          }}
        />
        <button
          type="submit"
          disabled={Boolean(validPlayerName(value))}
          className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition enabled:active:scale-[0.98] disabled:opacity-40"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
