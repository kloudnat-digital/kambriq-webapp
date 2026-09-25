import { Injectable, ExecutionContext } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';
import * as path from 'node:path';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../constants/i18n';

@Injectable()
export class UserLanguageResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();

    // Extract from JWT payload.
    if (request.user?.lang) {
      return request.user.lang;
    }

    // Fallback to Accept-Language header.
    const acceptLang = request.headers?.['accept-language'];
    if (acceptLang) {
      const lang = acceptLang.split(',')[0]?.split('-')[0]?.trim().toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
        return lang;
      }
    }

    return undefined; // Fallback to default language.
  }
}

export const getI18nPath = (): string => {
  return path.join(__dirname, 'i18n');
};
