import Link from 'next/link';
import { CheckCircle, Lock, PlayCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Module = {
  id: string;
  num: number;
  title: string;
  status: 'completed' | 'in_progress' | 'locked';
  progress: number;
  lessonsTotal: number;
  lessonsCompleted: number;
};

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle,
    color: 'text-success',
    badge: 'border-success/30 bg-success/10 text-success',
    label: 'Terminé',
  },
  in_progress: {
    icon: PlayCircle,
    color: 'text-primary-600',
    badge: 'border-primary-300 bg-primary-50 text-primary-700',
    label: 'En cours',
  },
  locked: {
    icon: Lock,
    color: 'text-gray-300',
    badge: 'border-gray-200 bg-gray-50 text-gray-400',
    label: 'Verrouillé',
  },
};

export const ModuleProgressCard = ({ module }: { module: Module }) => {
  const { icon: Icon, color, badge, label } = STATUS_CONFIG[module.status];
  return (
    <Card className={module.status === 'locked' ? 'opacity-60' : ''}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold ${color}`}
            >
              {module.num}
            </div>
            <div>
              <p className="text-xs text-gray-400">Module {module.num}</p>
              <h3 className="text-sm font-semibold text-gray-900">{module.title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon className={`size-4 ${color}`} />
            <Badge className={`text-xs ${badge}`}>{label}</Badge>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>
              {module.lessonsCompleted}/{module.lessonsTotal} leçons
            </span>
            <span>{module.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: `${module.progress}%` }}
            />
          </div>
        </div>
        {module.status !== 'locked' && (
          <Button
            asChild
            size="sm"
            variant={module.status === 'completed' ? 'outline' : 'default'}
            className="w-full"
          >
            <Link href={`/kbs/lessons/${module.id}`}>
              {module.status === 'completed' ? 'Réviser' : 'Continuer'}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
