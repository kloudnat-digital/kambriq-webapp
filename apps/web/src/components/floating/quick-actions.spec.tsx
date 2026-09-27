jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/lib/actions/account', () => ({ followLanguage: jest.fn() }));
const replace = jest.fn();
const push = jest.fn();
jest.mock('@/i18n/navigation', () => ({
  usePathname: () => '/contact',
  useRouter: () => ({ replace, push }),
}));

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { followLanguage } from '@/lib/actions/account';
import { useToastStore } from '@/store/toast.store';
import { TooltipProvider } from '@/components/ui/tooltip';
import QuickActions from './quick-actions';

const follow = followLanguage as jest.Mock;

/** The switch, then the page it lands on - the notice is read there, in the new language. */
const switchToEnglish = async () => {
  const view = render(
    <TooltipProvider>
      <QuickActions />
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Changer de langue' }));
  await waitFor(() => expect(replace).toHaveBeenCalled());
  setTestLocale('en');
  view.rerender(
    <TooltipProvider>
      <QuickActions />
    </TooltipProvider>,
  );
  await act(() => Promise.resolve());
};

const toasts = () => useToastStore.getState().toasts;

/**
 * J4, second half. Visquis, 26 September: someone who switches does not tell
 * the page from their account - they switched to English, they expect
 * English, emails included. So the switch writes a signed-in person's account
 * language, and says so where it lands, with the way back.
 */
describe('J4 - the language switcher', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    sessionStorage.clear();
    useToastStore.setState({ toasts: [] });
    setTestLocale('fr');
  });

  it('the page follows, for everybody', async () => {
    follow.mockResolvedValue({ success: true, data: 'visitor' });
    await switchToEnglish();
    expect(replace).toHaveBeenCalledWith('/contact', { locale: 'en' });
  });

  it('asks the account to follow, with the language switched to', async () => {
    follow.mockResolvedValue({ success: true, data: 'visitor' });
    await switchToEnglish();
    expect(follow).toHaveBeenCalledWith('en');
  });

  it('a visitor is told nothing: only their view changed', async () => {
    follow.mockResolvedValue({ success: true, data: 'visitor' });
    await switchToEnglish();
    expect(toasts()).toEqual([]);
  });

  it('a signed-in person is told, in the new language, with the way back', async () => {
    follow.mockResolvedValue({ success: true, data: 'saved' });
    await switchToEnglish();
    expect(toasts()).toMatchObject([
      {
        status: 'success',
        title: 'Your account is now in English',
        description:
          'Our emails to you will be in English too. You can change this in your profile.',
        action: { label: 'My profile' },
      },
    ]);
    (toasts()[0].action as unknown as { onClick: () => void }).onClick();
    expect(push).toHaveBeenCalledWith('/account');
  });

  it('an account that already had the language is not announced', async () => {
    follow.mockResolvedValue({ success: true, data: 'unchanged' });
    await switchToEnglish();
    expect(toasts()).toEqual([]);
  });

  it('a write that failed is said, never passed over', async () => {
    follow.mockResolvedValue({ success: false, error: 'down', status: 400 });
    await switchToEnglish();
    expect(toasts()).toMatchObject([
      { status: 'warning', title: 'Your account language was not changed' },
    ]);
    expect(replace).toHaveBeenCalledWith('/contact', { locale: 'en' });
  });
});

/**
 * Every switch goes through the hook that carries the account with it, bar
 * the profile's own control, which writes the account directly. A new
 * switcher that navigates on its own would change the page and silently not
 * the emails.
 */
describe('J4 - no switcher leaves the account behind', () => {
  const SRC = join(__dirname, '..', '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );

  it('only the hook and the profile card switch the locale', () => {
    const switching = walk(SRC)
      .filter((f) => /\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f))
      .filter((f) => /\{\s*locale:\s*\w+\s*\}\s*\)/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
      .sort();
    expect(switching).toEqual([
      'components/account/account-preferences-card.tsx',
      'hooks/use-switch-language.ts',
    ]);
  });
});
