import { NewsletterController } from '../../newsletter/newsletter.controller';
import type { NewsletterService } from '../../newsletter/newsletter.service';
import type { SubscribeNewsletterDto } from '../../newsletter/newsletter.dto';

/**
 * P2 - the seam between the DTO and the service.
 *
 * The controller rebuilds the service's input by hand, and a field copied by
 * hand is a field that can go missing between two green suites (the A17
 * lesson). This pins every field of that call, including the policy path the
 * consent text pointed at, which the browser does not send.
 */
describe('NewsletterController.subscribe', () => {
  it('passes the consent, the locale and the privacy policy path to the service', async () => {
    const subscribe = jest.fn().mockResolvedValue(undefined);
    const controller = new NewsletterController({ subscribe } as unknown as NewsletterService);

    await controller.subscribe({
      email: 'reader@example.test',
      locale: 'en',
      consent: true,
    } as SubscribeNewsletterDto);

    expect(subscribe).toHaveBeenCalledWith({
      email: 'reader@example.test',
      locale: 'en',
      consent: true,
      consentPolicyPath: '/legal/privacy',
    });
  });
});
