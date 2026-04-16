import { FileCheck, Clock, CheckCircle, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type VerificationRequest = {
  id: string;
  tfNumber: string;
  location: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  requestDate: string;
  completionDate?: string;
  result?: {
    tfAuthentic: boolean;
    kambriqOpinion: 'approved' | 'rejected' | 'pending';
    reportUrl?: string;
    certificateUrl?: string;
  };
};

const STATUS_CONFIG: Record<
  VerificationRequest['status'],
  { icon: React.ElementType; label: string; style: string }
> = {
  pending: { icon: Clock, label: 'En attente', style: 'border-gray-200 bg-gray-50 text-gray-600' },
  in_progress: {
    icon: Clock,
    label: 'En cours',
    style: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  completed: {
    icon: CheckCircle,
    label: 'Terminé',
    style: 'border-success/30 bg-success/10 text-success',
  },
  rejected: { icon: XCircle, label: 'Rejeté', style: 'border-red-300 bg-red-50 text-red-700' },
};

export const VerificationCard = ({ request }: { request: VerificationRequest }) => {
  const { icon: Icon, label, style } = STATUS_CONFIG[request.status];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck className="size-4 text-gray-400" />
              <span className="font-mono text-sm font-semibold">{request.tfNumber}</span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{request.location}</p>
          </div>
          <Badge className={style}>
            <Icon className="size-3" />
            {label}
          </Badge>
        </div>
        <p className="mb-3 text-xs text-gray-400">Demandé le {request.requestDate}</p>
        {request.result && (
          <div className="flex gap-2">
            {request.result.reportUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={request.result.reportUrl} target="_blank" rel="noopener noreferrer">
                  Rapport PDF
                </a>
              </Button>
            )}
            {request.result.certificateUrl && (
              <Button asChild size="sm">
                <a href={request.result.certificateUrl} target="_blank" rel="noopener noreferrer">
                  Certificat
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
