import { Trophy, Medal } from 'lucide-react';

const STUDENTS = [
  { rank: 1, name: 'Alphonse Biya', score: 94, modules: 6, promo: '2024' },
  { rank: 2, name: 'Sandra Njoh', score: 91, modules: 6, promo: '2024' },
  { rank: 3, name: 'Roland Fouda', score: 88, modules: 5, promo: '2025' },
  { rank: 4, name: 'Claire Mbarga', score: 85, modules: 5, promo: '2025' },
  { rank: 5, name: 'Jean Dupont', score: 82, modules: 4, promo: '2025' },
  { rank: 6, name: 'Marie Ngo', score: 78, modules: 4, promo: '2025' },
  { rank: 7, name: 'Paul Eteme', score: 75, modules: 3, promo: '2025' },
  { rank: 8, name: 'Alice Kameni', score: 72, modules: 3, promo: '2025' },
];

const RankIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return <Trophy className="size-5 text-gold-500" />;
  if (rank === 2) return <Medal className="size-4 text-gray-400" />;
  if (rank === 3) return <Medal className="size-4 text-amber-600" />;
  return <span className="text-sm font-bold text-gray-400">#{rank}</span>;
};

export const LeaderboardTable = () => (
  <div className="rounded-2xl border border-border bg-white shadow-sm">
    <div className="flex items-center gap-2 border-b border-border px-6 py-4">
      <Trophy className="size-5 text-gold-500" />
      <h2 className="font-semibold text-gray-900">Classement des étudiants KBS</h2>
    </div>
    <div className="divide-y divide-border">
      {STUDENTS.map((s) => (
        <div
          key={s.rank}
          className={`flex items-center gap-4 px-6 py-4 ${s.rank <= 3 ? 'bg-gradient-to-r from-gold-50/30 to-transparent' : ''}`}
        >
          <div className="flex w-8 items-center justify-center">
            <RankIcon rank={s.rank} />
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-sm font-bold text-primary-600">
            {s.name.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">{s.name}</p>
            <p className="text-xs text-gray-400">
              Promo {s.promo} · {s.modules}/6 modules
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary-600">{s.score}</p>
            <p className="text-xs text-gray-400">/ 100</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);
