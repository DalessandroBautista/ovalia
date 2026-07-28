// Punto único de registro de adaptadores de fuente.
// Cada hito de fuente (URBA, UAR, internacionales) agrega su registro aquí.
// Mientras no exista un adaptador automatizable, la fuente se cubre por CSV/manual.
import { registerAdapter } from './adapter-registry';
import { UrbaAdapter } from './adapters/urba/urba-adapter';
import { HighlightlyIngestAdapter } from './adapters/highlightly/highlightly-adapter';
import { HighlightlyClient } from './adapters/highlightly/highlightly-client';

registerAdapter('urba', () => new UrbaAdapter());
registerAdapter('highlightly-ingest', () => {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  if (!apiKey) throw new Error('HIGHLIGHTLY_API_KEY requerido');
  return new HighlightlyIngestAdapter(new HighlightlyClient({ apiKey }));
});

export {};
