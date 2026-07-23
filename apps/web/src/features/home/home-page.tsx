const liveMatches = [
  { code: 'TRC', minute: "68'", home: 'ARG', away: 'RSA', homeScore: 27, awayScore: 24 },
  { code: 'URBA', minute: "54'", home: 'SIC', away: 'CASI', homeScore: 18, awayScore: 13 },
  { code: 'TOP 14', minute: 'HT', home: 'TLS', away: 'UBB', homeScore: 12, awayScore: 17 },
  { code: 'URC', minute: "31'", home: 'LEI', away: 'MUN', homeScore: 10, awayScore: 7 },
];

const agenda = [
  {
    tournament: 'URBA Top 14',
    meta: 'Buenos Aires · Fecha 17',
    matches: [
      { home: 'Newman', away: 'Alumni', time: '15:30', homeCode: 'NEW', awayCode: 'ALU' },
      { home: 'Hindú', away: 'SIC', time: '15:30', homeCode: 'HIN', awayCode: 'SIC' },
      { home: 'CASI', away: 'CUBA', time: '16:10', homeCode: 'CAS', awayCode: 'CUB' },
    ],
  },
  {
    tournament: 'Rugby Championship',
    meta: 'Internacional · Fecha 4',
    matches: [
      { home: 'Nueva Zelanda', away: 'Australia', time: '04:05', homeCode: 'NZL', awayCode: 'AUS' },
      { home: 'Argentina', away: 'Sudáfrica', time: '18:00', homeCode: 'ARG', awayCode: 'RSA' },
    ],
  },
];

function BallMark() {
  return (
    <span className="ball-mark" aria-hidden="true">
      <span />
    </span>
  );
}

