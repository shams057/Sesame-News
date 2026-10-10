import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import UsersPage from '../components/UsersPage';
import NewsPage from '../components/NewsPage';
import TicketsPage from '../components/TicketsPage';
import TicketStatsPage from '../components/TicketStatsPage';

const PAGE_TITLES = {
  news: 'Actualités',
  users: 'Gestion Utilisateurs',
  'ticket-stats': 'Statistiques Tickets',
  tickets: 'Historique Tickets',
};

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('news');
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = collapsed ? 68 : 244;

  const renderContent = () => {
    switch (activeNav) {
      case 'news':         return <NewsPage />;
      case 'users':        return <UsersPage />;
      case 'ticket-stats': return <TicketStatsPage />;
      case 'tickets':      return <TicketsPage />;
      default:             return <NewsPage />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar
        active={activeNav}
        onChange={setActiveNav}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      {/* Main content — offset by sidebar width */}
      <main
        style={{
          flex: 1,
          marginLeft: sidebarWidth,
          transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
          padding: '40px 48px',
          minHeight: '100vh',
          maxWidth: `calc(100vw - ${sidebarWidth}px)`,
          overflow: 'hidden',
        }}
      >
        {/* Page header */}
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>{PAGE_TITLES[activeNav]}</h1>
          <div style={s.headerMeta}>
            <span style={s.headerDate}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Page content */}
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

const s = {
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.03em',
  },
  headerMeta: { display: 'flex', alignItems: 'center', gap: 12 },
  headerDate: {
    fontSize: 13,
    color: 'var(--text-muted)',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
};