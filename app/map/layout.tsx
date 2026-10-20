import { AuthButton } from '@/components/auth-button';
import { EnvVarWarning } from '@/components/env-var-warning';
import { hasEnvVars } from '@/lib/utils';
import Link from 'next/link';
import { Suspense } from 'react';

// Full-height app shell: fixed nav, map fills the rest. No footer — it would
// eat map space on mobile.
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-dvh flex flex-col overflow-hidden">
      <nav className="shrink-0 w-full flex justify-center border-b border-b-foreground/10 h-14">
        <div className="w-full flex justify-between items-center gap-3 px-4 text-sm">
          <Link href={'/'} className="font-semibold truncate">
            Cleveland Food System Map
          </Link>
          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : (
            <Suspense>
              <AuthButton />
            </Suspense>
          )}
        </div>
      </nav>
      {children}
    </main>
  );
}
