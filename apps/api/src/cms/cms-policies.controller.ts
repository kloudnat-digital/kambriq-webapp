import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { POLICY_LANGUAGES, POLICY_SLUGS, Public } from '@kambriq/common';
import { PolicyArchiveService } from './policy-archive.service';

/**
 * C41 - the standing of a legal policy, for the page that shows it.
 *
 * Sanity keeps one published version of a document, so a revision published
 * with a future date replaces the one in force on any page that reads Sanity.
 * The archive keeps every revision; this answers which one is in force now and
 * which one comes next, so the site serves the first and announces the second.
 */
@ApiTags('CMS')
@Controller('cms/policies')
export class CmsPoliciesController {
  constructor(private readonly policies: PolicyArchiveService) {}

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':slug/:locale')
  @ApiOperation({
    summary: 'The revision of a legal policy in force now, and the next one',
    description:
      'In force: the most recent revision already published (publishedAt <= now). ' +
      'Upcoming: the earliest revision published with a later date, if any.',
  })
  @ApiResponse({ status: 200, description: 'The standing; either side may be null.' })
  @ApiResponse({
    status: 404,
    description: 'Not a legal policy slug or language the site carries.',
  })
  async standing(@Param('slug') slug: string, @Param('locale') locale: string) {
    if (
      !(POLICY_SLUGS as readonly string[]).includes(slug) ||
      !(POLICY_LANGUAGES as readonly string[]).includes(locale)
    ) {
      throw new NotFoundException();
    }
    const { inForce, upcoming } = await this.policies.inForce(slug, locale);
    return {
      inForce: inForce && {
        revision: inForce.revision,
        publishedAt: inForce.publishedAt.toISOString(),
        rendered: inForce.rendered,
      },
      upcoming: upcoming && {
        revision: upcoming.revision,
        publishedAt: upcoming.publishedAt.toISOString(),
      },
    };
  }
}
