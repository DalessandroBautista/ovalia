import { PortalHeader } from '../../src/features/portal/portal-pages';

export default function NewsPage() {
  const articles = [
    ['ANÁLISIS', 'El maul argentino encontró una nueva marcha', 'Las claves del ajuste que cambió el partido en Mendoza.'],
    ['URBA TOP 14', 'La fecha 12 promete mover la parte alta', 'SIC recibe a Hindú en el partido central del sábado.'],
    ['INTERIOR', 'Los clubes que pisan fuerte rumbo a las semifinales', 'El mapa federal entra en su tramo decisivo.']
  ];
  return <div className="portal-shell"><PortalHeader /><main className="portal-main"><p className="eyebrow">EDITORIAL</p><h1>Historias de rugby</h1><p className="portal-intro">Noticias, análisis y protagonistas de cada rincón de la cancha.</p><div className="article-grid">{articles.map(([tag,title,summary]) => <article key={title}><small>{tag}</small><h2>{title}</h2><p>{summary}</p><a href="#">Leer nota →</a></article>)}</div></main></div>;
}
