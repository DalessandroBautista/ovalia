import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Ovalia — Todo el rugby en un solo lugar',
  description: 'Resultados, torneos, prodes, juegos e historias del rugby argentino e internacional.',
  applicationName: 'Ovalia',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#101b15',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
