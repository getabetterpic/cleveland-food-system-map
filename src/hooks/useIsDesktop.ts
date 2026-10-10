import { useEffect, useState } from 'react';

const QUERY = '(min-width: 768px)';

export default function useIsDesktop(): boolean {
  // Mobile-first default; real value set after mount (no `window` during SSR).
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
