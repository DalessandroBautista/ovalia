// Punto único de registro de adaptadores de fuente.
// Cada hito de fuente (URBA, UAR, internacionales) agrega su registro aquí.
// Mientras no exista un adaptador automatizable, la fuente se cubre por CSV/manual.
import { registerAdapter } from './adapter-registry';
import { UrbaAdapter } from './adapters/urba/urba-adapter';

registerAdapter('urba', () => new UrbaAdapter());

export {};
