'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';
import { cn, toArray } from '@/lib/utils';
import LandFormSheet from './land-form-sheet';
import { ReservationDetailDialog } from './reservation-detail-dialog';
import LandsTable from './lands-table';
import ReservationsTable from './reservations-table';
import type { Land, LandLabel, LandReservation } from '@/types/lands';
import type { PaginatedResponse } from '@/types/api';
import {
  getLandsAction,
  getReservationsAction,
  getLabelsAction,
  getLandsStatsAction,
  archiveLandAction,
  toggleLandPublishAction,
  confirmReservationAction,
  completeReservationAction,
  cancelReservationAction,
} from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';

const LandsAdminContent = () => {
  const t = useTranslations('landsAdmin');
  const queryClient = useQueryClient();

  const [landPage, setLandPage] = useState(1);
  const [resSearch, setResSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [landSearch, setLandSearch] = useState('');
  const [landLabel, setLandLabel] = useState('all');
  const [resStatus, setResStatus] = useState('all');
  const [landRegion, setLandRegion] = useState('all');
  const [landStatus, setLandStatus] = useState('all');
  const [editingLand, setEditingLand] = useState<Land | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<LandReservation | null>(null);

  const debouncedLandSearch = useDebounce(landSearch, 300);
  const debouncedResSearch = useDebounce(resSearch, 300);

  const setFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setLandPage(1);
  };

  const { data: landsRaw } = useQuery({
    queryKey: ['admin-lands', { debouncedLandSearch, landLabel, landStatus, landPage }],
    queryFn: () =>
      getLandsAction({
        ...(debouncedLandSearch && { search: debouncedLandSearch }),
        ...(landLabel !== 'all' && { labelCode: landLabel }),
        ...(landStatus !== 'all' && { status: landStatus }),
        page: landPage,
        limit: 10,
      }).then(unwrap),
  });

  const { data: reservationsRaw } = useQuery({
    queryKey: ['admin-reservations', { debouncedResSearch, resStatus }],
    queryFn: () =>
      getReservationsAction({
        ...(debouncedResSearch && { search: debouncedResSearch }),
        ...(resStatus !== 'all' && { status: resStatus }),
        limit: 10,
      }).then(unwrap),
  });

  const { data: labelsRaw } = useQuery({
    queryKey: ['admin-labels'],
    queryFn: () => getLabelsAction().then(unwrap),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-lands-stats'],
    queryFn: () => getLandsStatsAction().then(unwrap),
    staleTime: 30_000,
  });

  const lands = toArray<Land>(landsRaw);
  const reservations = toArray<LandReservation>(reservationsRaw);
  const labels = toArray<LandLabel>(labelsRaw);
  const landsMeta = (landsRaw as PaginatedResponse<Land> | null)?.meta;

  const regions = useMemo(() => [...new Set(lands.map((l) => l.region))].sort(), [lands]);

  const filteredLands = useMemo(
    () => (landRegion !== 'all' ? lands.filter((l) => l.region === landRegion) : lands),
    [lands, landRegion],
  );

  const statsValues = (stats ?? { available: 0, reserved: 0, sold: 0, pendingReservations: 0 }) as {
    available: number;
    reserved: number;
    sold: number;
    pendingReservations: number;
  };

  const landStats = [
    { name: t('stats.available'), value: statsValues.available },
    { name: t('stats.reserved'), value: statsValues.reserved },
    { name: t('stats.sold'), value: statsValues.sold },
    { name: t('stats.pendingReservations'), value: statsValues.pendingReservations },
  ];

  const handleTogglePublish = async (land: Land) => {
    const result = await toggleLandPublishAction(land.id, !land.isPublished);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['admin-lands'] });
    toast.success(land.isPublished ? t('lands.unpublished') : t('lands.published'));
  };

  const handleArchive = async (land: Land) => {
    const result = await archiveLandAction(land.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['admin-lands'] });
    toast.success(t('lands.archived'));
  };

  const invalidateReservations = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
    queryClient.invalidateQueries({ queryKey: ['admin-lands'] });
    queryClient.invalidateQueries({ queryKey: ['admin-lands-stats'] });
  };

  const handleConfirmReservation = async (id: string) => {
    const result = await confirmReservationAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    invalidateReservations();
    toast.success(t('reservations.action.confirmSuccess'));
  };

  const handleCompleteReservation = async (id: string) => {
    const result = await completeReservationAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    invalidateReservations();
    toast.success(t('reservations.action.completeSuccess'));
  };

  const handleCancelReservation = async (id: string, reason: string) => {
    const result = await cancelReservationAction(id, reason);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    invalidateReservations();
    toast.success(t('reservations.action.cancelSuccess'));
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-6 sm:flex-nowrap">
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
              <p className="text-sm/6 font-medium text-gray-500 dark:text-gray-400">{stat.name}</p>
              <p className="w-full flex-none text-3xl/10 font-medium tracking-tight text-gray-900 dark:text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </dl>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
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
              {statsValues.pendingReservations > 0 && (
                <Badge className="ml-3 bg-gray-100 px-2.5 text-gray-900 group-data-[state=active]:bg-primary-100 group-data-[state=active]:text-primary-600">
                  {statsValues.pendingReservations}
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
              page={landPage}
              totalPages={landsMeta?.totalPages ?? 1}
              onSearchChange={setFilter(setLandSearch)}
              onRegionChange={setFilter(setLandRegion)}
              onLabelChange={setFilter(setLandLabel)}
              onStatusChange={setFilter(setLandStatus)}
              onPageChange={setLandPage}
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
              reservations={reservations}
              search={resSearch}
              status={resStatus}
              onSearchChange={setResSearch}
              onStatusChange={setResStatus}
              onConfirm={handleConfirmReservation}
              onComplete={handleCompleteReservation}
              onSelect={setSelectedReservation}
            />
          </TabsContent>
        </Tabs>
      </div>

      <LandFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        land={editingLand}
        labels={labels}
        onSuccessAction={() => {
          setFormOpen(false);
          queryClient.invalidateQueries({ queryKey: ['admin-lands'] });
        }}
      />

      <ReservationDetailDialog
        reservation={selectedReservation}
        onClose={() => setSelectedReservation(null)}
        onConfirm={handleConfirmReservation}
        onComplete={handleCompleteReservation}
        onCancel={handleCancelReservation}
      />
    </div>
  );
};

export default LandsAdminContent;
