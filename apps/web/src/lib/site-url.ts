export function publicSiteUrl(
  source: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = source.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  const vercelUrl = source.VERCEL_URL?.trim().replace(/\/$/, '');
  return vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000';
}
