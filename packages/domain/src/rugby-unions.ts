export interface RugbyUnionDefinition {
  slug: string;
  name: string;
  kind: 'union';
  countryCode: 'AR';
}

export const ARGENTINA_RUGBY_UNIONS = [
  { slug: 'alto-valle', name: 'Unión de Rugby del Alto Valle', kind: 'union', countryCode: 'AR' },
  { slug: 'andina', name: 'Unión Andina de Rugby', kind: 'union', countryCode: 'AR' },
  { slug: 'austral', name: 'Unión de Rugby Austral', kind: 'union', countryCode: 'AR' },
  { slug: 'urba', name: 'Unión de Rugby de Buenos Aires', kind: 'union', countryCode: 'AR' },
  { slug: 'valle-del-chubut', name: 'Unión de Rugby del Valle de Chubut', kind: 'union', countryCode: 'AR' },
  { slug: 'cordoba', name: 'Unión Cordobesa de Rugby', kind: 'union', countryCode: 'AR' },
  { slug: 'cuyo', name: 'Unión de Rugby de Cuyo', kind: 'union', countryCode: 'AR' },
  { slug: 'entrerriana', name: 'Unión Entrerriana de Rugby', kind: 'union', countryCode: 'AR' },
  { slug: 'formosa', name: 'Unión de Rugby de Formosa', kind: 'union', countryCode: 'AR' },
  { slug: 'jujuy', name: 'Unión Jujeña de Rugby', kind: 'union', countryCode: 'AR' },
  { slug: 'lagos-del-sur', name: 'Unión de Rugby de Los Lagos del Sur', kind: 'union', countryCode: 'AR' },
  { slug: 'mar-del-plata', name: 'Unión de Rugby de Mar del Plata', kind: 'union', countryCode: 'AR' },
  { slug: 'misiones', name: 'Unión de Rugby de Misiones', kind: 'union', countryCode: 'AR' },
  { slug: 'nordeste', name: 'Unión de Rugby del Nordeste', kind: 'union', countryCode: 'AR' },
  { slug: 'uroba', name: 'Unión de Rugby del Oeste de Buenos Aires', kind: 'union', countryCode: 'AR' },
  { slug: 'rosario', name: 'Unión de Rugby de Rosario', kind: 'union', countryCode: 'AR' },
  { slug: 'salta', name: 'Unión de Rugby de Salta', kind: 'union', countryCode: 'AR' },
  { slug: 'san-juan', name: 'Unión Sanjuanina de Rugby', kind: 'union', countryCode: 'AR' },
  { slug: 'san-luis', name: 'Unión de Rugby de San Luis', kind: 'union', countryCode: 'AR' },
  { slug: 'santa-fe', name: 'Unión Santafesina de Rugby', kind: 'union', countryCode: 'AR' },
  { slug: 'santa-cruz', name: 'Unión Santacruceña de Rugby', kind: 'union', countryCode: 'AR' },
  { slug: 'santiago-del-estero', name: 'Unión Santiagueña de Rugby', kind: 'union', countryCode: 'AR' },
  { slug: 'sur', name: 'Unión de Rugby del Sur', kind: 'union', countryCode: 'AR' },
  { slug: 'tierra-del-fuego', name: 'Unión de Rugby de Tierra del Fuego', kind: 'union', countryCode: 'AR' },
  { slug: 'tucuman', name: 'Unión de Rugby de Tucumán', kind: 'union', countryCode: 'AR' },
] as const satisfies readonly RugbyUnionDefinition[];
