'use client';

import Link from 'next/link';
import { MessageCircle, Video, Calendar, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const MENTORS = [
  {
    id: '1',
    name: 'Marie Kameni',
    role: 'Expert KCA · 24 ventes',
    rating: 4.9,
    reviews: 18,
    available: true,
    speciality: 'Diaspora Europe',
  },
  {
    id: '2',
    name: 'Paul Eteme',
    role: 'Senior KCA · 15 ventes',
    rating: 4.7,
    reviews: 12,
    available: true,
    speciality: 'Douala & Littoral',
  },
  {
    id: '3',
    name: 'Sophie Mbarga',
    role: 'Expert KCA · 20 ventes',
    rating: 4.8,
    reviews: 22,
    available: false,
    speciality: 'Investissement locatif',
  },
];

const MentorCard = ({
  mentor,
  t,
}: {
  mentor: (typeof MENTORS)[0];
  t: ReturnType<typeof useTranslations>;
}) => (
  <Card>
    <CardContent className="p-6">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-xl font-bold text-primary-600">
          {mentor.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{mentor.name}</h3>
          <p className="text-xs text-gray-500">{mentor.role}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Star className="size-3.5 fill-gold-400 text-gold-400" />
            <span className="text-xs font-medium">{mentor.rating}</span>
            <span className="text-xs text-gray-400">({mentor.reviews} avis)</span>
          </div>
        </div>
        <Badge
          className={
            mentor.available
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-gray-200 bg-gray-50 text-gray-400'
          }
        >
          {mentor.available ? t('available') : t('busy')}
        </Badge>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        {t('speciality')} : <span className="font-medium text-gray-700">{mentor.speciality}</span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" disabled={!mentor.available}>
          <Calendar className="size-3.5" /> {t('planButton')}
        </Button>
        <Button variant="outline" size="sm" className="px-3">
          <MessageCircle className="size-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="px-3">
          <Video className="size-3.5" />
        </Button>
      </div>
    </CardContent>
  </Card>
);

export const MentorshipContent = () => {
  const t = useTranslations('app.mentorship');
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/mentorship/analytics">Mes analytics</Link>
        </Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MENTORS.map((m) => (
          <MentorCard key={m.id} mentor={m} t={t} />
        ))}
      </div>
    </div>
  );
};
