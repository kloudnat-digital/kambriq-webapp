# ADR-007: API i18n Strategy — nestjs-i18n with Per-User Language Resolution

Date: 2026-04-18
Status: Accepted
Deciders: Kambriq Engineering Team

---

## Context and Problem Statement

The Kambriq API (NestJS) returns user-facing strings in exception messages, success responses, and email notifications. These strings must be bilingual (French and English) because the platform serves users across France, Belgium, Canada, and Cameroon with different language preferences.

Without a structured approach, developers tend to hardcode string literals in service methods (e.g. `throw new BadRequestException('Invalid credentials')`), which:

- Returns strings in a single language regardless of the user's preference
- Makes content impossible to audit or update without touching business logic
- Creates inconsistency (some strings in French, some in English, some mixed)

---

## Decision Drivers

- **Per-user language**: Each user stores a `preferredLanguage` field (`'fr'` or `'en'`) set at registration. Error messages and emails must be in that language.
- **No hardcoded string literals**: All user-facing strings must go through a translation lookup.
- **Consistent fallback**: When user language is unknown (unauthenticated endpoints, internal admin calls), use a single defined default rather than individual developer guesses.
- **Monorepo sharing**: Translation files are consumed by both API services and the email template system. They must live in a shared library, not inside any single app.
- **Minimal overhead**: The solution must not add per-request network calls or external dependencies.

---

## Considered Options

1. **nestjs-i18n with shared translation JSON files** ← chosen
2. Return error codes only — let the frontend translate
3. Custom translation service with in-memory maps
4. Hardcode French (primary market language) everywhere

---

## Decision Outcome

**Chosen option: `nestjs-i18n` with shared JSON files in `libs/common/src/i18n/`.**

`nestjs-i18n` integrates natively with NestJS's dependency injection system, supports file watching in development, and requires no external service. Translation files live in the shared `@kambriq/common` library so they are accessible to all API modules and to the email service.

---

## Implementation

### Translation File Location

```
libs/common/src/i18n/
  en/
    auth.json
    kbs.json
    lands.json
    user.json
    kamnet.json
    email.json
  fr/
    auth.json
    kbs.json
    lands.json
    user.json
    kamnet.json
    email.json
```

Each JSON file is namespaced by domain. Keys use dot notation to group related messages:

```json
// fr/auth.json
{
  "login": {
    "invalidCredentials": "Email ou mot de passe invalide",
    "accountLocked": "Compte verrouillé. Réessayez dans {minutes} minute(s)."
  },
  "token": {
    "invalidRefresh": "Token de rafraîchissement invalide ou expiré",
    "missingRefresh": "Token de rafraîchissement absent",
    "accountInactive": "Le compte est inactif"
  }
}
```

Interpolation uses `{paramName}` syntax. The key `auth.login.accountLocked` with args `{ minutes: 15 }` resolves to `"Compte verrouillé. Réessayez dans 15 minute(s)."`.

### Module Setup

`nestjs-i18n` is configured in `apps/api/src/app/app.module.ts`:

```ts
I18nModule.forRoot({
  fallbackLanguage: DEFAULT_LANGUAGE,
  loaderOptions: {
    path: path.join(process.cwd(), 'libs/common/src/i18n'),
    watch: true, // hot-reload in development
  },
  resolvers: [new HeaderResolver(['x-lang']), UserLanguageResolver, AcceptLanguageResolver],
});
```

### `DEFAULT_LANGUAGE` Constant

A single constant defines the fallback language for the entire API:

```ts
// libs/common/src/constants/i18n/index.ts
export const DEFAULT_LANGUAGE = 'fr';
```

It is exported from `@kambriq/common` and imported wherever a language value is needed but no user context is available. **No service should hardcode the string `'fr'` or `'en'` as a fallback** — always import and reference `DEFAULT_LANGUAGE` instead. This ensures a single change point if the default ever shifts.

### Language Resolution Chain

When a request arrives, `nestjs-i18n` resolves the language through the following priority chain:

| Priority | Resolver                 | Source                                                                       |
| -------- | ------------------------ | ---------------------------------------------------------------------------- |
| 1        | `UserLanguageResolver`   | `user.lang` claim from the decoded JWT (set by `JwtStrategy`)                |
| 2        | `HeaderResolver`         | `x-lang` request header (used by server-to-server calls, e.g. Next.js → API) |
| 3        | `AcceptLanguageResolver` | `Accept-Language` HTTP header                                                |
| 4        | Fallback                 | `DEFAULT_LANGUAGE` (`'fr'`)                                                  |

