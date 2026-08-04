'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import {
  adminCreateCourse,
  adminCreateLesson,
  adminCreateModule,
  adminDeleteLesson,
  adminDeleteModule,
  adminGetLessonUploadUrl,
  adminUpdateCourse,
  adminUpdateLesson,
  adminUpdateModule,
} from '@/lib/actions/kbs';
import type {
  AdminCourseDetail,
  AdminLesson,
  AdminModule,
  KbsLessonContentType,
} from '@/types/kbs';

interface Props {
  course: AdminCourseDetail | null;
  activeCourseId: string | null;
}

const CONTENT_TYPES: KbsLessonContentType[] = ['VIDEO', 'PDF', 'HTML', 'TEXT'];

const uploadToS3 = async (uploadUrl: string, file: File) => {
  const r = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!r.ok) throw new Error(`Upload failed (${r.status})`);
};

export const CourseEditorContent = ({ course, activeCourseId }: Props) => {
  const t = useTranslations('app.adminKbs.course');
  const { createToast } = useToastStore();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [showCourseForm, setShowCourseForm] = useState(!course);
  const [courseTitle, setCourseTitle] = useState(course?.title ?? '');
  const [courseDesc, setCourseDesc] = useState(course?.description ?? '');
  const [coursePublished, setCoursePublished] = useState(course?.isPublished ?? false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [showLessonForm, setShowLessonForm] = useState<string | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);

  const refresh = () => router.refresh();

  const saveCourse = () => {
    startTransition(async () => {
      if (course) {
        const res = await adminUpdateCourse(
          course.id,
          { title: courseTitle, description: courseDesc, isPublished: coursePublished },
          pathname,
        );
        if (!res.success) return createToast({ status: 'error', title: res.error });
      } else {
        const res = await adminCreateCourse({
          title: courseTitle,
          description: courseDesc,
          isPublished: coursePublished,
        });
        if (!res.success) return createToast({ status: 'error', title: res.error });
      }
      setShowCourseForm(false);
      createToast({ status: 'success', title: t('save') });
      refresh();
    });
  };

  if (!activeCourseId && !course && !showCourseForm) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6 text-sm text-gray-500">
          <p>{t('noActiveCourse')}</p>
          <Button onClick={() => setShowCourseForm(true)}>{t('createCourse')}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        {course && !showCourseForm && (
          <Button variant="outline" size="sm" onClick={() => setShowCourseForm(true)}>
            {t('editCourse')}
          </Button>
        )}
      </header>

      {showCourseForm && (
        <Card>
          <CardHeader>
            <CardTitle>{course ? t('editCourse') : t('createCourse')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field>
              <FieldLabel>{t('title_')}</FieldLabel>
              <Input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{t('description')}</FieldLabel>
              <Textarea
                rows={4}
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                checked={coursePublished}
                onCheckedChange={(v) => setCoursePublished(v === true)}
                id="published"
              />
              <FieldLabel htmlFor="published">{t('isPublished')}</FieldLabel>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCourseForm(false)} disabled={pending}>
                {t('cancel')}
              </Button>
              <Button onClick={saveCourse} disabled={pending || !courseTitle.trim()}>
                {pending && <Spinner className="size-4" />}
                {t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {course && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">Modules</h2>
            <Button size="sm" variant="outline" onClick={() => setShowModuleForm(true)}>
              <Plus className="size-4" /> {t('addModule')}
            </Button>
          </div>

          {showModuleForm && (
            <ModuleForm
              courseId={course.id}
              nextOrder={(course.modules[course.modules.length - 1]?.order ?? 0) + 1}
              onDone={() => {
                setShowModuleForm(false);
                refresh();
              }}
              onCancel={() => setShowModuleForm(false)}
            />
          )}

          {course.modules.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-3 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setExpanded((s) => ({ ...s, [m.id]: !s[m.id] }))}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    {expanded[m.id] ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <span className="font-medium text-gray-900">
                    {m.order}. {m.title}
                  </span>
                  <span className="text-xs text-gray-500">
                    {m.lessons.length} lessons · {m.questionsCount} Q quiz
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingModule(m.id)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!confirm('Delete module?')) return;
                        startTransition(async () => {
                          const r = await adminDeleteModule(m.id, pathname);
                          if (!r.success) return createToast({ status: 'error', title: r.error });
                          refresh();
                        });
                      }}
                    >
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                {editingModule === m.id && (
                  <ModuleForm
                    courseId={course.id}
                    module={m}
                    nextOrder={m.order}
                    onDone={() => {
                      setEditingModule(null);
                      refresh();
                    }}
                    onCancel={() => setEditingModule(null)}
                  />
                )}

                {expanded[m.id] && (
                  <div className="space-y-2 border-t border-gray-100 pt-3 pl-6">
                    {m.lessons.map((l) => (
                      <div key={l.id} className="space-y-2">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-700">
                            {l.order}. {l.title}
                          </span>
                          <span className="text-xs text-gray-500">
                            {l.contentType} · {l.duration}min
                          </span>
                          <div className="ml-auto flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingLesson(l.id)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (!confirm('Delete lesson?')) return;
                                startTransition(async () => {
                                  const r = await adminDeleteLesson(l.id, pathname);
                                  if (!r.success)
                                    return createToast({ status: 'error', title: r.error });
                                  refresh();
                                });
                              }}
                            >
                              <Trash2 className="size-3.5 text-red-600" />
                            </Button>
                          </div>
                        </div>
                        {editingLesson === l.id && (
                          <LessonForm
                            moduleId={m.id}
                            lesson={l}
                            onDone={() => {
                              setEditingLesson(null);
                              refresh();
                            }}
                            onCancel={() => setEditingLesson(null)}
                          />
                        )}
                      </div>
                    ))}

                    {showLessonForm === m.id ? (
                      <LessonForm
                        moduleId={m.id}
                        nextOrder={(m.lessons[m.lessons.length - 1]?.order ?? 0) + 1}
                        onDone={() => {
                          setShowLessonForm(null);
                          refresh();
                        }}
                        onCancel={() => setShowLessonForm(null)}
                      />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowLessonForm(m.id)}
                        className="gap-1"
                      >
                        <Plus className="size-3.5" /> {t('addLesson')}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
};

const ModuleForm = ({
  courseId,
  module,
  nextOrder,
  onDone,
  onCancel,
}: {
  courseId: string;
  module?: AdminModule;
  nextOrder: number;
  onDone: () => void;
  onCancel: () => void;
}) => {
  const t = useTranslations('app.adminKbs.course');
  const { createToast } = useToastStore();
  const pathname = usePathname();
  const [title, setTitle] = useState(module?.title ?? '');
  const [description, setDescription] = useState(module?.description ?? '');
  const [order, setOrder] = useState(module?.order ?? nextOrder);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      if (module) {
        const res = await adminUpdateModule(module.id, { title, description, order }, pathname);
        if (!res.success) return createToast({ status: 'error', title: res.error });
      } else {
        const res = await adminCreateModule({ courseId, title, description, order }, pathname);
        if (!res.success) return createToast({ status: 'error', title: res.error });
      }
      onDone();
    });
  };

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <Field>
        <FieldLabel>{t('title_')}</FieldLabel>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel>{t('description')}</FieldLabel>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel>{t('order')}</FieldLabel>
        <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button size="sm" onClick={save} disabled={pending || !title.trim()}>
          {pending && <Spinner className="size-4" />}
          {t('save')}
        </Button>
      </div>
    </div>
  );
};

