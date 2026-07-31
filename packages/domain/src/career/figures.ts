export type CareerShape = 'club-entero' | 'salto-joven' | 'tardio' | 'itinerante';

export interface CareerFigure {
  /** Nombre público, usado sólo en su faceta deportiva. */
  name: string;
  shape: CareerShape;
  /** Describe el TIPO de trayectoria, nunca estadísticas concretas. */
  description: string;
}

export const CAREER_FIGURES: CareerFigure[] = [
  {
    name: 'Hugo Porta',
    shape: 'club-entero',
    description: 'una carrera construida desde el club, siendo referente durante años',
  },
  {
    name: 'Agustín Pichot',
    shape: 'salto-joven',
    description: 'un salto temprano al exterior para competir al máximo nivel',
  },
  {
    name: 'Felipe Contepomi',
    shape: 'itinerante',
    description: 'una trayectoria larga por varios clubes y países',
  },
  {
    name: 'Ledesma',
    shape: 'tardio',
    description: 'un reconocimiento que llegó con los años y la constancia',
  },
];

export function figureForShape(shape: CareerShape): CareerFigure {
  return CAREER_FIGURES.find((figure) => figure.shape === shape) ?? CAREER_FIGURES[0]!;
}
