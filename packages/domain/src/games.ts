export function calculateRugbyIdentity(answers: number[]) {
  const total = answers.reduce((sum, answer) => sum + answer, 0);
  const balance = answers.filter((answer) => answer === 0).length;
  return {
    profile: balance > 1 ? 'Equilibrista' : total >= 0 ? 'Estratega' : 'Atacante total',
    axis: total >= 2 ? 'territorio' : total <= -2 ? 'posesión' : 'equilibrio',
    intensity: Math.min(100, 50 + Math.abs(total) * 8)
  } as const;
}

export interface RoleAttributes { power: number; speed: number; vision: number }

export function chooseCareerOutcome(attributes: RoleAttributes): string {
  if (attributes.power >= 8) return 'Tercera línea de impacto';
  if (attributes.speed >= 8 && attributes.vision < 7) return 'Wing definidor';
  if (attributes.vision >= 7) return 'Apertura conductor';
  return 'Centro completo';
}
