import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ovalia',
    short_name: 'Ovalia',
    description: 'Todo el rugby en un solo lugar.',
    start_url: '/',
    display: 'standalone',
    background_color: '#101b15',
    theme_color: '#d7ff45',
    lang: 'es',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
