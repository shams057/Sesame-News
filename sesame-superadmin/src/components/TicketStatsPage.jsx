import { useCallback, useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import './TicketStatsPage.css';

const PERIODS = [
  ['today', 'Aujourd’hui'],
  ['7days', '7 derniers jours'],
  ['month', 'Ce mois-ci'],
  ['semester', '6 derniers mois'],
  ['year', '12 derniers mois'],
];

const DEPARTMENTS = [
  'Service Scolarité', 'Service Stage', 'Département licence Informatique',
  'Département Management', 'Département Prepa_Ingénieur', 'Département FTA',
  'Service IT', 'Service qualité', 'Service coopération international',
  'Service Marketing', 'Service Admission', 'Service Finance', 'Service Student Success',
];

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{children}</span>;
}

function MetricCard({ icon, label, value, detail, tone = 'blue-icon' }) {
  return (
    <article className="stats-card metric-card">
      <div className="metric-main">
        <div><span className="stats-label">{label}</span><h3 className="metric-value">{value}</h3></div>
        <div className={`metric-icon ${tone}`}><Icon>{icon}</Icon></div>
      </div>
      <div className="metric-footer"><span className="metric-detail">{detail}</span></div>
    </article>
  );
}

export default function TicketStatsPage({ onNavigate }) {
  const [period, setPeriod] = useState('month');
  const [department, setDepartment] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadStats = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const response = await api.get('/ticket-statistics', { params: { period, department: department || undefined } });
      setStats(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossible de charger les statistiques depuis la base de données.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, department]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const exportPDF = () => {
    if (!stats) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Rapport Statistiques Tickets', 14, 18);
    doc.setFontSize(10);
    doc.text(`Période : ${PERIODS.find(([key]) => key === period)?.[1]} · Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 26);
    doc.text(`Total : ${stats.total} · Ouverts : ${stats.open} · Fermés : ${stats.closed} · Résolution : ${stats.resolutionRate}%`, 14, 34);
    autoTable(doc, {
      startY: 42,
      head: [['Département', 'Tickets', 'Ouverts', 'Fermés']],
      body: stats.departments.map((item) => [item.department, item.total, item.open, item.closed]),
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Ticket', 'Statut', 'Service', 'Créé le']],
      body: stats.recent.map((item) => [item.title, item.status === 'closed' ? 'Fermé' : 'Ouvert', item.department, new Date(item.createdAt || item.openedAt).toLocaleDateString('fr-FR')]),
    });
    doc.save(`Rapport_Tickets_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const total = stats?.total || 0;
  const maxTimelineValue = Math.max(1, ...(stats?.timeline || []).flatMap((item) => [item.opened, item.closed]));

  return (
    <div className="ticket-stats-page">
      <header className="stats-topbar">
        <div><h1>Statistiques Tickets</h1><p>Statistiques calculées à partir des tickets enregistrés en base de données.</p></div>
        <div className="stats-actions">
          <div className="date-chip"><Icon>calendar_today</Icon>{new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}</div>
          <button className="primary-button" type="button" onClick={exportPDF} disabled={!stats}>Exporter rapport</button>
        </div>
      </header>

      <main className="stats-workspace">
        <section className="filter-bar">
          <div className="period-picker">
            <span className="stats-overline">Période :</span>
            {PERIODS.map(([key, label]) => <button key={key} type="button" className={period === key ? 'filter-choice active' : 'filter-choice'} onClick={() => setPeriod(key)}>{label}</button>)}
          </div>
          <div className="filter-actions">
            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filtrer par département">
              <option value="">Tous les départements</option>
              {DEPARTMENTS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button className="secondary-button" type="button" onClick={() => loadStats(true)} disabled={refreshing}>
              <Icon className={refreshing ? 'spin' : ''}>refresh</Icon>{refreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
          </div>
        </section>

        {error && <div role="alert" className="stats-card panel" style={{ color: '#b91c1c' }}>{error}</div>}
        {loading && !stats ? <div className="stats-card panel">Chargement des statistiques…</div> : null}
        {stats && <>
          <section className="metric-grid">
            <MetricCard icon="confirmation_number" label="Tickets sur la période" value={stats.total} detail="Créés pendant la période sélectionnée" />
            <MetricCard icon="pending_actions" label="Ouverts" value={stats.open} detail="En attente de traitement" tone="amber-icon" />
            <MetricCard icon="task_alt" label="Fermés" value={stats.closed} detail="Clôturés pendant la période" tone="green-icon" />
            <MetricCard icon="analytics" label="Taux de résolution" value={`${stats.resolutionRate}%`} detail={`${stats.closed} fermés sur ${stats.total} tickets`} tone="green-icon" />
          </section>

          <section className="analytics-grid">
            <div className="analytics-main">
              <article className="stats-card panel">
                <div className="panel-header"><div><h2>Création des tickets</h2><p className="panel-description">Tickets ouverts et fermés enregistrés par date.</p></div><div className="legend"><span><i className="red-dot" />Ouverts</span><span><i className="green-dot" />Fermés</span></div></div>
                {stats.timeline.length ? <div className="bar-chart">
                  {stats.timeline.map((bucket) => <div className="bar-group" key={bucket.date} title={`${bucket.opened} ouverts · ${bucket.closed} fermés`}>
                    <div className="bars">
                      <span className="received-bar" style={{ height: `${Math.max(2, (bucket.opened / maxTimelineValue) * 100)}%` }} />
                      <span className="resolved-bar" style={{ height: `${Math.max(2, (bucket.closed / maxTimelineValue) * 100)}%` }} />
                    </div><span>{new Date(`${bucket.date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                  </div>)}
                </div> : <p className="panel-description">Aucun ticket sur cette période.</p>}
              </article>

              <article className="stats-card panel">
                <div className="panel-header"><div><h2>Tickets par département</h2><p className="panel-description">Volumes réellement enregistrés.</p></div></div>
                {stats.departments.length ? <div className="department-list">
                  {stats.departments.map((item) => <div className="department-row" key={item.department}>
                    <div className="department-heading"><div className="department-name"><strong>{item.department}</strong></div><div className="department-values"><strong>{item.total} tickets</strong><span>{item.open} ouverts</span><b>{item.closed} fermés</b></div></div>
                    <div className="progress-track"><span style={{ width: `${total ? (item.total / total) * 100 : 0}%` }} /></div>
                  </div>)}
                </div> : <p className="panel-description">Aucun ticket sur cette période.</p>}
              </article>
            </div>

            <div className="analytics-side">
              <article className="stats-card panel">
                <h2>Nature des demandes</h2><p className="panel-description">Catégories estimées depuis les titres et descriptions des tickets.</p>
                <div className="type-list">{stats.categories.map((item) => <div className="type-row" key={item.label}>
                  <div><span>{item.label}</span><strong>{item.count}</strong></div>
                  <div className="progress-track"><span style={{ width: `${total ? (item.count / total) * 100 : 0}%` }} /></div>
                </div>)}</div>
              </article>
              <article className="stats-card panel">
                <div className="activity-heading"><h2>Activité récente</h2><button type="button" onClick={() => onNavigate?.('tickets')}>Voir historique</button></div>
                {stats.recent.length ? <div className="activity-list">{stats.recent.map((item) => <div className="activity-item" key={item.id}>
                  <div className="activity-top"><strong>#{item.id}</strong><span className={`status-pill ${item.status === 'closed' ? 'resolved' : 'progress'}`}>{item.status === 'closed' ? 'Fermé' : 'Ouvert'}</span></div>
                  <p>{item.title}</p><div className="activity-meta"><span>{item.department}</span><span>{new Date(item.createdAt || item.openedAt).toLocaleDateString('fr-FR')}</span></div>
                </div>)}</div> : <p className="panel-description">Aucun ticket récent.</p>}
              </article>
            </div>
          </section>
        </>}
      </main>
    </div>
  );
}
