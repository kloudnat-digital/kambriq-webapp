import { Linkedin } from 'lucide-react';
import { useTranslations } from 'next-intl';

const TEAM = [
  { key: 'ceo', avatar: 'CE', gradient: 'from-primary-500 to-primary-700' },
  { key: 'cto', avatar: 'CT', gradient: 'from-gold-500 to-gold-700' },
  { key: 'coo', avatar: 'CO', gradient: 'from-accent-500 to-accent-700' },
];

export const TeamSection = () => {
  const t = useTranslations('about.team');
  return (
    <section className="px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-2xl font-bold">{t('title')}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {TEAM.map((member) => (
            <div
              key={member.key}
              className="flex flex-col items-center rounded-2xl border border-border bg-white p-8 text-center shadow-sm"
            >
              <div
                className={`mb-4 flex size-20 items-center justify-center rounded-full bg-gradient-to-br text-2xl font-bold text-white ${member.gradient}`}
              >
                {member.avatar}
              </div>
              <h3 className="text-base font-semibold">{t(`members.${member.key}.name`)}</h3>
              <p className="mt-1 text-sm text-primary-600">{t(`members.${member.key}.role`)}</p>
              <p className="mt-3 text-xs leading-relaxed text-gray-500">
                {t(`members.${member.key}.bio`)}
              </p>
              <a
                href="#"
                className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-primary-600"
              >
                <Linkedin className="size-3.5" /> LinkedIn
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
