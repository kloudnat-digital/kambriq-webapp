/**
 * KAMBRIQ Email Templates
 * Each function returns { subject, html }
 */

import { I18nService } from 'nestjs-i18n';

const t = (
  i18n: I18nService,
  key: string,
  lang: string,
  args?: Record<string, string | number>,
): string => {
  return i18n.translate(key, { lang, args });
};

/** Shared HTML Layout */
const layout = (content: string, lang: string, i18n: I18nService): string => {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .logo { font-size: 24px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.5px; margin-bottom: 32px; }
    .logo span { color: #e94560; }
    h1 { font-size: 22px; color: #1a1a2e; margin: 0 0 16px; }
    p { font-size: 15px; line-height: 1.6; color: #4a5568; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 14px 32px; background: #1a1a2e; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
    .code { display: inline-block; padding: 12px 24px; background: #f0f4f8; border-radius: 8px; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1a1a2e; font-family: monospace; margin: 8px 0 24px; }
    .footer { text-align: center; padding-top: 32px; font-size: 13px; color: #a0aec0; }
    .muted { font-size: 13px; color: #a0aec0; }
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
</html>`.trim();
};

// ----- Template builders -----

type TemplateArgs = Record<string, string | number>;

type TemplateFn = (
  i18n: I18nService,
  lang: string,
  args: TemplateArgs,
) => { subject: string; html: string };

const defineTemplates = <T extends Record<string, TemplateFn>>(t: T) => t;
const templates = defineTemplates({
  verification: (i18n, lang, args) => ({
    subject: t(i18n, 'email.verification.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.verification.heading', lang, args)}</h1>
      <p>${t(i18n, 'email.verification.body', lang)}</p>
      <a href="${args['verificationUrl']}" class="btn">${t(i18n, 'email.verification.button', lang)}</a>
      <p class="muted">${t(i18n, 'email.verification.expiry', lang)}</p>
      <p class="muted" style="word-break:break-all;">${args['verificationUrl']}</p>
    `,
      lang,
      i18n,
    ),
  }),

  passwordReset: (i18n, lang, args) => ({
    subject: t(i18n, 'email.passwordReset.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.passwordReset.heading', lang)}</h1>
      <p>${t(i18n, 'email.passwordReset.body', lang, args)}</p>
      <a href="${args['resetUrl']}" class="btn">${t(i18n, 'email.passwordReset.button', lang)}</a>
      <p class="muted">${t(i18n, 'email.passwordReset.expiry', lang)}</p>
      <p class="muted" style="word-break:break-all;">${args['resetUrl']}</p>
    `,
      lang,
      i18n,
    ),
  }),

  passwordResetConfirmation: (i18n, lang, args) => ({
    subject: t(i18n, 'email.passwordResetConfirmation.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.passwordResetConfirmation.heading', lang)}</h1>
      <p>${t(i18n, 'email.passwordResetConfirmation.body', lang, args)}</p>
      <p>${t(i18n, 'email.passwordResetConfirmation.warning', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  accountReactivated: (i18n, lang, args) => ({
    subject: t(i18n, 'email.accountReactivated.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.accountReactivated.heading', lang)}</h1>
      <p>${t(i18n, 'email.accountReactivated.body', lang, args)}</p>
      <p>${t(i18n, 'email.accountReactivated.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  accountBlocked: (i18n, lang, args) => ({
    subject: t(i18n, 'email.accountBlocked.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.accountBlocked.heading', lang)}</h1>
      <p>${t(i18n, 'email.accountBlocked.body', lang, args)}</p>
      <p>${t(i18n, 'email.accountBlocked.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  accountUnblocked: (i18n, lang, args) => ({
    subject: t(i18n, 'email.accountUnblocked.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.accountUnblocked.heading', lang)}</h1>
      <p>${t(i18n, 'email.accountUnblocked.body', lang, args)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  accountDeletion: (i18n, lang, args) => ({
    subject: t(i18n, 'email.accountDeletion.subject', lang),
    html: layout(
      `
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
    subject: t(i18n, 'email.examPassed.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.examPassed.heading', lang)}</h1>
      <p>${t(i18n, 'email.examPassed.body', lang, args)}</p>
      <p>${t(i18n, 'email.examPassed.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  examFailed: (i18n, lang, args) => ({
    subject: t(i18n, 'email.examFailed.subject', lang),
    html: layout(
      `
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
    subject: t(i18n, 'email.inviteUser.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.inviteUser.heading', lang, args)}</h1>
      <p>${t(i18n, 'email.inviteUser.body', lang, args)}</p>
      <a href="${args['setPasswordUrl']}" class="btn">${t(i18n, 'email.inviteUser.button', lang)}</a>
      <p class="muted">${t(i18n, 'email.inviteUser.expiry', lang)}</p>
      <p class="muted" style="word-break:break-all;">${args['setPasswordUrl']}</p>
    `,
      lang,
      i18n,
    ),
  }),

  emailChangeRequest: (i18n, lang, args) => ({
    subject: t(i18n, 'email.emailChangeRequest.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.emailChangeRequest.heading', lang, args)}</h1>
      <p>${t(i18n, 'email.emailChangeRequest.body', lang, args)}</p>
      <a href="${args['confirmUrl']}" class="btn">${t(i18n, 'email.emailChangeRequest.button', lang)}</a>
      <p class="muted">${t(i18n, 'email.emailChangeRequest.expiry', lang)}</p>
      <p class="muted" style="word-break:break-all;">${args['confirmUrl']}</p>
    `,
      lang,
      i18n,
    ),
  }),

  emailChangeConfirm: (i18n, lang, args) => ({
    subject: t(i18n, 'email.emailChangeConfirm.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.emailChangeConfirm.heading', lang)}</h1>
      <p>${t(i18n, 'email.emailChangeConfirm.body', lang, args)}</p>
      <p>${t(i18n, 'email.emailChangeConfirm.warning', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  idVerified: (i18n, lang, args) => ({
    subject: t(i18n, 'email.idVerified.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.idVerified.heading', lang)}</h1>
      <p>${t(i18n, 'email.idVerified.body', lang, args)}</p>
      <p>${t(i18n, 'email.idVerified.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  idRejected: (i18n, lang, args) => ({
    subject: t(i18n, 'email.idRejected.subject', lang),
    html: layout(
      `
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
    subject: t(i18n, 'email.certificateIssued.subject', lang),
    html: layout(
      `
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
    subject: t(i18n, 'email.applicationSubmitted.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.applicationSubmitted.heading', lang)}</h1>
      <p>${t(i18n, 'email.applicationSubmitted.body', lang, args)}</p>
      <p>${t(i18n, 'email.applicationSubmitted.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  applicationApproved: (i18n, lang, args) => ({
    subject: t(i18n, 'email.applicationApproved.subject', lang),
    html: layout(
      `
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
    subject: t(i18n, 'email.applicationRejected.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.applicationRejected.heading', lang)}</h1>
      <p>${t(i18n, 'email.applicationRejected.body', lang, args)}</p>
      ${args['reason'] ? `<p>${t(i18n, 'email.applicationRejected.reason', lang, args)}</p>` : ''}
      <p>${t(i18n, 'email.applicationRejected.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  agentSuspended: (i18n, lang, args) => ({
    subject: t(i18n, 'email.agentSuspended.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.agentSuspended.heading', lang)}</h1>
      <p>${t(i18n, 'email.agentSuspended.body', lang, args)}</p>
      <p>${t(i18n, 'email.agentSuspended.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  agentReactivated: (i18n, lang, args) => ({
    subject: t(i18n, 'email.agentReactivated.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.agentReactivated.heading', lang)}</h1>
      <p>${t(i18n, 'email.agentReactivated.body', lang, args)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  agentPromotion: (i18n, lang, args) => ({
    subject: t(i18n, 'email.agentPromotion.subject', lang),
    html: layout(
      `
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
    subject: t(i18n, 'email.reservationCreated.subject', lang),
    html: layout(
      `
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
    subject: t(i18n, 'email.clientPortalAccess.subject', lang),
    html: layout(
      `
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
        args['agentName'] ? `<p>${t(i18n, 'email.clientPortalAccess.agent', lang, args)}</p>` : ''
      }
      <p>${t(i18n, 'email.clientPortalAccess.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  reservationConfirmed: (i18n, lang, args) => ({
    subject: t(i18n, 'email.reservationConfirmed.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.reservationConfirmed.heading', lang)}</h1>
      <p>${t(i18n, 'email.reservationConfirmed.body', lang, args)}</p>
      <p>${t(i18n, 'email.reservationConfirmed.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  reservationCancelled: (i18n, lang, args) => ({
    subject: t(i18n, 'email.reservationCancelled.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.reservationCancelled.heading', lang)}</h1>
      <p>${t(i18n, 'email.reservationCancelled.body', lang, args)}</p>
      ${args['reason'] ? `<p>${t(i18n, 'email.reservationCancelled.reason', lang, args)}</p>` : ''}
      <p>${t(i18n, 'email.reservationCancelled.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  clientDocumentUploaded: (i18n, lang, args) => ({
    subject: t(i18n, 'email.clientDocumentUploaded.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.clientDocumentUploaded.heading', lang)}</h1>
      <p>${t(i18n, 'email.clientDocumentUploaded.body', lang, args)}</p>
      <p>${t(i18n, 'email.clientDocumentUploaded.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  clientDocumentRejected: (i18n, lang, args) => ({
    subject: t(i18n, 'email.clientDocumentRejected.subject', lang),
    html: layout(
      `
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
    subject: t(i18n, 'email.clientDocumentsValidated.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.clientDocumentsValidated.heading', lang)}</h1>
      <p>${t(i18n, 'email.clientDocumentsValidated.body', lang, args)}</p>
      <p>${t(i18n, 'email.clientDocumentsValidated.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  paymentConfirmed: (i18n, lang, args) => ({
    subject: t(i18n, 'email.paymentConfirmed.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.paymentConfirmed.heading', lang)}</h1>
      <p>${t(i18n, 'email.paymentConfirmed.body', lang, args)}</p>
      <p>${t(i18n, 'email.paymentConfirmed.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  dossierStarted: (i18n, lang, args) => ({
    subject: t(i18n, 'email.dossierStarted.subject', lang),
    html: layout(
      `
      <h1>${t(i18n, 'email.dossierStarted.heading', lang)}</h1>
      <p>${t(i18n, 'email.dossierStarted.body', lang, args)}</p>
      <p>${t(i18n, 'email.dossierStarted.note', lang)}</p>
    `,
      lang,
      i18n,
    ),
  }),

  kbsEnrollmentReceived: (i18n, lang, args) => ({
    subject: t(i18n, 'email.kbsEnrollmentReceived.subject', lang),
    html: layout(
      `
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
});

export type TemplateKey = keyof typeof templates;

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
  return builder(i18n, lang, args);
};
