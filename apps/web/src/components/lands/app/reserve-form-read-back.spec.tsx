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

// Fiche 006: 2 750 m2 at 22 000 000, all of it still for sale.
const SALE_006 = { totalPrice: 22_000_000, sizeM2: 2_750, remainingM2: 2_750 };

const renderForm = () =>
  render(
    <ReserveForm
      landId="land-1"
      sale={SALE_006}
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

/**
 * C49 - the agent states the surface the client buys; the form prices it as the
 * API does, pro rata of the parcel's total, and reads it back with the address.
 */
describe('C49 - a portion is priced and read back before it is sent', () => {
  const surface = () => screen.getByLabelText('Surface achetée (m²)');

  it('prices 400 m2 of 006 at 3 200 000 with a 160 000 deposit, and sends 400', async () => {
    renderForm();
    fireEvent.change(surface(), { target: { value: '400' } });
    expect(screen.getByDisplayValue(/3\s?200\s?000/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/160\s?000/)).toBeInTheDocument();
    fill('ada@example.com', 'ada@example.com');
    const panel = await screen.findByTestId('read-back');
    expect(panel.textContent?.replace(/\s/g, '')).toContain('400m²pour3200000');
    fireEvent.click(screen.getByRole('button', { name: 'Le client confirme, envoyer' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({ purchasedM2: 400 });
  });

  it('refuses a surface larger than what is left, and sends nothing', async () => {
    renderForm();
    fireEvent.change(surface(), { target: { value: '3000' } });
    expect(
      screen.getByText('Indiquez une surface supérieure à 0 et au plus 2750 m².'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmer la réservation' })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
  });
});
