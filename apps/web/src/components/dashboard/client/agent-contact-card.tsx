import { MessageCircle, Mail, Phone } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Agent = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  status: 'confirmed' | 'pending';
  kcaNumber: string;
};

export const AgentContactCard = ({ agent }: { agent: Agent }) => (
  <Card className="sticky top-24">
    <CardContent className="p-6">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white">
          {agent.name.charAt(0)}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
          <p className="text-xs text-gray-500">{agent.kcaNumber}</p>
          <Badge
            className={`mt-1 text-xs ${agent.status === 'confirmed' ? 'border-success/30 bg-success/10 text-success' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
          >
            {agent.status === 'confirmed' ? 'Agent certifié' : 'En attente'}
          </Badge>
        </div>
      </div>
      <div className="space-y-2">
        <Button asChild className="w-full" size="sm">
          <a
            href={`https://wa.me/${agent.whatsapp.replace(/\s+/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={`mailto:${agent.email}`}>
            <Mail className="size-4" /> Email
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={`tel:${agent.phone}`}>
            <Phone className="size-4" /> Appeler
          </a>
        </Button>
      </div>
    </CardContent>
  </Card>
);
