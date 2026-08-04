'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useToastStore } from '@/store/toast.store';
import {
  adminCreateExamQuestion,
  adminCreateQuestion,
  adminDeleteExamQuestion,
  adminDeleteQuestion,
  adminGetQuizQuestions,
  adminListExamQuestions,
  adminUpdateExamQuestion,
  adminUpdateQuestion,
} from '@/lib/actions/kbs';
import type { AdminCourseDetail, AdminQuestion, KbsQuestionType } from '@/types/kbs';

interface Props {
  course: AdminCourseDetail | null;
  initialExamQuestions: AdminQuestion[];
}

export const QuestionBanksContent = ({ course, initialExamQuestions }: Props) => {
  const t = useTranslations('app.adminKbs.questions');
  const [tab, setTab] = useState<'quiz' | 'exam'>('quiz');

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === 'quiz'} onClick={() => setTab('quiz')}>
          {t('quizTitle')}
        </TabBtn>
        <TabBtn active={tab === 'exam'} onClick={() => setTab('exam')}>
          {t('examTitle')}
        </TabBtn>
      </div>
      {tab === 'quiz' && <QuizBank course={course} />}
      {tab === 'exam' && <ExamBank course={course} initialQuestions={initialExamQuestions} />}
    </div>
  );
};

const TabBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`border-b-2 px-3 py-2 text-sm font-medium ${
      active ? 'border-primary text-primary' : 'border-transparent text-gray-500'
    }`}
  >
    {children}
  </button>
);

// ------------- Quiz bank -------------

