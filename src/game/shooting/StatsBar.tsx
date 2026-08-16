export interface ShotStats {
  shots: number;
  goals: number;
  streak: number;
  bestStreak: number;
}

interface StatItemProps {
  label: string;
  value: string | number;
  accent?: boolean;
}

function StatItem({ label, value, accent }: StatItemProps) {
  return (
    <div className="flex flex-col items-center px-3">
      <span className={`text-lg font-bold sm:text-xl ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-white/45 sm:text-xs">{label}</span>
    </div>
  );
}

export default function StatsBar({ stats }: { stats: ShotStats }) {
  const accuracy = stats.shots > 0 ? Math.round((stats.goals / stats.shots) * 100) : 0;

  return (
    <div className="z-10 mx-4 mb-2 flex items-center justify-center divide-x divide-white/10 rounded-xl bg-white/5 py-2 backdrop-blur">
      <StatItem label="Goals" value={stats.goals} accent />
      <StatItem label="Shots" value={stats.shots} />
      <StatItem label="Accuracy" value={`${accuracy}%`} />
      <StatItem label="Streak" value={stats.streak} accent={stats.streak > 0} />
      <StatItem label="Best" value={stats.bestStreak} />
    </div>
  );
}
