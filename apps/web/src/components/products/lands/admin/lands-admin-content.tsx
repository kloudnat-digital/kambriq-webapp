'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AdminLand, AdminReservation, LandFormValues } from './types';
import { MOCK_ADMIN_LANDS, MOCK_LABELS, MOCK_RESERVATIONS } from './mock-data';
import { LandFormSheet } from './land-form-sheet';
import { ReservationDetailDialog } from './reservation-detail-dialog';
import { LandsTable } from './lands-table';
import { ReservationsTable } from './reservations-table';

/*

<StatCard label={t('stats.total')} value={stats.total} />
            <StatCard label={t('stats.available')} value={stats.available} accent="text-success" />
            <StatCard label={t('stats.reserved')} value={stats.reserved} accent="text-amber-600" />
            <StatCard label={t('stats.sold')} value={stats.sold} accent="text-blue-600" />
            <StatCard
              label={t('stats.pendingReservations')}
              value={stats.pending}
              accent={stats.pending > 0 ? 'text-amber-600' : undefined}
            />

*/

const LandsAdminContent = () => {
  const t = useTranslations('landsAdmin');

  // ── Lands state ──
  const [lands, setLands] = useState<AdminLand[]>(MOCK_ADMIN_LANDS);
  const [landSearch, setLandSearch] = useState('');
  const [landRegion, setLandRegion] = useState('all');
  const [landLabel, setLandLabel] = useState('all');
  const [landStatus, setLandStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingLand, setEditingLand] = useState<AdminLand | null>(null);

  // ── Reservations state ──
  const [reservations, setReservations] = useState<AdminReservation[]>(MOCK_RESERVATIONS);
  const [resSearch, setResSearch] = useState('');
  const [resStatus, setResStatus] = useState('all');
  const [selectedReservation, setSelectedReservation] = useState<AdminReservation | null>(null);

  // ── Derived ──
  const stats = useMemo(
    () => ({
      total: lands.length,
      available: lands.filter((l) => l.status === 'AVAILABLE').length,
      reserved: lands.filter((l) => l.status === 'RESERVED').length,
      sold: lands.filter((l) => l.status === 'SOLD').length,
      pending: reservations.filter((r) => r.status === 'PENDING').length,
    }),
    [lands, reservations],
  );

  const landStats = [
    {
      name: t('stats.available'),
      value: stats.available,
    },
    {
      name: t('stats.reserved'),
      value: stats.reserved,
    },
    {
      name: t('stats.sold'),
      value: stats.sold,
    },
    {
      name: t('stats.pendingReservations'),
      value: stats.pending,
    },
  ];

  const regions = useMemo(() => [...new Set(lands.map((l) => l.region))].sort(), [lands]);

  const filteredLands = useMemo(
    () =>
      lands.filter((l) => {
        const q = landSearch.toLowerCase();
        if (q && !l.title.toLowerCase().includes(q) && !l.city?.toLowerCase().includes(q))
          return false;
        if (landRegion !== 'all' && l.region !== landRegion) return false;
        if (landLabel !== 'all' && l.label.code !== landLabel) return false;
        if (landStatus !== 'all' && l.status !== landStatus) return false;
        return true;
      }),
    [lands, landSearch, landRegion, landLabel, landStatus],
  );

  const filteredReservations = useMemo(
    () =>
      reservations.filter((r) => {
        if (resStatus !== 'all' && r.status !== resStatus) return false;
        if (resSearch) {
          const q = resSearch.toLowerCase();
          if (
            !r.clientName.toLowerCase().includes(q) &&
            !r.land.title.toLowerCase().includes(q) &&
            !r.agent.name.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      }),
    [reservations, resSearch, resStatus],
  );

  // ── Land handlers ──
  const handleTogglePublish = (land: AdminLand) => {
    setLands((prev) =>
      prev.map((l) => (l.id === land.id ? { ...l, isPublished: !l.isPublished } : l)),
    );
    toast.success(land.isPublished ? t('lands.unpublished') : t('lands.published'));
  };

  const handleArchive = (land: AdminLand) => {
    setLands((prev) =>
      prev.map((l) => (l.id === land.id ? { ...l, status: 'ARCHIVED', isPublished: false } : l)),
    );
    toast.success(t('lands.archived'));
  };

  const handleSaveLand = (values: LandFormValues) => {
    if (editingLand) {
      setLands((prev) =>
        prev.map((l) =>
          l.id === editingLand.id
            ? {
                ...l,
                ...values,
                label: MOCK_LABELS.find((lb) => lb.id === values.labelId) ?? l.label,
              }
            : l,
        ),
      );
    } else {
      const newLand: AdminLand = {
        id: `land-${Date.now()}`,
        slug: values.title.toLowerCase().replace(/\s+/g, '-'),
        status: 'AVAILABLE',
        media: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...values,
        label: MOCK_LABELS.find((lb) => lb.id === values.labelId) ?? MOCK_LABELS[0],
      };
      setLands((prev) => [newLand, ...prev]);
    }
  };

  // ── Reservation handlers ──
  const handleReservationUpdate = (
    id: string,
    action: 'confirm' | 'complete' | 'cancel',
    reason?: string,
  ) => {
    setReservations((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (action === 'confirm')
          return { ...r, status: 'CONFIRMED' as const, downPaymentConfirmed: true };
        if (action === 'complete') return { ...r, status: 'COMPLETED' as const };
        if (action === 'cancel') return { ...r, status: 'CANCELLED' as const, reason };
        return r;
      }),
    );

    const res = reservations.find((r) => r.id === id);
    if (action === 'complete' && res) {
      setLands((prev) => prev.map((l) => (l.id === res.land.id ? { ...l, status: 'SOLD' } : l)));
    }
    if (action === 'cancel' && res) {
      setLands((prev) =>
        prev.map((l) =>
          l.id === res.land.id && l.status === 'RESERVED' ? { ...l, status: 'AVAILABLE' } : l,
        ),
      );
    }
  };

  return (
    <main>
      <div className="relative isolate overflow-hidden">
        <header className="pt-6 pb-4 sm:pb-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-4 sm:flex-nowrap sm:px-6 lg:px-8">
            <div>
              <h1 className="text-base/7 font-semibold text-gray-900">{t('header.title')}</h1>
              <p className="text-sm font-medium text-gray-600">{t('header.subtitle')}</p>
            </div>
            <Button
              size={'lg'}
              className="ml-0 h-9 sm:ml-auto"
              onClick={() => {
                setEditingLand(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t('header.newLand')}
            </Button>
          </div>
        </header>
        <div className="border-b border-b-gray-900/10 lg:border-t lg:border-t-gray-900/5">
          <dl className="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:px-2 xl:px-0">
            {landStats.map((stat, statIdx) => (
              <div
                key={stat.name}
                className={cn(
                  statIdx % 2 === 1 ? 'sm:border-l' : statIdx === 2 ? 'lg:border-l' : '',
                  'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-gray-900/5 px-4 py-10 sm:px-6 lg:border-t-0 xl:px-8 dark:border-white/5',
                )}
              >
                <p className="text-sm/6 font-medium text-gray-500 dark:text-gray-400">
                  {stat.name}
                </p>
                <p className="w-full flex-none text-3xl/10 font-medium tracking-tight text-gray-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
            ))}
          </dl>
        </div>

        <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
          {/* Tabs */}
          <Tabs defaultValue="lands" className="flex-col">
            <TabsList variant="line" className="h-auto w-full pb-0">
              <TabsTrigger value="lands" className="group rounded-none px-5 pb-3">
                {t('tabs.lands')}
                <Badge
                  variant="secondary"
                  className="ml-3 bg-gray-100 px-2.5 text-gray-900 group-data-[state=active]:bg-primary-100 group-data-[state=active]:text-primary-600"
                >
                  {lands.filter((l) => l.status !== 'ARCHIVED').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="reservations" className="group rounded-none px-5 pb-3">
                {t('tabs.reservations')}
                {stats.pending > 0 && (
                  <Badge className="ml-3 bg-gray-100 px-2.5 text-gray-900 group-data-[state=active]:bg-primary-100 group-data-[state=active]:text-primary-600">
                    {stats.pending}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lands" className="mt-6">
              <LandsTable
                lands={filteredLands}
                regions={regions}
                search={landSearch}
                region={landRegion}
                label={landLabel}
                status={landStatus}
                onSearchChange={setLandSearch}
                onRegionChange={setLandRegion}
                onLabelChange={setLandLabel}
                onStatusChange={setLandStatus}
                onEdit={(land) => {
                  setEditingLand(land);
                  setFormOpen(true);
                }}
                onTogglePublish={handleTogglePublish}
                onArchive={handleArchive}
              />
            </TabsContent>

            <TabsContent value="reservations" className="mt-6">
              <ReservationsTable
                reservations={filteredReservations}
                search={resSearch}
                status={resStatus}
                onSearchChange={setResSearch}
                onStatusChange={setResStatus}
                onUpdate={handleReservationUpdate}
                onSelect={setSelectedReservation}
              />
            </TabsContent>
          </Tabs>
        </div>

        <LandFormSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          land={editingLand}
          labels={MOCK_LABELS}
          onSave={handleSaveLand}
        />

        <ReservationDetailDialog
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onUpdate={handleReservationUpdate}
        />
      </div>
    </main>
  );
};

export default LandsAdminContent;
