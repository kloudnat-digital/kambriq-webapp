import { Mail, Phone, MessageCircle, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const ContactInfo = () => {
  const t = useTranslations('contact.info');
  const items = [
    {
      icon: Mail,
      label: t('email.label'),
      value: 'contact@kambriq.com',
      href: 'mailto:contact@kambriq.com',
    },
    {
      icon: MessageCircle,
      label: t('whatsapp.label'),
      value: '+237 6 XX XX XX XX',
      href: 'https://wa.me/237600000000',
    },
    {
      icon: Phone,
      label: t('phone.label'),
      value: '+237 6 XX XX XX XX',
      href: 'tel:+237600000000',
    },
    { icon: Clock, label: t('hours.label'), value: t('hours.value'), href: null },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start gap-4 rounded-xl border border-border bg-white p-4"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
            <item.icon className="size-5 text-primary-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{item.label}</p>
            {item.href ? (
              <a
                href={item.href}
                className="text-sm font-medium text-gray-900 transition-colors hover:text-primary-600"
              >
                {item.value}
              </a>
            ) : (
              <p className="text-sm text-gray-700">{item.value}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
