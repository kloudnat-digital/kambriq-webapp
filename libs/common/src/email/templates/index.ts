/**
 * KAMBRIQ Email Templates
 * Each function returns { subject, html }
 *
 * Bodies are built with the `html` tag, which escapes every interpolated value
 * that is not already `SafeHtml`. A plain template literal here would emit its
 * arguments as markup, which is how the contact form came to inject a live
 * anchor into the mail that lands in `contact@`.
 */

import { I18nService } from 'nestjs-i18n';

import { escapeHtml, html, preservedTextBlock, SafeHtml, safeUrl, trustedMarkup } from '../html';

type TemplateArgs = Record<string, string | number>;

/** Escapes every argument before the catalogue interpolates it into its own markup. */
const escapeArgs = (args?: TemplateArgs): TemplateArgs | undefined =>
  args && Object.fromEntries(Object.entries(args).map(([k, v]) => [k, escapeHtml(v).toString()]));

/**
 * Translates for an HTML context.
 *
 * The catalogue carries markup of its own - `Raison : <strong>{reason}</strong>` -
 * so its text is trusted while the arguments interpolated into it are not.
 */
const t = (i18n: I18nService, key: string, lang: string, args?: TemplateArgs): SafeHtml =>
  trustedMarkup(
    i18n.translate(key, { lang, args: escapeArgs(args) }),
    'the catalogue is authored in this repository and its arguments are escaped above',
  );

/** Translates for a subject line, which is plain text and is never parsed as markup. */
const subjectText = (i18n: I18nService, key: string, lang: string, args?: TemplateArgs): string =>
  i18n.translate(key, { lang, args });

/** Shared HTML Layout */
const layout = (content: SafeHtml, lang: string, i18n: I18nService): SafeHtml => {
  const year = new Date().getFullYear();
  return html`<!DOCTYPE html>
    <html lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #f4f7fa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .card {
            background: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }
          .logo {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a2e;
            letter-spacing: -0.5px;
            margin-bottom: 32px;
          }
          .logo span {
            color: #e94560;
          }
          h1 {
            font-size: 22px;
            color: #1a1a2e;
            margin: 0 0 16px;
          }
          p {
            font-size: 15px;
            line-height: 1.6;
            color: #4a5568;
            margin: 0 0 16px;
          }
          .btn {
            display: inline-block;
            padding: 14px 32px;
            background: #1a1a2e;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            margin: 8px 0 24px;
          }
          .code {
            display: inline-block;
            padding: 12px 24px;
            background: #f0f4f8;
            border-radius: 8px;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 4px;
            color: #1a1a2e;
            font-family: monospace;
            margin: 8px 0 24px;
          }
          .footer {
            text-align: center;
            padding-top: 32px;
            font-size: 13px;
            color: #a0aec0;
          }
          .muted {
            font-size: 13px;
            color: #a0aec0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">KAMBRI<span>Q</span></div>
            ${content}
          </div>
          <div class="footer">
            <p>${t(i18n, 'email.footer.copyright', lang, { year })}</p>
            <p>${t(i18n, 'email.footer.ignore', lang)}</p>
          </div>
        </div>
      </body>
    </html>`;
};

// ----- Template builders -----

type TemplateFn = (
  i18n: I18nService,
  lang: string,
  args: TemplateArgs,
) => { subject: string; html: SafeHtml };

/**
 * The reference, set out to survive being copied by hand.
 *
 * Monospaced, large, on its own line, with the rule stated underneath. This is
 * the single most important thing in the message: money that arrives without it
 * cannot be matched to a payment, and the person making the transfer is the only
 * one who can put it there.
 */
const referenceBlock = (i18n: I18nService, lang: string, args: TemplateArgs): SafeHtml => html`
  <p class="muted" style="margin-bottom:4px;">
    ${t(i18n, 'email.paymentInstructions.referenceLabel', lang)}
  </p>
  <p
    style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:24px;font-weight:700;
            letter-spacing:2px;margin:0 0 8px;word-break:break-all;"
  >
    ${args['reference']}
  </p>
  <p class="muted" style="margin-top:0;">
    ${t(i18n, 'email.paymentInstructions.referenceRule', lang)}
  </p>
`;