const LessonForm = ({
  moduleId,
  lesson,
  nextOrder = 1,
  onDone,
  onCancel,
}: {
  moduleId: string;
  lesson?: AdminLesson;
  nextOrder?: number;
  onDone: () => void;
  onCancel: () => void;
}) => {
  const t = useTranslations('app.adminKbs.course');
  const { createToast } = useToastStore();
  const pathname = usePathname();
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [order, setOrder] = useState(lesson?.order ?? nextOrder);
  const [duration, setDuration] = useState(lesson?.duration ?? 5);
  const [contentType, setContentType] = useState<KbsLessonContentType>(
    lesson?.contentType ?? 'VIDEO',
  );
  const [contentUrl, setContentUrl] = useState(lesson?.contentUrl ?? '');
  const [fileLabel, setFileLabel] = useState(() =>
    lesson?.contentUrl ? lesson.contentUrl.split('/').pop() || '' : '',
  );
  const [content, setContent] = useState(lesson?.content ?? '');
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await adminGetLessonUploadUrl({
        filename: file.name,
        contentType: file.type,
      });
      if (!res.success) throw new Error(res.error);
      await uploadToS3(res.data.uploadUrl, file);
      setContentUrl(res.data.fileUrl);
      setFileLabel(file.name);
      createToast({ status: 'success', title: 'Uploaded' });
    } catch (err) {
      createToast({
        status: 'error',
        title: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    startTransition(async () => {
      const payload = {
        title,
        order,
        duration,
        contentType,
        contentUrl: contentUrl || undefined,
        content: content || undefined,
      };
      if (lesson) {
        const res = await adminUpdateLesson(lesson.id, payload, pathname);
        if (!res.success) return createToast({ status: 'error', title: res.error });
      } else {
        const res = await adminCreateLesson({ moduleId, ...payload }, pathname);
        if (!res.success) return createToast({ status: 'error', title: res.error });
      }
      onDone();
    });
  };

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel>{t('title_')}</FieldLabel>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>{t('order')}</FieldLabel>
          <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </Field>
        <Field>
          <FieldLabel>{t('duration')}</FieldLabel>
          <Input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </Field>
        <Field>
          <FieldLabel>{t('contentType')}</FieldLabel>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as KbsLessonContentType)}
            className="rounded-md border border-input bg-white px-3 py-2 text-sm"
          >
            {CONTENT_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {(contentType === 'VIDEO' || contentType === 'PDF') && (
        <Field>
          <FieldLabel>{t('contentUrl')}</FieldLabel>
          <div className="flex items-center gap-2">
            {contentUrl && (
              <span className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span className="truncate">{fileLabel || contentUrl}</span>
              </span>
            )}
            <label className={cn('cursor-pointer')}>
              <input
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              <span className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-2 text-xs">
                {uploading ? <Spinner className="size-3" /> : <Upload className="size-3.5" />}
                {uploading ? t('uploading') : contentUrl ? 'Remplacer' : t('uploadFile')}
              </span>
            </label>
          </div>
        </Field>
      )}
      {(contentType === 'HTML' || contentType === 'TEXT') && (
        <Field>
          <FieldLabel>{t('content')}</FieldLabel>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="field-sizing-content max-h-[70vh] min-h-40 overflow-y-auto font-mono text-sm"
          />
        </Field>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button size="sm" onClick={save} disabled={pending || !title.trim()}>
          {pending && <Spinner className="size-4" />}
          {t('save')}
        </Button>
      </div>
    </div>
  );
};
