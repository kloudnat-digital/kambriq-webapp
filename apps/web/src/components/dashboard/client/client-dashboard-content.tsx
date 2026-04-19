'use client';

import { MapPin, FileText, User, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { LandPurchaseCard } from './land-purchase-card';
import { VerificationCard } from './verification-card';
import { AgentContactCard } from './agent-contact-card';

const MOCK_AGENT = {
  name: 'Marie Kameni',
  email: 'marie.kameni@kambriq.com',
  phone: '+237 6 XX XX XX XX',
  whatsapp: '+237699123456',
  status: 'confirmed' as const,
  kcaNumber: 'KCA-2024-0145',
};

const MOCK_LANDS = [
  {
    id: 'LAND-001',
    title: 'Terrain résidentiel - Bastos',
    label: 'TDT' as const,
    surface: '500 m²',
    price: '45 000 000 XAF',
    status: 'in_progress' as const,
    location: 'Yaoundé, Bastos',
    reservationDate: '15/01/2025',
    agentName: 'Marie Kameni',
    agentPhone: '+237699123456',
  },
  {
    id: 'LAND-002',
    title: 'Terrain commercial - Akwa',
    label: 'VEFIL' as const,
    surface: '800 m²',
    price: '75 000 000 XAF',
    status: 'reserved' as const,
    location: 'Douala, Akwa',
    reservationDate: '10/01/2025',
    agentName: 'Marie Kameni',
    agentPhone: '+237699123456',
  },
];

const MOCK_VERIFICATIONS = [
  {
    id: 'VER-001',
    tfNumber: 'TF-12345/YDE',
    location: 'Yaoundé, Bastos',
    status: 'completed' as const,
    requestDate: '15/01/2025',
    completionDate: '18/01/2025',
    result: {
      tfAuthentic: true,
      kambriqOpinion: 'approved' as const,
      reportUrl: '#',
      certificateUrl: '#',
    },
  },
  {
    id: 'VER-002',
    tfNumber: 'TF-67890/DLA',
    location: 'Douala, Akwa',
    status: 'in_progress' as const,
    requestDate: '18/01/2025',
  },
];

export const ClientDashboardContent = () => {
  const t = useTranslations('app.clientDashboard');
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('greeting')}, Jean 👋</h1>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="lands">
            <TabsList variant="line" className="h-auto w-full pb-0">
              <TabsTrigger value="lands" className="rounded-none px-4 pb-3 text-sm">
                <MapPin className="size-4" /> {t('tabLands')}
              </TabsTrigger>
              <TabsTrigger value="verify" className="rounded-none px-4 pb-3 text-sm">
                <FileText className="size-4" /> {t('tabVerify')}
              </TabsTrigger>
              <TabsTrigger value="agent" className="rounded-none px-4 pb-3 text-sm lg:hidden">
                <User className="size-4" /> {t('tabAgent')}
              </TabsTrigger>
              <TabsTrigger value="profile" className="rounded-none px-4 pb-3 text-sm">
                <Settings className="size-4" /> {t('tabProfile')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="lands" className="mt-6 space-y-4">
              {MOCK_LANDS.map((l) => (
                <LandPurchaseCard key={l.id} land={l} />
              ))}
            </TabsContent>
            <TabsContent value="verify" className="mt-6 space-y-4">
              {MOCK_VERIFICATIONS.map((v) => (
                <VerificationCard key={v.id} request={v} />
              ))}
            </TabsContent>
            <TabsContent value="agent" className="mt-6 lg:hidden">
              <AgentContactCard agent={MOCK_AGENT} />
            </TabsContent>
            <TabsContent value="profile" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500">{t('profilePlaceholder')}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <div className="hidden lg:block">
          <AgentContactCard agent={MOCK_AGENT} />
        </div>
      </div>
    </div>
  );
};
