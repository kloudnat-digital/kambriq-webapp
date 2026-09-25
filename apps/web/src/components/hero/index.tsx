import type { FC, SVGProps } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Link } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';

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
  Icon,
  heroBadgeLabel,
  title,
  subtitle,
  cta1,
  cta2,
  children,
  indicators,
}) => {
  return (
    <section className="overflow-hidden bg-background pt-14 pb-16 sm:pb-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl py-8 sm:py-12 lg:py-14">
          <div className="mb-8 flex justify-center">
            <Badge className="rounded-full bg-primary-100 px-3 py-1 text-primary-600 outline-1 outline-primary-700/50">
              <Icon className="mr-1 size-3 flex-none" />
              <span>{heroBadgeLabel}</span>
            </Badge>
          </div>
          <div className="text-center">
            <h1 className="text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-7xl">
              {title}
            </h1>
            <p className="mt-8 text-lg font-medium text-pretty text-gray-600 sm:text-xl/8">
              {subtitle}
            </p>
            {children}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="h-9">
                <Link href={cta1.href}>{cta1.label}</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-9 font-semibold text-gray-900 hover:bg-transparent hover:text-gray-900"
              >
                <Link href={cta2.href}>
                  {cta2.label}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 font-sans text-sm font-medium text-gray-700">
              {indicators?.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="size-4 text-success" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SharedHero;
