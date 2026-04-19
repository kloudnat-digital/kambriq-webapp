import type { FC } from 'react';
import React from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

interface GridItemProps {
  title: string;
  description: string;
  imageSrc: string;
  imageSize?: {
    width?: number;
    height?: number;
  };
}

const GridItem: FC<GridItemProps> = ({ title, description, imageSrc, imageSize }) => {
  return (
    <div className="relative lg:col-span-2">
      <div className="absolute inset-0 rounded-lg bg-white lg:rounded-bl-4xl" />
      <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] lg:rounded-bl-[calc(2rem+1px)]">
        <Image
          height={imageSize?.height || 320}
          width={imageSize?.width || 1207}
          alt={title}
          src={imageSrc}
          className="h-80 object-cover object-left"
        />
        <div className="p-10 pt-4">
          <p className="mt-2 text-lg font-medium tracking-tight text-gray-950">{title}</p>
          <p className="mt-2 max-w-lg text-sm/6 text-gray-600">{description}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-lg outline outline-black/15 lg:rounded-bl-4xl" />
    </div>
  );
};

const WhoCanRegisterKBS: FC = async () => {
  const t = await getTranslations('products.kbs.whoCanRegister');
  return (
    <div className="py-6">
      <p className="mx-auto max-w-lg text-center text-4xl font-semibold tracking-tight text-balance text-gray-950 sm:text-5xl">
        {t('heading')}
      </p>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-16 lg:grid-cols-6">
        <GridItem
          title={t('futureAgent.title')}
          description={t('futureAgent.description')}
          imageSrc="https://images.unsplash.com/photo-1507537417841-81e85feb9bd2?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        />
        <GridItem
          title={t('diaspora.title')}
          imageSize={{ width: 2574 }}
          description={t('diaspora.description')}
          imageSrc="https://images.unsplash.com/photo-1659947234294-b217aaeb25f8?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        />
        <GridItem
          title={t('professionals.title')}
          imageSize={{ width: 2670 }}
          description={t('professionals.description')}
          imageSrc="https://images.unsplash.com/photo-1682924754698-9f0a3bcef68f?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        />
      </div>
    </div>
  );
};

export default WhoCanRegisterKBS;
