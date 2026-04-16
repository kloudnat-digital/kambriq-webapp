import { MapPin, Phone } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LABEL_STYLES } from '@/components/products/lands/admin/constants';

type LandPurchase = {
  id: string;
  title: string;
  label: 'TDT' | 'VEFL' | 'VEFIL';
  surface: string;
  price: string;
  status: 'in_progress' | 'reserved' | 'completed';
  location: string;
  reservationDate: string;
  agentName: string;
  agentPhone: string;
};

const STATUS_STYLES: Record<LandPurchase['status'], string> = {
  in_progress: 'border-amber-300 bg-amber-50 text-amber-700',
  reserved: 'border-blue-300 bg-blue-50 text-blue-700',
  completed: 'border-success/30 bg-success/10 text-success',
};

const STATUS_LABELS: Record<LandPurchase['status'], string> = {
  in_progress: 'En cours',
  reserved: 'Réservé',
  completed: 'Complété',
};

export const LandPurchaseCard = ({ land }: { land: LandPurchase }) => (
  <Card>
    <CardContent className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{land.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="size-3" /> {land.location}
          </p>
        </div>
        <Badge className={STATUS_STYLES[land.status]}>{STATUS_LABELS[land.status]}</Badge>
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Badge className={LABEL_STYLES[land.label]}>{land.label}</Badge>
        <span className="text-gray-600">{land.surface}</span>
        <span className="font-semibold text-primary-600">{land.price}</span>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="text-xs text-gray-500">
          <span className="font-medium">{land.agentName}</span> · Réservé le {land.reservationDate}
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`tel:${land.agentPhone}`}>
            <Phone className="size-3.5" />
          </a>
        </Button>
      </div>
    </CardContent>
  </Card>
);
