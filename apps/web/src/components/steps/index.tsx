import type { FC, ReactNode } from 'react';

interface StepsContainerProps {
  children: ReactNode;
}

const StepsContainer: FC<StepsContainerProps> = ({ children }) => {
  return (
    <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-7xl">
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">{children}</div>
    </div>
  );
};

export default StepsContainer;
