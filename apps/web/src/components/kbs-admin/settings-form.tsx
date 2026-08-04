'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useToastStore } from '@/store/toast.store';
import { adminUpdateSettings } from '@/lib/actions/kbs';
import type { AdminCourse, AdminSettings } from '@/types/kbs';

const NO_COURSE = '__none__';

interface Props {
  settings: AdminSettings | null;
  courses: AdminCourse[];
}

export const SettingsForm = ({ settings, courses }: Props) => {
  const t = useTranslations('app.adminKbs.settings');
  const { createToast } = useToastStore();
  const router = useRouter();
  const pathname = usePathname();
  const [activeCourseId, setActiveCourseId] = useState(settings?.activeCourseId ?? '');
  const [examQuestionCount, setExamQuestionCount] = useState(settings?.examQuestionCount ?? 20);
  const [quizQuestionCount, setQuizQuestionCount] = useState(settings?.quizQuestionCount ?? 5);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(settings?.quizMaxAttempts ?? 5);
  const [quizCooldownMinutes, setQuizCooldownMinutes] = useState(
    settings?.quizCooldownMinutes ?? 60,
  );
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const res = await adminUpdateSettings(
        {
          activeCourseId: activeCourseId || null,
          examQuestionCount,
          quizQuestionCount,
          quizMaxAttempts,
          quizCooldownMinutes,
        },
        pathname,
      );
      if (!res.success) return createToast({ status: 'error', title: res.error });
      createToast({ status: 'success', title: t('saved') });
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field>
          <FieldLabel>{t('activeCourseId')}</FieldLabel>
          <Select
            value={activeCourseId || NO_COURSE}
            onValueChange={(value) => setActiveCourseId(value === NO_COURSE ? '' : value)}
            disabled={courses.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  courses.length === 0 ? t('noCoursesAvailable') : t('activeCoursePlaceholder')
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COURSE}>{t('noActiveCourse')}</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                  {!c.isPublished ? ` (${t('draft')})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>{t('examQuestionCount')}</FieldLabel>
            <Input
              type="number"
              value={examQuestionCount}
              onChange={(e) => setExamQuestionCount(Number(e.target.value))}
            />
          </Field>
          <Field>
            <FieldLabel>{t('quizQuestionCount')}</FieldLabel>
            <Input
              type="number"
              value={quizQuestionCount}
              onChange={(e) => setQuizQuestionCount(Number(e.target.value))}
            />
          </Field>
          <Field>
            <FieldLabel>{t('quizMaxAttempts')}</FieldLabel>
            <Input
              type="number"
              value={quizMaxAttempts}
              onChange={(e) => setQuizMaxAttempts(Number(e.target.value))}
            />
          </Field>
          <Field>
            <FieldLabel>{t('quizCooldownMinutes')}</FieldLabel>
            <Input
              type="number"
              value={quizCooldownMinutes}
              onChange={(e) => setQuizCooldownMinutes(Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={pending}>
            {pending && <Spinner className="size-4" />}
            {pending ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
