import { OPENING_ROLE_CARDS, OPENING_ROLE_EYEBROW, OPENING_ROLE_LEAD, OPENING_ROLE_TITLE } from '../openingRoleCopy';
import type { OpeningSquadPick } from '../squadStatus';
import { useCareerStore } from '../store';

export default function OpeningRoleScreen() {
  const confirmOpeningRole = useCareerStore((s) => s.confirmOpeningRole);
  const backFromSetup = useCareerStore((s) => s.backFromSetup);
  const playerName = useCareerStore((s) => s.playerName);

  return (
    <div className="flex h-full w-full flex-col items-center gap-5 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-white">
      <div>
        <button
          type="button"
          onClick={backFromSetup}
          className="mb-3 text-xs font-semibold text-white/50 underline underline-offset-2"
        >
          Back
        </button>
        <p className="text-sm text-white/50">{OPENING_ROLE_EYEBROW}</p>
        <h1 className="font-display text-2xl font-bold">{OPENING_ROLE_TITLE}</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          {playerName ? `${playerName} starts here. ` : ''}
          {OPENING_ROLE_LEAD}
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3 text-left">
        {OPENING_ROLE_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => confirmOpeningRole(card.id as OpeningSquadPick)}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-left transition active:scale-[0.98]"
          >
            <p className="text-sm font-bold text-white">{card.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/60">{card.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