/**
 * There is no channel block, and that is the point.
 *
 * v03 section 4d: *"Les coordonnees s'affichent sur l'espace du client, derriere
 * son authentification ; l'email n'est qu'une notification qui dit qu'elles sont
 * disponibles et ne les contient pas."*
 *
 * Until 7 September this file had a `channelBlock` that rendered the bank
 * account, the mobile money number and the notary's address into every
 * instruction **and** every reminder - to anyone who clicked. It is deleted
 * rather than left unused, because an unused renderer of bank details is one
 * import away from being used again. `no-coordinates-in-email.spec.ts` fails if
 * any channel detail can reach an outbound body.
 */

const defineTemplates = <T extends Record<string, TemplateFn>>(t: T) => t;
const templates = defineTemplates({
  verification: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.verification.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.verification.heading', lang, args)}</h1>
        <p>${t(i18n, 'email.verification.body', lang)}</p>
        <a href="${safeUrl(args['verificationUrl'])}" class="btn"
          >${t(i18n, 'email.verification.button', lang)}</a
        >
        <p class="muted">${t(i18n, 'email.verification.expiry', lang)}</p>
        <p class="muted" style="word-break:break-all;">${args['verificationUrl']}</p>
      `,
      lang,
      i18n,
    ),
  }),

  /**
   * G3 - the payment instruction.
   *
   * Written for the person who will read it, not for the person who wrote it.
   * The client is in the diaspora, the money has to arrive in Cameroon, and
   * they will forward this to whoever makes the transfer for them. So: no
   * links to click, no login required, nothing that only makes sense to
   * somebody who was in the conversation. Everything needed to pay is in the
   * body.
   *
   * The reference is repeated in a monospaced block on its own line, large,
   * because it will be copied by hand onto a transfer slip. The rule about the
   * motif is stated as a rule, not as a hint: a payment without the reference
   * cannot be matched, and the client is the only person who can prevent that.
   */
  /**
   * "Your payment details are ready" - and not what they are.
   *
   * Carries the reference (which is not a coordinate: it is the client's own
   * identifier, useless to anybody else), the amount, the channel's **label**,
   * and a link to the page where the coordinates actually live. Nothing that
   * could be transferred out of a mailbox and used.
   */
  paymentInstructionsAvailable: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.paymentInstructionsAvailable.subject', lang, args),
    html: layout(
      html`
        <h1>${t(i18n, 'email.paymentInstructionsAvailable.heading', lang)}</h1>
        <p>${t(i18n, 'email.paymentInstructionsAvailable.intro', lang, args)}</p>

        ${referenceBlock(i18n, lang, args)}

        <table role="presentation" style="width:100%;margin:16px 0;">
          <tr>
            <td class="muted">${t(i18n, 'email.paymentInstructions.amountLabel', lang)}</td>
            <td style="text-align:right;font-weight:700;font-size:18px;">${args['amount']}</td>
          </tr>
          <tr>
            <td class="muted">
              ${t(i18n, 'email.paymentInstructionsAvailable.channelLabel', lang)}
            </td>
            <td style="text-align:right;font-weight:700;">${args['channelLabel']}</td>
          </tr>
        </table>

        <a href="${safeUrl(args['url'])}" class="btn"
          >${t(i18n, 'email.paymentInstructionsAvailable.button', lang)}</a
        >
        <p class="muted">${t(i18n, 'email.paymentInstructionsAvailable.why', lang)}</p>
        <p class="muted" style="word-break:break-all;">${args['url']}</p>
        <p class="muted">
          <strong>${t(i18n, 'email.paymentInstructions.supportLabel', lang)}</strong> —
          ${t(i18n, 'email.paymentInstructions.supportBody', lang, args)}
        </p>
      `,
      lang,
      i18n,
    ),
  }),

  paymentReminder: (i18n, lang, args) => ({
    subject: subjectText(
      i18n,
      args['overdue'] === 'true'
        ? 'email.paymentReminder.subjectOverdue'
        : 'email.paymentReminder.subject',
      lang,
      args,
    ),
    html: layout(
      html`
        <h1>${t(i18n, 'email.paymentReminder.heading', lang)}</h1>
        <p>
          ${t(
            i18n,
            args['overdue'] === 'true'
              ? 'email.paymentReminder.introOverdue'
              : 'email.paymentReminder.introUpcoming',
            lang,
            args,
          )}
        </p>
        <p>${t(i18n, 'email.paymentReminder.crossed', lang)}</p>

        ${referenceBlock(i18n, lang, args)}

        <table role="presentation" style="width:100%;margin:16px 0;">
          <tr>
            <td class="muted">${t(i18n, 'email.paymentInstructions.amountLabel', lang)}</td>
            <td style="text-align:right;font-weight:700;font-size:18px;">${args['amount']}</td>
          </tr>
          <tr>
            <td class="muted">${t(i18n, 'email.paymentInstructions.deadlineLabel', lang)}</td>
            <td style="text-align:right;font-weight:700;">${args['deadline']}</td>
          </tr>
        </table>

        <p class="muted">${t(i18n, 'email.paymentReminder.instructionsAgain', lang)}</p>
        <a href="${safeUrl(args['url'])}" class="btn"
          >${t(i18n, 'email.paymentInstructionsAvailable.button', lang)}</a
        >

        <p class="muted">
          <strong>${t(i18n, 'email.paymentInstructions.supportLabel', lang)}</strong> —
          ${t(i18n, 'email.paymentInstructions.supportBody', lang, args)}
        </p>
      `,
      lang,
      i18n,
    ),
  }),

  passwordReset: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.passwordReset.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.passwordReset.heading', lang)}</h1>
        <p>${t(i18n, 'email.passwordReset.body', lang, args)}</p>
        <a href="${safeUrl(args['resetUrl'])}" class="btn"
          >${t(i18n, 'email.passwordReset.button', lang)}</a
        >
        <p class="muted">${t(i18n, 'email.passwordReset.expiry', lang)}</p>
        <p class="muted" style="word-break:break-all;">${args['resetUrl']}</p>
      `,
      lang,
      i18n,
    ),
  }),

  passwordResetConfirmation: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.passwordResetConfirmation.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.passwordResetConfirmation.heading', lang)}</h1>
        <p>${t(i18n, 'email.passwordResetConfirmation.body', lang, args)}</p>
        <p>${t(i18n, 'email.passwordResetConfirmation.warning', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  accountReactivated: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.accountReactivated.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.accountReactivated.heading', lang)}</h1>
        <p>${t(i18n, 'email.accountReactivated.body', lang, args)}</p>
        <p>${t(i18n, 'email.accountReactivated.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  accountBlocked: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.accountBlocked.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.accountBlocked.heading', lang)}</h1>
        <p>${t(i18n, 'email.accountBlocked.body', lang, args)}</p>
        <p>${t(i18n, 'email.accountBlocked.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  accountUnblocked: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.accountUnblocked.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.accountUnblocked.heading', lang)}</h1>
        <p>${t(i18n, 'email.accountUnblocked.body', lang, args)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  accountDeletion: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.accountDeletion.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.accountDeletion.heading', lang)}</h1>
        <p>${t(i18n, 'email.accountDeletion.body', lang, args)}</p>
        <p>${t(i18n, 'email.accountDeletion.grace', lang, args)}</p>
        <p>${t(i18n, 'email.accountDeletion.warning', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  examPassed: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.examPassed.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.examPassed.heading', lang)}</h1>
        <p>${t(i18n, 'email.examPassed.body', lang, args)}</p>
        <p>${t(i18n, 'email.examPassed.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  examFailed: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.examFailed.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.examFailed.heading', lang)}</h1>
        <p>${t(i18n, 'email.examFailed.body', lang, args)}</p>
        <p>${t(i18n, 'email.examFailed.retake', lang, args)}</p>
        <p>${t(i18n, 'email.examFailed.encouragement', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  inviteUser: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.inviteUser.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.inviteUser.heading', lang, args)}</h1>
        <p>${t(i18n, 'email.inviteUser.body', lang, args)}</p>
        <a href="${safeUrl(args['setPasswordUrl'])}" class="btn"
          >${t(i18n, 'email.inviteUser.button', lang)}</a
        >
        <p class="muted">${t(i18n, 'email.inviteUser.expiry', lang)}</p>
        <p class="muted" style="word-break:break-all;">${args['setPasswordUrl']}</p>
      `,
      lang,
      i18n,
    ),
  }),

  emailChangeRequest: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.emailChangeRequest.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.emailChangeRequest.heading', lang, args)}</h1>
        <p>${t(i18n, 'email.emailChangeRequest.body', lang, args)}</p>
        <a href="${safeUrl(args['confirmUrl'])}" class="btn"
          >${t(i18n, 'email.emailChangeRequest.button', lang)}</a
        >
        <p class="muted">${t(i18n, 'email.emailChangeRequest.expiry', lang)}</p>
        <p class="muted" style="word-break:break-all;">${args['confirmUrl']}</p>
      `,
      lang,
      i18n,
    ),
  }),

  emailChangeConfirm: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.emailChangeConfirm.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.emailChangeConfirm.heading', lang)}</h1>
        <p>${t(i18n, 'email.emailChangeConfirm.body', lang, args)}</p>
        <p>${t(i18n, 'email.emailChangeConfirm.warning', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  idVerified: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.idVerified.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.idVerified.heading', lang)}</h1>
        <p>${t(i18n, 'email.idVerified.body', lang, args)}</p>
        <p>${t(i18n, 'email.idVerified.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  idRejected: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.idRejected.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.idRejected.heading', lang)}</h1>
        <p>${t(i18n, 'email.idRejected.body', lang, args)}</p>
        <p>${t(i18n, 'email.idRejected.reason', lang, args)}</p>
        <p>${t(i18n, 'email.idRejected.retry', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  certificateIssued: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.certificateIssued.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.certificateIssued.heading', lang)}</h1>
        <p>${t(i18n, 'email.certificateIssued.body', lang, args)}</p>
        <p>${t(i18n, 'email.certificateIssued.numberLabel', lang)}</p>
        <div class="code">${args['kcaNumber']}</div>
        <p>${t(i18n, 'email.certificateIssued.validLabel', lang, args)}</p>
        <p>${t(i18n, 'email.certificateIssued.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  applicationSubmitted: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.applicationSubmitted.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.applicationSubmitted.heading', lang)}</h1>
        <p>${t(i18n, 'email.applicationSubmitted.body', lang, args)}</p>
        <p>${t(i18n, 'email.applicationSubmitted.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  applicationApproved: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.applicationApproved.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.applicationApproved.heading', lang)}</h1>
        <p>${t(i18n, 'email.applicationApproved.body', lang, args)}</p>
        <p>${t(i18n, 'email.applicationApproved.agentCode', lang)}</p>
        <div class="code">${args['agentCode']}</div>
        <p>${t(i18n, 'email.applicationApproved.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  applicationRejected: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.applicationRejected.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.applicationRejected.heading', lang)}</h1>
        <p>${t(i18n, 'email.applicationRejected.body', lang, args)}</p>
        ${args['reason']
          ? html`<p>${t(i18n, 'email.applicationRejected.reason', lang, args)}</p>`
          : ''}
        <p>${t(i18n, 'email.applicationRejected.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  agentSuspended: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.agentSuspended.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.agentSuspended.heading', lang)}</h1>
        <p>${t(i18n, 'email.agentSuspended.body', lang, args)}</p>
        <p>${t(i18n, 'email.agentSuspended.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  agentReactivated: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.agentReactivated.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.agentReactivated.heading', lang)}</h1>
        <p>${t(i18n, 'email.agentReactivated.body', lang, args)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  agentPromotion: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.agentPromotion.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.agentPromotion.heading', lang, args)}</h1>
        <p>${t(i18n, 'email.agentPromotion.body', lang, args)}</p>
        <p>${t(i18n, 'email.agentPromotion.tierLabel', lang)}</p>
        <div class="code">${args['newTier']}</div>
        <p>${t(i18n, 'email.agentPromotion.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  reservationCreated: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.reservationCreated.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.reservationCreated.heading', lang)}</h1>
        <p>${t(i18n, 'email.reservationCreated.body', lang, args)}</p>
        <p>${t(i18n, 'email.reservationCreated.landInfo', lang, args)}</p>
        <p>${t(i18n, 'email.reservationCreated.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  clientPortalAccess: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.clientPortalAccess.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.clientPortalAccess.heading', lang)}</h1>
        <p>${t(i18n, 'email.clientPortalAccess.body', lang, args)}</p>
        <p>${t(i18n, 'email.clientPortalAccess.landInfo', lang, args)}</p>
        ${
          /**
           * The agent line renders only when there is a name to put in it.
           *
           * This field carried `agentUserId` with the comment "will be enriched in
           * the controller", and the enrichment never happened: the client was
           * emailed "Votre agent KAMNET : 00000000-0000-4000-8000-b00000000005".
           * An internal identifier in front of a customer is a leak and an
           * embarrassment at the same time. If the name cannot be reached, the
           * line does not belong in the email.
           */
          args['agentName']
            ? html`<p>${t(i18n, 'email.clientPortalAccess.agent', lang, args)}</p>`
            : ''
        }
        <p>${t(i18n, 'email.clientPortalAccess.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  reservationConfirmed: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.reservationConfirmed.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.reservationConfirmed.heading', lang)}</h1>
        <p>${t(i18n, 'email.reservationConfirmed.body', lang, args)}</p>
        <p>${t(i18n, 'email.reservationConfirmed.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  reservationCancelled: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.reservationCancelled.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.reservationCancelled.heading', lang)}</h1>
        <p>${t(i18n, 'email.reservationCancelled.body', lang, args)}</p>
        ${args['reason']
          ? html`<p>${t(i18n, 'email.reservationCancelled.reason', lang, args)}</p>`
          : ''}
        <p>${t(i18n, 'email.reservationCancelled.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  clientDocumentUploaded: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.clientDocumentUploaded.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.clientDocumentUploaded.heading', lang)}</h1>
        <p>${t(i18n, 'email.clientDocumentUploaded.body', lang, args)}</p>
        <p>${t(i18n, 'email.clientDocumentUploaded.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  clientDocumentRejected: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.clientDocumentRejected.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.clientDocumentRejected.heading', lang)}</h1>
        <p>${t(i18n, 'email.clientDocumentRejected.body', lang, args)}</p>
        <p>${t(i18n, 'email.clientDocumentRejected.reason', lang, args)}</p>
        <p>${t(i18n, 'email.clientDocumentRejected.retry', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  clientDocumentsValidated: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.clientDocumentsValidated.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.clientDocumentsValidated.heading', lang)}</h1>
        <p>${t(i18n, 'email.clientDocumentsValidated.body', lang, args)}</p>
        <p>${t(i18n, 'email.clientDocumentsValidated.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  paymentConfirmed: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.paymentConfirmed.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.paymentConfirmed.heading', lang)}</h1>
        <p>${t(i18n, 'email.paymentConfirmed.body', lang, args)}</p>
        <p>${t(i18n, 'email.paymentConfirmed.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  dossierStarted: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.dossierStarted.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.dossierStarted.heading', lang)}</h1>
        <p>${t(i18n, 'email.dossierStarted.body', lang, args)}</p>
        <p>${t(i18n, 'email.dossierStarted.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  kbsEnrollmentReceived: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.kbsEnrollmentReceived.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.kbsEnrollmentReceived.heading', lang)}</h1>
        <p>${t(i18n, 'email.kbsEnrollmentReceived.body', lang, args)}</p>
        <p>${t(i18n, 'email.kbsEnrollmentReceived.paymentIntro', lang)}</p>
        <p><strong>${t(i18n, 'email.kbsEnrollmentReceived.amount', lang)}</strong></p>
        <p>${t(i18n, 'email.kbsEnrollmentReceived.instructions', lang)}</p>
        <p>${t(i18n, 'email.kbsEnrollmentReceived.note', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  /**
   * L1 - the acknowledgement the prospect gets.
   *
   * Sent in the language of the page they filled in, which is stored on the
   * row rather than guessed later: a prospect who wrote in French is answered
   * in French, by a person, weeks later, without anybody having to work it out.
   *
   * It quotes their own message back. That is not padding - it is the only
   * copy they will have of what they sent, and it is what lets them tell "they
   * received it" from "they received something".
   */
  contactRequestReceived: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.contactRequestReceived.subject', lang),
    html: layout(
      html`
        <h1>${t(i18n, 'email.contactRequestReceived.heading', lang)}</h1>
        <p>${t(i18n, 'email.contactRequestReceived.intro', lang, args)}</p>
        <p class="muted" style="margin-bottom:4px;">
          ${t(i18n, 'email.contactRequestReceived.referenceLabel', lang)}
        </p>
        <p
          style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:700;
                letter-spacing:1px;margin:0 0 8px;word-break:break-all;"
        >
          ${args['reference']}
        </p>
        <p class="muted" style="margin-top:0;">
          ${t(i18n, 'email.contactRequestReceived.referenceRule', lang)}
        </p>
        <p class="muted" style="margin-bottom:4px;">
          ${t(i18n, 'email.contactRequestReceived.subjectLabel', lang)}: ${args['subjectLabel']}
        </p>
        <p class="muted" style="margin-bottom:4px;">
          ${t(i18n, 'email.contactRequestReceived.recapLabel', lang)}
        </p>
        ${preservedTextBlock(args['message'])}
        <p>${t(i18n, 'email.contactRequestReceived.closing', lang)}</p>
      `,
      lang,
      i18n,
    ),
  }),

  /**
   * L1 - what the back office gets when a request arrives.
   *
   * Everything needed to answer without opening the back office: who, how to
   * reach them, what they asked, and when they consented. The reply-to is the
   * prospect's own address, in the body rather than as a header, because the
   * sending identity is a verified SES one and must stay that way.
   */
  contactRequestNotification: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.contactRequestNotification.subject', lang, args),
    html: layout(
      html`
        <h1>${t(i18n, 'email.contactRequestNotification.heading', lang)}</h1>
        <p>${t(i18n, 'email.contactRequestNotification.intro', lang, args)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactRequestNotification.referenceLabel', lang)}
            </td>
            <td style="padding:6px 0;font-family:monospace;">${args['reference']}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactRequestNotification.nameLabel', lang)}
            </td>
            <td style="padding:6px 0;">${args['name']}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactRequestNotification.emailLabel', lang)}
            </td>
            <td style="padding:6px 0;">${args['email']}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactRequestNotification.phoneLabel', lang)}
            </td>
            <td style="padding:6px 0;">${args['phone']}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactRequestNotification.subjectLabel', lang)}
            </td>
            <td style="padding:6px 0;">${args['subjectLabel']}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactRequestNotification.localeLabel', lang)}
            </td>
            <td style="padding:6px 0;">${args['locale']}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactRequestNotification.consentLabel', lang)}
            </td>
            <td style="padding:6px 0;">${args['consentGivenAt']}</td>
          </tr>
        </table>
        <p class="muted" style="margin-top:24px;margin-bottom:4px;">
          ${t(i18n, 'email.contactRequestNotification.messageLabel', lang)}
        </p>
        ${preservedTextBlock(args['message'])}
      `,
      lang,
      i18n,
    ),
  }),

  /**
   * L1 - the daily digest, and the reason it is a digest rather than an alert.
   *
   * **It is sent every day, including when the count is zero.** An alert that
   * fires only on a condition is a mechanism nobody has ever seen work: the
   * contact form sent nothing for its entire life and no alert existed to
   * notice, because there was no traffic to compare against. A message that
   * always arrives inverts that - its **absence** is the signal, and absence is
   * something a person notices without being told to look.
   *
   * Same lesson as the seven months of a silent SES client, applied before it
   * can happen again rather than after.
   */
  contactDigest: (i18n, lang, args) => ({
    subject: subjectText(i18n, 'email.contactDigest.subject', lang, args),
    html: layout(
      html`
        <h1>${t(i18n, 'email.contactDigest.heading', lang)}</h1>
        <p>${t(i18n, 'email.contactDigest.intro', lang, args)}</p>
        ${Number(args['count']) === 0
          ? html`<p class="muted">${t(i18n, 'email.contactDigest.zeroNote', lang)}</p>`
          : html`<p class="muted" style="margin-bottom:4px;">
                ${t(i18n, 'email.contactDigest.breakdownLabel', lang)}
              </p>
              ${preservedTextBlock(args['breakdown'])}`}
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactDigest.pendingLabel', lang)}
            </td>
            <td style="padding:6px 0;font-weight:700;">${args['pending']}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#a0aec0;">
              ${t(i18n, 'email.contactDigest.oldestLabel', lang)}
            </td>
            <td style="padding:6px 0;">${args['oldest']}</td>
          </tr>
        </table>
      `,
      lang,
      i18n,
    ),
  }),
});

export type TemplateKey = keyof typeof templates;

/**
 * The only messages a recipient's `emailNotifications` preference may suppress.
 *
 * **An allow-list, not a deny-list, and that is the whole point.** A new
 * template is transactional until somebody deliberately adds it here, so
 * forgetting to classify one fails safe - it gets sent - rather than failing
 * silent.
 *
 * The rule was already written above `sendUpdate` as prose: *"NEVER use this for
 * auth, security, compliance or onboarding emails."* Twelve of the fifteen
 * messages routed through it broke that rule, because prose does not refuse
 * anything. `EmailService.sendUpdate` now throws on a template that is not in
 * this set.
 *
 * What is here, and why each one:
 *
 * - `reservationCreated` - goes to the **agent**, not the client: "your client
 *   reserved a parcel". A work notification, visible in their dashboard;
 * - `clientDocumentUploaded` - to the **agent**: "your client uploaded a
 *   document". Same shape;
 * - `agentPromotion` - announces a tier the agent can see in their own
 *   dashboard. Carries no reference, no deadline, no money movement and no
 *   action to take.
 *
 * Everything else carries a reference, a deadline, money, an outcome the person
 * is entitled to, or an action they must take. Those are transactional and go
 * out regardless of the preference.
 */
export const SUPPRESSIBLE_TEMPLATES: ReadonlySet<TemplateKey> = new Set<TemplateKey>([
  'reservationCreated',
  'clientDocumentUploaded',
  'agentPromotion',
]);

/** True when the preference may not suppress this message. */
export const isTransactional = (template: TemplateKey): boolean =>
  !SUPPRESSIBLE_TEMPLATES.has(template);

export const buildEmail = (
  template: TemplateKey,
  lang: 'en' | 'fr',
  args: TemplateArgs,
  i18n: I18nService,
): { subject: string; html: string } => {
  const builder = templates[template];
  if (!builder) {
    throw new Error(`Email template "${template}" not found`);
  }
  const { subject, html: body } = builder(i18n, lang, args);
  return { subject, html: body.toString() };
};
