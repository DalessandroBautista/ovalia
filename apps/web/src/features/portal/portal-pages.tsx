const tournamentGroups = [
  { title: 'Argentina · Buenos Aires', items: ['URBA Top 14', 'Primera A', 'Primera B', 'Primera C', 'Segunda', 'Tercera', 'Desarrollo', 'Femenino Top 9'] },
  { title: 'Argentina · Federal', items: ['Torneo del Interior A', 'Torneo del Interior B', 'Nacional de Clubes', 'Super Rugby Américas', 'Seven de la República'] },
  { title: 'Selecciones', items: ['Rugby Championship', 'Six Nations', 'Mundial', 'Mundial Femenino', 'World Rugby U20', 'SVNS'] },
  { title: 'Clubes internacionales', items: ['Top 14', 'Premiership', 'United Rugby Championship', 'Champions Cup', 'Challenge Cup'] }
];

const matchCards = [
  { competition: 'Rugby Championship', status: "EN VIVO · 64'", home: 'Argentina', away: 'Sudáfrica', score: '24 — 21' },
  { competition: 'URBA Top 14 · Fecha 12', status: 'SÁB · 15:30', home: 'SIC', away: 'Hindú', score: '—' },
  { competition: 'URBA Top 14 · Fecha 12', status: 'SÁB · 15:30', home: 'CASI', away: 'Newman', score: '—' },
  { competition: 'Rugby Championship', status: 'SÁB · 04:05', home: 'Nueva Zelanda', away: 'Australia', score: '—' }
];

export function PortalHeader() {
  return (
    <header className="portal-header">
      <a className="portal-brand" href="/">◒ <span>OVALIA</span></a>
      <nav aria-label="Navegación principal">
        <a href="/partidos">Partidos</a><a href="/torneos">Torneos</a><a href="/prodes">Prodes</a><a href="/juegos">Juegos</a><a href="/noticias">Noticias</a>
      </nav>
      <a className="portal-login" href="/ingresar">Ingresar</a>
    </header>
  );
}

function Frame({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <div className="portal-shell"><PortalHeader /><main className="portal-main"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="portal-intro">{intro}</p>{children}</main></div>;
}

export function MatchesPage() {
  return (
    <Frame eyebrow="FIXTURES Y RESULTADOS" title="Centro de partidos" intro="La agenda completa del rugby argentino e internacional, con actualización en vivo.">
      <div className="portal-toolbar"><button>←</button><strong>HOY · JUEVES 23 JUL</strong><button>→</button></div>
      <div className="portal-list">{matchCards.map((match) => <a className="portal-match" href={`/partidos/${match.home === 'Argentina' ? 'argentina-sudafrica' : 'detalle'}`} key={match.home}><small>{match.competition}</small><span className={match.status.startsWith('EN VIVO') ? 'live-text' : ''}>{match.status}</span><div><b>{match.home}</b><strong>{match.score}</strong><b>{match.away}</b></div></a>)}</div>
    </Frame>
  );
}

export function TournamentsPage() {
  return (
    <Frame eyebrow="COBERTURA" title="Todos los torneos" intro="Desde cada unión argentina hasta las grandes competencias de selecciones y clubes.">
      <div className="tournament-grid">{tournamentGroups.map((group) => <section className="tournament-group" key={group.title}><h2>{group.title}</h2>{group.items.map((item) => <a href={item === 'URBA Top 14' ? '/torneos/urba-top-14' : '#'} key={item}><span>{item}</span><i>→</i></a>)}</section>)}</div>
    </Frame>
  );
}

export function PredictionPage() {
  return (
    <Frame eyebrow="JUGÁ LA FECHA" title="Prode Ovalia" intro="Pronosticá resultados, sumá puntos y competí en rankings generales o privados.">
      <section className="prediction-panel"><div className="prediction-heading"><div><small>URBA TOP 14</small><h2>Fecha 12</h2></div><span>Cierra el sábado · 15:25</span></div>{[['SIC','Hindú'],['CASI','Newman'],['Alumni','CUBA']].map(([home,away]) => <div className="prediction-row" key={home}><b>{home}</b><label><span>Local</span><input aria-label={`Goles de ${home}`} inputMode="numeric" defaultValue="0" /></label><em>—</em><label><span>Visitante</span><input aria-label={`Goles de ${away}`} inputMode="numeric" defaultValue="0" /></label><b>{away}</b></div>)}<button className="primary-action" type="button">Guardar pronósticos</button><p className="fine-print">5 pts resultado exacto · 3 pts diferencia exacta · 1 pt ganador</p></section>
    </Frame>
  );
}

export function TournamentPage() {
  const rows = [['1','SIC','11','43'],['2','Hindú','11','40'],['3','Newman','11','37'],['4','Alumni','11','36'],['5','CUBA','11','31']];
  return <Frame eyebrow="ARGENTINA · BUENOS AIRES" title="URBA Top 14" intro="Temporada 2026 · resultados, calendario, posiciones, estadísticas y prode."><nav className="tab-bar"><a href="#resultados">Resultados</a><a className="active" href="#posiciones">Posiciones</a><a href="#calendario">Calendario</a><a href="/prodes">Prode</a></nav><section className="table-card"><h2>Tabla de posiciones</h2><div className="standing-row standing-head"><span>#</span><span>Equipo</span><span>PJ</span><span>PTS</span></div>{rows.map((row) => <div className="standing-row" key={row[1]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}</section></Frame>;
}

export function MatchDetailPage() {
  return <Frame eyebrow="RUGBY CHAMPIONSHIP · FECHA 3" title="Argentina 24 — 21 Sudáfrica" intro="En vivo · segundo tiempo · 64 minutos"><section className="match-detail"><div className="possession"><span>ARG 57%</span><i><b /></i><span>RSA 43%</span></div><h2>Minuto a minuto</h2>{[[62,'TRY','M. Carreras','Argentina'],[55,'PENAL','H. Pollard','Sudáfrica'],[47,'CAMBIO','L. González por M. Kremer','Argentina'],[40,'SEGUNDO TIEMPO','','']].map(([minute,type,player,team]) => <article className="timeline-event" key={`${minute}-${type}`}><time>{minute}&apos;</time><strong>{type}</strong><span>{player}</span><small>{team}</small></article>)}</section></Frame>;
}
