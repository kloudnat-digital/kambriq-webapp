jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/lib/actions/lands', () => ({
  createReservationAction: jest.fn(async () => ({ success: true })),
  cancelReservationAction: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createReservationAction } from '@/lib/actions/lands';
import { ReserveForm } from './reserve-form';

const create = createReservationAction as jest.Mock;

const renderForm = () =>
  render(
    <ReserveForm
      landId="land-1"
      deposit={100000}
      currentUserId="agent-1"
      isAdmin={false}
      canManageReservations
    />,
  );

const fill = (email: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText('Nom complet'), { target: { value: 'Ada Client' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Confirmer l'email"), { target: { value: confirm } });
  fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '+237600000029' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer la réservation' }));
};

beforeEach(() => create.mockClear());

/**
 * C29 - the address an agent types receives the set-password link to an account
 * holding a reservation, so it is typed twice and read back to the client before
 * the invitation goes.
 */
describe('C29 - the agent confirms the client address before the invitation goes', () => {
  it('refuses two addresses that differ, and sends nothing', async () => {
    renderForm();
    fill('ada@example.com', 'ada@exampel.com');
    expect(
      await screen.findByText('Les deux adresses ne sont pas identiques.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('read-back')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('reads a matching address back before anything is sent', async () => {
    renderForm();
    fill('ada@example.com', 'ADA@example.com ');
    const panel = await screen.findByTestId('read-back');
    expect(panel).toHaveTextContent('ada@example.com');
    expect(panel).toHaveTextContent("Relisez l'adresse au client");
    expect(create).not.toHaveBeenCalled();
  });

  it('sends only once the agent confirms the read-back', async () => {
    renderForm();
    fill('ada@example.com', 'ada@example.com');
    fireEvent.click(await screen.findByRole('button', { name: 'Le client confirme, envoyer' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ clientEmail: 'ada@example.com' }),
    );
  });

  it('goes back to the form to correct the address, and sends nothing', async () => {
    renderForm();
    fill('ada@example.com', 'ada@example.com');
    fireEvent.click(await screen.findByRole('button', { name: "Corriger l'adresse" }));
    expect(screen.queryByTestId('read-back')).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmer la réservation' })).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not let the confirmation be pasted', () => {
    renderForm();
    const confirm = screen.getByLabelText("Confirmer l'email");
    const pasted = fireEvent.paste(confirm, {
      clipboardData: { getData: () => 'ada@example.com' },
    });
    expect(pasted).toBe(false);
  });
});
