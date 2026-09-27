jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
}));
jest.mock('@/lib/actions/account', () => ({ confirmEmailChange: jest.fn() }));
jest.mock('@/lib/actions/auth', () => ({ logOutToLoginAction: jest.fn() }));

import { render, screen, waitFor } from '@testing-library/react';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { confirmEmailChange } from '@/lib/actions/account';
import ConfirmEmailChange from '@/app/[locale]/(site)/(app)/account/confirm-email-change/page';

let mockQuery = '';

/** I45 - the email-change link leads to a page that confirms with the token it carries. */
describe('I45 - the email-change confirmation page', () => {
  beforeEach(() => {
    setTestLocale('en');
    jest.mocked(confirmEmailChange).mockReset();
  });

  it('confirms with the token from the link, then offers the login page', async () => {
    mockQuery = 'token=abc123';
    jest.mocked(confirmEmailChange).mockResolvedValue({ success: true, data: { message: 'ok' } });
    render(<ConfirmEmailChange />);
    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    expect(confirmEmailChange).toHaveBeenCalledWith('abc123');
    expect(screen.getByRole('heading')).toHaveTextContent('Verification successful');
  });

  it('says the link may have expired when the API refuses it', async () => {
    mockQuery = 'token=used';
    jest
      .mocked(confirmEmailChange)
      .mockResolvedValue({ success: false, error: 'invalid', status: 400 });
    render(<ConfirmEmailChange />);
    await waitFor(() =>
      expect(screen.getByText(/expired or has already been used/)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('refuses without calling the API when the link carries no token', async () => {
    mockQuery = '';
    render(<ConfirmEmailChange />);
    await waitFor(() =>
      expect(screen.getByRole('heading')).toHaveTextContent('Verification failed'),
    );
    expect(confirmEmailChange).not.toHaveBeenCalled();
  });
});
