import { cn } from '@/lib/utils';
import type { FC } from 'react';
import React from 'react';

interface SectionCardProps {
  title: string;
  description: string;
  className?: string;
  Icon: FC<React.SVGProps<SVGSVGElement>>;
  iconContainerClassName?: string;
  iconClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

const SectionCard: FC<SectionCardProps> = ({
  title,
  description,
  Icon,
  className,
  iconContainerClassName,
  iconClassName,
  titleClassName,
  descriptionClassName,
}) => {
  return (
    <div
      className={cn('relative rounded-lg border border-border bg-background p-6 sm:p-8', className)}
    >
      <div
        className={cn(
          'mb-6 flex size-14 items-center justify-center rounded-lg bg-accent/10',
          iconContainerClassName,
        )}
      >
        <Icon className={cn('size-7 text-accent transition-colors', iconClassName)} />
      </div>
      <h3 className={cn('mb-3 text-lg/7 font-medium text-foreground', titleClassName)}>{title}</h3>
      <p
        className={cn(
          'text-sm/7 leading-relaxed text-muted-foreground sm:text-base/7',
          descriptionClassName,
        )}
      >
        {description}
      </p>
    </div>
  );
};

export default SectionCard;
