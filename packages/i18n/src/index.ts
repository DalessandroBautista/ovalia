export const supportedLocales = ['es', 'en', 'pt'] as const;
export type Locale = (typeof supportedLocales)[number];

const messages = {
  es: { live: 'En vivo', matches: 'Partidos', standings: 'Posiciones', predictions: 'Prode', news: 'Noticias' },
  en: { live: 'Live', matches: 'Matches', standings: 'Standings', predictions: 'Predictions', news: 'News' },
  pt: { live: 'Ao vivo', matches: 'Partidas', standings: 'Classificação', predictions: 'Palpites', news: 'Notícias' }
} as const;

export function translate(locale: Locale, key: keyof (typeof messages)['es']): string {
  return messages[locale][key];
}
