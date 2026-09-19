jest.mock('@/lib/actions/kbs', () => ({ getExamResults: jest.fn() }));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
jest.mock('next/navigation', () => ({
  notFound: () => notFound(),
  useRouter: () => ({ refresh: jest.fn() }),
}));

import { render, screen } from '@testing-library/react';
import { getExamResults } from '@/lib/actions/kbs';
import KbsExamResultsPage from './page';

/**
 * I40 - the seconds after submitting an exam.
 *
 * `submitExam` enqueues grading and the session pushes straight to this page,
 * so the exam is briefly SUBMITTED with no score. The page called `notFound()`
 * on the API's refusal, which showed a **404** to somebody who had just sat
 * their certification exam. I walked into it myself on dev.
 *
 * What this file proves is the PAGE's branch, so mocking the action is the
 * right instrument rather than a hole: the service half - that a SUBMITTED exam
 * is reported instead of refused - is proved against the service in
 * `exam-results-pending.spec.ts`. Neither file can stand for the other.
 */
const results = getExamResults as jest.MockedFunction<typeof getExamResults>;

const renderPage = async (examId = 'e1') =>
  render(await KbsExamResultsPage({ params: Promise.resolve({ examId }) }));

const graded = {
  examId: 'e1',
  status: 'PASSED',
  score: 100,
  passingScore: 80,
  passed: true,
  correctCount: 20,
  totalQuestions: 20,
  breakdown: [],
  answers: [],
};

describe('the exam results page while grading is still running', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits, and says it is grading, rather than answering not-found', async () => {
    results.mockResolvedValue({
      success: true,
      data: { ...graded, status: 'SUBMITTED', score: null, passed: false },
    } as never);

    await renderPage();

    expect(screen.getByText('gradingTitle')).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  /**
   * The other side of the branch. Without this, making the page render the
   * waiting state unconditionally would still pass the test above - the mutation
   * that matters is the one that stops the verdict ever appearing.
   */
  it('shows the verdict once grading has finished', async () => {
    results.mockResolvedValue({ success: true, data: graded } as never);

    await renderPage();

    expect(screen.queryByText('gradingTitle')).not.toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  /** A missing exam is still a 404. That line was never the defect. */
  it('still answers not-found for an exam that is not there', async () => {
    results.mockResolvedValue({ success: false, error: 'nope' } as never);

    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
