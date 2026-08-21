import type { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-gray-200 p-4 shadow-sm">{children}</div>;
}
