import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';

const Testimonials = async () => {
  const t = await getTranslations('testimonials');

  const clients = [
    {
      key: 'client1',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marie',
    },
    {
      key: 'client2',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JeanPaul',
    },
    {
      key: 'client3',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sandra',
    },
  ] as const;

  return (
    <section className="bg-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-16 sm:mt-20">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map(({ key, avatar }) => (
              <div key={key}>
                <figure className="rounded-lg bg-white p-8 text-sm/6">
                  <blockquote className="text-gray-900">
                    <p>&ldquo;{t(`${key}.text` as 'client1.text')}&rdquo;</p>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-x-4">
                    <div className="relative size-10 overflow-hidden rounded-full bg-gray-50">
                      <Image
                        fill
                        unoptimized
                        src={avatar}
                        className="object-cover"
                        alt={t(`${key}.name` as 'client1.name')}
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {t(`${key}.name` as 'client1.name')}
                      </div>
                      <div className="text-gray-600">
                        {t(`${key}.location` as 'client1.location')}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
