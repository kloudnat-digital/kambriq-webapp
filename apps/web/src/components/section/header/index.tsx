import { cn } from '@/lib/utils';
import type { FC } from 'react';

interface SectionHeaderProps {
  title: string;
  titleClassName?: string;
  subtitle?: string;
  align?: 'center' | 'left';
  className?: string;
}

const SectionHeader: FC<SectionHeaderProps> = ({
  title,
  subtitle,
  align = 'center',
  className,
  titleClassName,
}: SectionHeaderProps) => {
  return (
    <div className={cn('mx-auto max-w-4xl', align === 'center' && 'text-center', className)}>
      <h2
        className={cn(
          'text-5xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-6xl lg:text-balance',
          titleClassName,
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-6 max-w-2xl text-lg/8 font-medium text-pretty text-gray-600">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionHeader;
