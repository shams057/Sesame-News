export default function TicketStatsPage() {
  return (
    <div style={s.wrap}>
      <h2 style={s.title}>Statistiques Tickets</h2>
      <p style={s.sub}>Aperçu analytique de l'activité des tickets de support.</p>

      <div style={s.comingSoon}>
        <div style={s.iconWrap}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
            <line x1="2" y1="20" x2="22" y2="20" />
          </svg>
        </div>
        <h3 style={s.comingTitle}>Bientôt disponible</h3>
        <p style={s.comingDesc}>
          Les statistiques détaillées (tickets ouverts / fermés, temps de résolution,
          répartition par département) seront disponibles prochainement.
        </p>
      </div>
    </div>
  );
}

const s = {
  wrap: { paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', marginBottom: 6 },
  sub: { fontSize: 14, color: '#6B7280', marginBottom: 40 },
  comingSoon: {
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: 16,
    padding: '60px 40px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    maxWidth: 480,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  comingTitle: { fontSize: 17, fontWeight: 700, color: '#374151', marginBottom: 10 },
  comingDesc: { fontSize: 14, color: '#9CA3AF', lineHeight: 1.65, maxWidth: 360, margin: '0 auto' },
};
