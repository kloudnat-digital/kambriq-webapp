import { cn } from '@/lib/utils';
import Eyebrow from '@/components/ui/eyebrow';
import type { FC } from 'react';

interface SectionHeaderProps {
  title: string;
  titleClassName?: string;
  subtitle?: string;
  eyebrow?: string;
  align?: 'center' | 'left';
  className?: string;
  /** When true (default for marketing pages), title uses the editorial serif. */
  editorial?: boolean;
}

const SectionHeader: FC<SectionHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  align = 'center',
  className,
  titleClassName,
  editorial = true,
}: SectionHeaderProps) => {
  return (
    <div
      className={cn(
        'mx-auto max-w-3xl',
        align === 'center' && 'text-center',
        align === 'left' && 'mx-0 text-left',
        className,
      )}
    >
      {eyebrow && (
        <Eyebrow className={cn('mb-3', align === 'center' && 'flex justify-center')}>
          {eyebrow}
        </Eyebrow>
      )}
      <h2
        className={cn(
          editorial
            ? 'font-serif text-4xl leading-[1.08] font-semibold tracking-[-0.015em] text-pretty text-accent sm:text-5xl'
            : 'text-4xl font-semibold tracking-tight text-pretty text-accent sm:text-5xl',
          titleClassName,
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-5 max-w-2xl text-lg/8 text-pretty text-surface-600">{subtitle}</p>
      )}
    </div>
  );
};

export default SectionHeader;
