'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToastStore } from '@/store/toast.store';
import { completeLesson } from '@/lib/actions/kbs';
import { LessonContentType } from '@kambriq/common/constants/kbs/lesson-content';
import type { LessonView } from '@/types/kbs';

interface Props {
  lesson: LessonView;
}

export const KbsLessonView = ({ lesson }: Props) => {
  const t = useTranslations('app.kbs.lesson');
  const { createToast } = useToastStore();
  const router = useRouter();
  const pathname = usePathname();

  const [completed, setCompleted] = useState(Boolean(lesson.completedAt));
  const [pending, startTransition] = useTransition();

  const handleComplete = () => {
    startTransition(async () => {
      const res = await completeLesson(lesson.id, pathname);
      if (!res.success) {
        createToast({ status: 'error', title: res.error });
        return;
      }
      setCompleted(true);
      createToast({ status: 'success', title: t('completed') });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/kbs/modules/${lesson.moduleId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" />
        {t('backToModule')}
      </Link>

      <header className="space-y-1">
        <p className="text-xs tracking-wide text-gray-400 uppercase">
          {lesson.moduleTitle} · {t('duration')}: {lesson.duration} {t('minutes')}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          {lesson.order}. {lesson.title}
        </h1>
      </header>

      <Card>
        <CardContent className="p-4">
          <LessonBody lesson={lesson} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {lesson.navigation.prev && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/kbs/lessons/${lesson.navigation.prev.id}`} className="gap-1">
                <ArrowLeft className="size-4" />
                {t('prev')}
              </Link>
            </Button>
          )}
          {lesson.navigation.next && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/kbs/lessons/${lesson.navigation.next.id}`} className="gap-1">
                {t('next')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
        {completed ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="size-4" />
            {t('completed')}
          </span>
        ) : (
          <Button onClick={handleComplete} disabled={pending}>
            {pending && <Spinner className="size-4" />}
            {t('markComplete')}
          </Button>
        )}
      </div>
    </div>
  );
};

const LessonBody = ({ lesson }: { lesson: LessonView }) => {
  if (lesson.contentType === LessonContentType.VIDEO && lesson.contentUrl) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
        <video
          src={lesson.contentUrl}
          controls
          controlsList="nodownload"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          className="h-full w-full"
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  if (lesson.contentType === LessonContentType.PDF && lesson.contentUrl) {
    return (
      <iframe
        src={lesson.contentUrl}
        className="h-[70vh] w-full rounded-md border border-gray-200"
        title={lesson.title}
      />
    );
  }

  if (lesson.contentType === LessonContentType.HTML && lesson.content) {
    return (
      <div
        className="prose prose-sm max-w-none"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: KBS-authored content
        dangerouslySetInnerHTML={{ __html: lesson.content }}
      />
    );
  }

  if (lesson.contentType === LessonContentType.TEXT && lesson.content) {
    return (
      <div className="prose prose-sm max-w-none text-gray-800">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.content}</ReactMarkdown>
      </div>
    );
  }

  return <p className="text-sm text-gray-500">—</p>;
};
