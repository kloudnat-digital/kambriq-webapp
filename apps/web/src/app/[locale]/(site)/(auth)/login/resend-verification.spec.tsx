jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/lib/actions/auth', () => ({
  logInAction: jest.fn(),
  resendVerificationAction: jest.fn(),
}));
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { logInAction, resendVerificationAction } from '@/lib/actions/auth';
import Login from './page';

/**
 * C37 - a client told their address is not verified is offered the link again,
 * where the message appears. The offer follows only a 403, which the API gives
 * only after the password was accepted; any other refusal offers nothing.
 */
describe('C37 - the sign-in screen offers the verification link again', () => {
  const signIn = async () => {
    render(<Login />);
    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/mot de passe|password/i), 'Str0ng!Pass1');
    await userEvent.click(screen.getByRole('button', { name: /connecter|log ?in|sign ?in/i }));
  };

  beforeEach(() => jest.clearAllMocks());

  it('after a 403, offers to resend and sends to the address that was typed', async () => {
    (logInAction as jest.Mock).mockResolvedValue({ success: false, status: 403, error: 'x' });
    (resendVerificationAction as jest.Mock).mockResolvedValue({ success: true });
    await signIn();

    await userEvent.click(
      await screen.findByRole('button', { name: /renvoyer|send the verification/i }),
    );
    expect(resendVerificationAction).toHaveBeenCalledWith('ada@example.com');
    expect(await screen.findByText(/nouveau lien|new link/i)).toBeInTheDocument();
  });

  it('after any other refusal, offers nothing', async () => {
    (logInAction as jest.Mock).mockResolvedValue({ success: false, status: 401, error: 'x' });
    await signIn();
    await screen.findByRole('button', { name: /connecter|log ?in|sign ?in/i });
    expect(screen.queryByRole('button', { name: /renvoyer|send the verification/i })).toBeNull();
  });
});
