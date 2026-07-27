import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { Analytics } from '../src/components/analytics';
import { FeedbackWidget } from '../src/components/feedback-widget';
import { publicSiteUrl } from '../src/lib/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: 'Ovalia — Todo el rugby en un solo lugar',
  description: 'Resultados, torneos, prodes, juegos e historias del rugby argentino e internacional.',
  applicationName: 'Ovalia',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'Ovalia',
    title: 'Ovalia — Todo el rugby en un solo lugar',
    description: 'Resultados, torneos e historias verificadas del rugby argentino.',
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#101b15',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <Analytics />
        <FeedbackWidget />
      </body>
    </html>
  );
}
