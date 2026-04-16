import type { FC, SVGProps } from 'react';

interface StepProps {
  isLast?: boolean;
  title: string;
  Icon: FC<SVGProps<SVGSVGElement>>;
  stepLabel: string;
  description: string;
}

const Step: FC<StepProps> = ({ isLast, title, Icon, stepLabel, description }) => {
  return (
    <div className="group relative">
      {!isLast && (
        <div className="absolute top-12 left-[calc(50%+2rem)] hidden h-0.5 w-[calc(100%-4rem)] bg-linear-to-r from-primary/30 to-transparent lg:block" />
      )}

      <div className="relative h-full rounded-lg border border-border bg-background p-6 sm:p-8">
        <div className="absolute -top-3 -right-3 flex size-10 items-center justify-center rounded-lg bg-primary text-base font-semibold text-secondary shadow-lg sm:-top-4 sm:-right-4 sm:size-12 sm:rounded-xl sm:text-lg">
          {stepLabel}
        </div>

        <div className="mb-4 flex size-14 items-center justify-center rounded-lg bg-primary/10 sm:mb-6 sm:size-16">
          <Icon className="size-7 text-primary sm:size-8" />
        </div>

        <h3 className="mb-2 text-lg/7 font-medium text-foreground sm:mb-3 sm:text-xl/7">{title}</h3>
        <p className="text-sm/7 leading-relaxed text-gray-600 sm:text-base/7">{description}</p>
      </div>
    </div>
  );
};

export default Step;
