jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));

import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import {
  CREATE_LAND_DEFAULTS,
  CreateLandFormResolver,
  type CreateLandFormSchema,
} from '@/validations/schema/lands';
import { LandClassificationFields } from '.';

/**
 * P24 - a refused title number is refused where the person can read why.
 *
 * Until now the field rendered no error at all, which cost nothing while
 * nothing was refused. With a rule, a silent field is a button that does
 * nothing: the refusal must say the expected shape, with an example, under the
 * field, in the person's language.
 */
const Harness = () => {
  const { control, handleSubmit } = useForm<CreateLandFormSchema>({
    resolver: zodResolver(CreateLandFormResolver),
    defaultValues: CREATE_LAND_DEFAULTS,
  });
  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <LandClassificationFields
        control={control}
        labels={[]}
        fields={{
          labelId: { name: 'labelId', label: 'Label' },
          ownerType: { name: 'ownerType', label: 'Owner' },
          titleNumber: { name: 'titleNumber', label: 'Titre foncier' },
        }}
      />
      <button type="submit">Envoyer</button>
    </form>
  );
};

describe.each([
  ['fr', /s'écrit TF.*par exemple TF 4129\/M\./],
  ['en', /is written TF.*for example TF 4129\/M\./],
] as const)('P24 - the title number field (%s)', (locale, expected) => {
  beforeEach(() => setTestLocale(locale));

  it('says the expected shape, with an example, under a refused title', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Titre foncier');
    await user.type(input, 'TF-12345-ABCD');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(expected);
  });

  it('says nothing under a well-formed title', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Titre foncier'), 'tf 4129 / m');
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(screen.queryByText(expected)).not.toBeInTheDocument();
  });
});
