import { NATIONS } from '../international';
import { useCareerStore } from '../store';

const CONFEDERATION_LABEL: Record<string, string> = {
  UEFA: 'UEFA',
  CONCACAF: 'CONCACAF',
  AFC: 'AFC',
};

export default function NationalityScreen() {
  const chooseNationality = useCareerStore((s) => s.chooseNationality);

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <p className="text-sm text-white/50">International career</p>
        <h1 className="text-2xl font-extrabold tracking-wide">Who do you play for?</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          This is independent of your club. Selectors later look at your goal ratio and the level of club you play for.
          The same miss-streak rule applies: go too long without scoring for your country and you get dropped.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {NATIONS.map((nation) => (
          <button
            key={nation.id}
            type="button"
            onClick={() => chooseNationality(nation.id)}
            className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 text-left backdrop-blur transition active:scale-[0.98]"
          >
            <div className="flex-1">
              <p className="font-bold">{nation.name}</p>
              <p className="text-xs text-white/50">{CONFEDERATION_LABEL[nation.confederation]}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
