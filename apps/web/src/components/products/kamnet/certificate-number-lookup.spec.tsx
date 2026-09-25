jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));

const push = jest.fn();
// `@/i18n/navigation`, not `next/navigation`: the component navigates through
// the localised router, so a mock of the unwrapped one is never consulted and
// the real `useRouter` dies for want of an intl context.
jest.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { setTestLocale } from '@/test-utils/next-intl-mock';
import { CertificateNumberLookup } from './certificate-number-lookup';

const field = () => screen.getByRole('textbox');
const submit = () => screen.getByRole('button');

/**
 * P11 - the verifier's front door.
 *
 * `/verify-certificate/[certificateNumber]` was a deep link and nothing else: a
 * visitor could only reach a verdict if somebody had already handed them the
 * URL. This field is the entry point for a number read off a card or a message.
 *
 * The negative assertions are the interesting ones again. It must not navigate
 * on an empty value - that would land on `/verify-certificate/` and render
 * nothing anybody can act on - and it must not refuse a number the register
 * might hold. The format has changed once already, so validating shape here
 * would mean rejecting real certificates in the browser; the register is the
 * authority and this is a door, not a gate.
 */
describe('the KCA number lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestLocale('fr');
  });

  it('sends a typed number to the verifier', async () => {
    const user = userEvent.setup();
    render(<CertificateNumberLookup />);

    await user.type(field(), 'KCA-20250101-0001');
    await user.click(submit());

    expect(push).toHaveBeenCalledWith('/verify-certificate/KCA-20250101-0001');
  });

  it('trims what was pasted, because a copied number carries whitespace', async () => {
    const user = userEvent.setup();
    render(<CertificateNumberLookup />);

    await user.type(field(), '  KCA-20250101-0002  ');
    await user.click(submit());

    expect(push).toHaveBeenCalledWith('/verify-certificate/KCA-20250101-0002');
  });

  it('encodes the number rather than pasting it into a path', async () => {
    const user = userEvent.setup();
    render(<CertificateNumberLookup />);

    await user.type(field(), 'KCA/../../admin');
    await user.click(submit());

    expect(push).toHaveBeenCalledWith('/verify-certificate/KCA%2F..%2F..%2Fadmin');
  });

  it('does not navigate on an empty field, and says what it wants', async () => {
    const user = userEvent.setup();
    render(<CertificateNumberLookup />);

    await user.click(submit());

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears the complaint as soon as something is typed', async () => {
    const user = userEvent.setup();
    render(<CertificateNumberLookup />);

    await user.click(submit());
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.type(field(), 'K');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute('aria-invalid');
  });

  /**
   * A number the register may or may not hold is still sent. Refusing it here
   * would be the browser overruling the authority, and `verifyCertificate`
   * answers UNKNOWN for exactly this case.
   */
  it('does not refuse a number that does not look like today format', async () => {
    const user = userEvent.setup();
    render(<CertificateNumberLookup />);

    await user.type(field(), 'KCA-OLD-FORMAT-42');
    await user.click(submit());

    expect(push).toHaveBeenCalledWith('/verify-certificate/KCA-OLD-FORMAT-42');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
