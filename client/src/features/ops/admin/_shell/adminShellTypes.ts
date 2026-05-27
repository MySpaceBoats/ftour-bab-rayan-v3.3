import type { ReactNode } from 'react';

export type AdminPageConfig = {
  title: string;
  crumb?: string[];
  actions?: ReactNode;
  active?: string;
};