const QuizBank = ({ course }: { course: AdminCourseDetail | null }) => {
  const t = useTranslations('app.adminKbs.questions');
  const { createToast } = useToastStore();
  const modules = course?.modules ?? [];
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? '');
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async (id: string) => {
    if (!id) return;
    setLoading(true);
    const res = await adminGetQuizQuestions(id);
    setLoading(false);
    if (!res.success) {
      createToast({ status: 'error', title: res.error });
      return;
    }
    setQuestions(res.data);
  };

  useEffect(() => {
    if (moduleId) load(moduleId);
  }, [moduleId]);

  if (!course) {
    return <p className="text-sm text-gray-500">{t('empty')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm"
        >
          <option value="">{t('selectModule')}</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.order}. {m.title}
            </option>
          ))}
        </select>
        {moduleId && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t('addQuestion')}
          </Button>
        )}
      </div>

      {creating && moduleId && (
        <QuestionForm
          initial={null}
          moduleId={moduleId}
          onCancel={() => setCreating(false)}
          onSave={async (payload) => {
            const res = await adminCreateQuestion({ ...payload, moduleId });
            if (!res.success) return createToast({ status: 'error', title: res.error });
            setCreating(false);
            await load(moduleId);
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-gray-500">…</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <Card key={q.id}>
              <CardContent className="space-y-2 py-3">
                {editing?.id === q.id ? (
                  <QuestionForm
                    initial={q}
                    moduleId={moduleId}
                    onCancel={() => setEditing(null)}
                    onSave={async (payload) => {
                      const res = await adminUpdateQuestion(q.id, payload);
                      if (!res.success) return createToast({ status: 'error', title: res.error });
                      setEditing(null);
                      await load(moduleId);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900">{q.text}</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(q)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!confirm('Delete question?')) return;
                            const res = await adminDeleteQuestion(q.id);
                            if (!res.success)
                              return createToast({ status: 'error', title: res.error });
                            await load(moduleId);
                          }}
                        >
                          <Trash2 className="size-3.5 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <ul className="space-y-1 text-xs">
                      {q.answers.map((a) => (
                        <li
                          key={a.id}
                          className={a.isCorrect ? 'text-emerald-700' : 'text-gray-600'}
                        >
                          {a.isCorrect ? '✓' : '·'} {a.text}
                        </li>
                      ))}
                    </ul>
                    <span className="text-xs tracking-wide text-gray-400 uppercase">{q.type}</span>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ------------- Exam pool -------------

const ExamBank = ({
  course,
  initialQuestions,
}: {
  course: AdminCourseDetail | null;
  initialQuestions: AdminQuestion[];
}) => {
  const t = useTranslations('app.adminKbs.questions');
  const { createToast } = useToastStore();
  const [questions, setQuestions] = useState<AdminQuestion[]>(initialQuestions);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [creating, setCreating] = useState(false);
  const modules = course?.modules ?? [];

  const refresh = async () => {
    const res = await adminListExamQuestions();
    if (res.success) setQuestions(res.data);
  };

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setCreating(true)}
        disabled={modules.length === 0}
      >
        <Plus className="size-4" /> {t('addQuestion')}
      </Button>

      {creating && (
        <QuestionForm
          initial={null}
          moduleId={modules[0]?.id ?? ''}
          moduleOptions={modules.map((m) => ({ id: m.id, label: `${m.order}. ${m.title}` }))}
          onCancel={() => setCreating(false)}
          onSave={async (payload) => {
            const res = await adminCreateExamQuestion(payload);
            if (!res.success) return createToast({ status: 'error', title: res.error });
            setCreating(false);
            await refresh();
          }}
        />
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <Card key={q.id}>
              <CardContent className="space-y-2 py-3">
                {editing?.id === q.id ? (
                  <QuestionForm
                    initial={q}
                    moduleId={q.moduleId}
                    moduleOptions={modules.map((m) => ({
                      id: m.id,
                      label: `${m.order}. ${m.title}`,
                    }))}
                    onCancel={() => setEditing(null)}
                    onSave={async (payload) => {
                      const res = await adminUpdateExamQuestion(q.id, payload);
                      if (!res.success) return createToast({ status: 'error', title: res.error });
                      setEditing(null);
                      await refresh();
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900">{q.text}</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(q)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!confirm('Delete question?')) return;
                            const res = await adminDeleteExamQuestion(q.id);
                            if (!res.success)
                              return createToast({ status: 'error', title: res.error });
                            await refresh();
                          }}
                        >
                          <Trash2 className="size-3.5 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <ul className="space-y-1 text-xs">
                      {q.answers.map((a) => (
                        <li
                          key={a.id}
                          className={a.isCorrect ? 'text-emerald-700' : 'text-gray-600'}
                        >
                          {a.isCorrect ? '✓' : '·'} {a.text}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ------------- Shared question form -------------

type Payload = {
  text: string;
  type: KbsQuestionType;
  moduleId: string;
  answers: Array<{ id?: string; text: string; isCorrect: boolean }>;
};

const QuestionForm = ({
  initial,
  moduleId,
  moduleOptions,
  onCancel,
  onSave,
}: {
  initial: AdminQuestion | null;
  moduleId: string;
  moduleOptions?: Array<{ id: string; label: string }>;
  onCancel: () => void;
  onSave: (payload: Payload) => Promise<unknown>;
}) => {
  const t = useTranslations('app.adminKbs.questions');
  const [text, setText] = useState(initial?.text ?? '');
  const [type, setType] = useState<KbsQuestionType>(initial?.type ?? 'SINGLE');
  const [modId, setModId] = useState(initial?.moduleId ?? moduleId);
  const [answers, setAnswers] = useState<Array<{ id?: string; text: string; isCorrect: boolean }>>(
    initial?.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })) ?? [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
    ],
  );
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const cleanAnswers = answers.filter((a) => a.text.trim() !== '');
      const payload: Payload = {
        text,
        type,
        answers: cleanAnswers,
        moduleId: moduleOptions ? modId : moduleId,
      };
      await onSave(payload);
    });
  };

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      {moduleOptions && (
        <Field>
          <FieldLabel>Module</FieldLabel>
          <select
            value={modId}
            onChange={(e) => setModId(e.target.value)}
            className="rounded-md border border-input bg-white px-3 py-2 text-sm"
          >
            {moduleOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field>
        <FieldLabel>{t('text')}</FieldLabel>
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel>{t('type')}</FieldLabel>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-1 text-sm">
            <input type="radio" checked={type === 'SINGLE'} onChange={() => setType('SINGLE')} />
            {t('typeSingle')}
          </label>
          <label className="inline-flex items-center gap-1 text-sm">
            <input
              type="radio"
              checked={type === 'MULTIPLE'}
              onChange={() => setType('MULTIPLE')}
            />
            {t('typeMultiple')}
          </label>
        </div>
      </Field>
      <div>
        <p className="mb-1 text-xs font-medium text-gray-700">{t('answers')}</p>
        <div className="space-y-2">
          {answers.map((a, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Checkbox
                checked={a.isCorrect}
                onCheckedChange={(v) => {
                  setAnswers((prev) =>
                    prev.map((x, i) =>
                      i === idx
                        ? { ...x, isCorrect: v === true }
                        : type === 'SINGLE'
                          ? { ...x, isCorrect: false }
                          : x,
                    ),
                  );
                }}
              />
              <Input
                value={a.text}
                onChange={(e) =>
                  setAnswers((prev) =>
                    prev.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)),
                  )
                }
                placeholder={t('answerText')}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnswers((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Trash2 className="size-3.5 text-red-600" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAnswers((prev) => [...prev, { text: '', isCorrect: false }])}
          className="mt-1"
        >
          <Plus className="size-3.5" /> {t('addAnswer')}
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button size="sm" onClick={submit} disabled={pending || !text.trim()}>
          {pending && <Spinner className="size-4" />}
          {t('save')}
        </Button>
      </div>
    </div>
  );
};
