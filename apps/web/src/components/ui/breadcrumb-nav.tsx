'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';

interface Props {
  labels?: Record<string, string>;
}

export const BreadcrumbNav = ({ labels }: Props) => {
  const items = useBreadcrumbs(labels);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, i) => (
          <Fragment key={item.href}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : item.clickable ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <span className="text-muted-foreground">{item.label}</span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
