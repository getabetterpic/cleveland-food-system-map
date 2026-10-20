import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';

// OAuth (PKCE) lands here from Supabase with ?code; trade it for a session.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // Same-origin paths only — `//evil.com` would be an open redirect.
  const nextParam = searchParams.get('next');
  const next =
    nextParam?.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/map';

  if (!code) {
    // Provider-side failures (e.g. user hit Cancel) arrive as ?error_description.
    const message =
      searchParams.get('error_description') ?? 'No authorization code';
    redirect(`/auth/error?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }
  redirect(next);
}
