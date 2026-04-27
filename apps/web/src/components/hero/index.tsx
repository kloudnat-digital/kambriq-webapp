import type { FC, SVGProps } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '../ui/button';
import Eyebrow from '../ui/eyebrow';

interface SharedHeroProps {
  Icon: FC<SVGProps<SVGSVGElement>>;
  heroBadgeLabel: string;
  title: string;
  subtitle: string;
  cta1: { label: string; href: string };
  cta2: { label: string; href: string };
  children?: React.ReactNode;
  indicators?: { label: string; icon: FC<SVGProps<SVGSVGElement>> }[];
}

const SharedHero: FC<SharedHeroProps> = ({
  heroBadgeLabel,
  title,
  subtitle,
  cta1,
  cta2,
  children,
  indicators,
}) => {
  return (
    <section className="bg-surface-100">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow className="mb-4 flex justify-center">{heroBadgeLabel}</Eyebrow>
          <h1 className="font-serif text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-pretty text-accent sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 text-lg leading-[1.65] text-surface-600">{subtitle}</p>
          {children}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={cta1.href}>{cta1.label}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={cta2.href}>
                {cta2.label}
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {indicators && indicators.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-surface-600">
              {indicators.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SharedHero;
