import { cn } from '@/lib/utils';
import type { FC, ReactNode } from 'react';

interface SectionCardContainerProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

const SectionCardContainer: FC<SectionCardContainerProps> = ({
  children,
  className,
  containerClassName,
}) => {
  return (
    <div className={cn('mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-7xl', className)}>
      <div className={cn('grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4', containerClassName)}>
        {children}
      </div>
    </div>
  );
};

export default SectionCardContainer;