For authenticated endpoints, the JWT claim is always present and takes priority. The `x-lang` header allows the Next.js web app to forward the active UI locale on server-to-server calls without requiring authentication.

### `private t()` Helper in Services

Every service that needs to translate strings injects `I18nService` and defines a private `t()` helper:

```ts
@Injectable()
export class ExampleService {
  constructor(private readonly i18n: I18nService) {}

  private t(key: string, lang = DEFAULT_LANGUAGE, args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
```

Usage in a method:

```ts
// With user's language
const lang = user.preferredLanguage || DEFAULT_LANGUAGE;
throw new BadRequestException(this.t('auth.login.invalidCredentials', lang));

// With interpolation
throw new BadRequestException(this.t('auth.login.accountLocked', lang, { minutes: minutesLeft }));

// When no user context is available (unauthenticated, admin-internal)
throw new BadRequestException(this.t('auth.token.missingRefresh', DEFAULT_LANGUAGE));
```

The `lang` parameter defaults to `DEFAULT_LANGUAGE` so call sites without a user context can omit it. However, when a user object is available, always pass `user.preferredLanguage || DEFAULT_LANGUAGE` explicitly.

### Language Source by Scenario

| Scenario                                         | Language source                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| User-facing error on authenticated endpoint      | `user.preferredLanguage \|\| DEFAULT_LANGUAGE`                       |
| Error before user is loaded (auth flow)          | `DEFAULT_LANGUAGE`                                                   |
| Email notification to a user                     | `user.language \|\| DEFAULT_LANGUAGE` (fetched from the user record) |
| Admin-triggered operation (no recipient context) | `DEFAULT_LANGUAGE`                                                   |
| `x-lang` header from Next.js web app             | Handled automatically by the resolver chain                          |

### Email Notifications

The `EmailService.send()` call accepts a `lang` parameter that selects the correct email template locale:

```ts
await this.emailService.send({
  to: user.email,
  template: 'certificateIssued',
  lang: user.language || DEFAULT_LANGUAGE,
  args: { firstName: user.firstName, kcaNumber },
});
```

Email templates live in `libs/common/src/i18n/en/email.json` and `fr/email.json` alongside the API message files, keeping all bilingual strings in one location.

---

## Consequences

### Positive

- **Zero hardcoded strings**: All user-facing text goes through `this.t()`, making the full string inventory auditable by reading the JSON files.
- **Single fallback point**: `DEFAULT_LANGUAGE` imported from `@kambriq/common` is the only place to change the API default language — no grep-and-replace required.
- **Per-user language at the right layer**: Language is resolved from the user record inside the service, not from an HTTP header, ensuring correctness even for background jobs and queue consumers.
- **Shared with email**: Translation JSON files are used by both the HTTP response path and the email system with no duplication.
- **Hot reload in development**: `watch: true` in the i18n module means translation file changes are reflected without restarting the API server.

### Negative / Trade-offs

- **`private t()` boilerplate**: Every service that emits user-facing strings must define the same private helper and inject `I18nService`. This is repetitive but intentional — it keeps the translation call explicit and makes it easy to grep for all translation sites.
- **Admin operations default to French**: When an admin triggers an operation and no user language is available, `DEFAULT_LANGUAGE` (`'fr'`) is used. Admin-facing messages are therefore always in French unless the admin's own language is threaded through the call.
- **No pluralization**: `nestjs-i18n` supports ICU message format for pluralization, but the current translation files use simple `{param}` interpolation only. If pluralization is needed, the message format and all call sites would need updating.

---

## Rejected Options

### Return error codes only — let the frontend translate

Technically clean but impractical: the API is also consumed directly by mobile clients, third-party integrations, and Postman during development. Returning only machine-readable codes with no human message makes debugging significantly harder without a corresponding lookup table in every consumer.

### Custom translation service with in-memory maps

Building a custom service avoids a dependency but duplicates functionality that `nestjs-i18n` provides: file loading, hot reload, interpolation, fallback chaining, and resolver integration. Not justified given the small surface area.

### Hardcode French everywhere

Acceptable for an MVP targeting only the Francophone market, but the platform explicitly serves English-speaking users (Canada, international). A retroactive migration from hardcoded strings to i18n is more disruptive than establishing the pattern upfront.