function LiveRail() {
  return (
    <section className="live-rail" aria-label="Partidos en vivo">
      <div className="live-rail__inner">
        <div className="live-rail__label"><i /> EN VIVO</div>
        <div className="live-rail__track">
          {liveMatches.map((match) => (
            <article className="rail-match" key={`${match.home}-${match.away}`}>
              <span className="rail-match__competition">{match.code}</span>
              <b>{match.minute}</b>
              <span>{match.home}</span><strong>{match.homeScore}</strong>
              <span>{match.away}</span><strong>{match.awayScore}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Ovalia, inicio">
        <BallMark /> <span>OVALIA</span>
      </a>
      <nav className="desktop-nav" aria-label="Navegación principal">
        <a className="is-active" href="/partidos">Partidos</a>
        <a href="/torneos">Torneos</a>
        <a href="/prodes">Prodes</a>
        <a href="/juegos">Juegos</a>
        <a href="/noticias">Noticias</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button" type="button" aria-label="Buscar">⌕</button>
        <button className="language-button" type="button">ES <span>⌄</span></button>
        <a className="login-button" href="/ingresar">Ingresar</a>
      </div>
    </header>
  );
}

function FeaturedMatch() {
  return (
    <article className="featured-match">
      <div className="featured-match__topline">
        <span><i /> EN VIVO · 68&apos;</span>
        <span>RUGBY CHAMPIONSHIP</span>
      </div>
      <div className="featured-match__score">
        <div className="featured-team">
          <span className="crest crest--arg">ARG</span>
          <div><small>LOS PUMAS</small><h2>Argentina</h2></div>
        </div>
        <div className="scoreboard"><b>27</b><span>—</span><b>24</b></div>
        <div className="featured-team featured-team--away">
          <div><small>SPRINGBOKS</small><h2>Sudáfrica</h2></div>
          <span className="crest crest--rsa">RSA</span>
        </div>
      </div>
      <div className="featured-match__events">
        <span>TRY · M. Carreras 62&apos;</span>
        <span>Territorio ARG 57%</span>
      </div>
      <a className="match-link" href="/partidos/argentina-sudafrica">Seguir minuto a minuto <span>↗</span></a>
    </article>
  );
}

function Hero() {
  return (
    <section className="hero" id="inicio">
      <div className="hero__copy">
        <p className="eyebrow">TODO EL RUGBY. UN SOLO LUGAR.</p>
        <h1>Donde el rugby pasa, <em>Ovalia lo cuenta.</em></h1>
        <p className="hero__intro">Resultados, historias y comunidad. Desde tu club hasta el escenario mundial.</p>
        <div className="hero__stats" aria-label="Cobertura de Ovalia">
          <div><strong>26</strong><span>torneos</span></div>
          <div><strong>184</strong><span>clubes</span></div>
          <div><strong>6</strong><span>en vivo</span></div>
        </div>
      </div>
      <FeaturedMatch />
    </section>
  );
}

function DatePicker() {
  const days = [
    ['MIÉ', '22'], ['JUE', '23'], ['VIE', '24'], ['SÁB', '25'], ['DOM', '26'], ['LUN', '27'], ['MAR', '28'],
  ];
  return (
    <div className="date-picker" aria-label="Seleccionar fecha">
      <button type="button" aria-label="Fecha anterior">←</button>
      {days.map(([day, date]) => (
        <button className={date === '23' ? 'is-selected' : ''} type="button" key={date}>
          <span>{day}</span><b>{date}</b>{date === '23' && <small>HOY</small>}
        </button>
      ))}
      <button type="button" aria-label="Fecha siguiente">→</button>
    </div>
  );
}

function MatchRow({ match }: { match: (typeof agenda)[number]['matches'][number] }) {
  return (
    <a className="match-row" href="/partidos/detalle">
      <div className="match-row__team"><span className="mini-crest">{match.homeCode}</span><b>{match.home}</b></div>
      <time>{match.time}</time>
      <div className="match-row__team match-row__team--away"><b>{match.away}</b><span className="mini-crest">{match.awayCode}</span></div>
      <span className="row-arrow">›</span>
    </a>
  );
}

function Agenda() {
  return (
    <section className="agenda" id="partidos">
      <div className="section-heading">
        <div><p className="eyebrow">AGENDA</p><h2>Partidos de hoy</h2></div>
        <a href="/partidos">Ver calendario completo <span>↗</span></a>
      </div>
      <DatePicker />
      {agenda.map((group) => (
        <article className="competition" key={group.tournament}>
          <header>
            <div className="competition__identity"><span className="competition__mark">XV</span><div><h3>{group.tournament}</h3><p>{group.meta}</p></div></div>
            <a href="/torneos">Ver torneo <span>↗</span></a>
          </header>
          <div>{group.matches.map((match) => <MatchRow match={match} key={`${match.home}-${match.away}`} />)}</div>
        </article>
      ))}
    </section>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <section className="prode-card" id="prodes">
        <div className="prode-card__art"><span>?</span><span>5</span><span>3</span></div>
        <p className="eyebrow">PRODE · FECHA 17</p>
        <h2>Tu lectura del partido también juega.</h2>
        <p>Pronosticá la fecha del URBA Top 14 y medite con toda la comunidad.</p>
        <div className="prode-card__meta"><span>Cierra en</span><b>01:42:18</b></div>
        <a href="/prodes">Hacer mis pronósticos <span>→</span></a>
      </section>
      <section className="news-card" id="noticias">
        <div className="news-card__label">ANÁLISIS</div>
        <div className="news-card__field" aria-hidden="true"><i /><i /><i /></div>
        <div className="news-card__body">
          <p className="eyebrow">LA PIZARRA</p>
          <h3>El maul argentino encontró una nueva marcha</h3>
          <p>Las claves del ajuste que cambió el partido en Mendoza.</p>
          <span>Por Equipo Ovalia · 6 min</span>
        </div>
      </section>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación móvil">
      <a className="is-active" href="#inicio"><span>⌂</span>Inicio</a>
      <a href="/partidos"><span>◷</span>Partidos</a>
      <a href="/prodes"><span>◎</span>Prode</a>
      <a href="/juegos"><span>◇</span>Juegos</a>
      <a href="/ingresar"><span>○</span>Perfil</a>
    </nav>
  );
}

export function HomePage() {
  return (
    <>
      <LiveRail />
      <div className="page-shell">
        <Header />
        <main>
          <Hero />
          <div className="content-grid">
            <Agenda />
            <Sidebar />
          </div>
        </main>
        <footer className="site-footer"><span><BallMark /> OVALIA</span><p>El rugby entero, en un solo pulso.</p><small>© 2026 Ovalia</small></footer>
      </div>
      <BottomNav />
    </>
  );
}
