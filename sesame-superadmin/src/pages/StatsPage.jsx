import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { downloadFile, errorMessage } from '../lib/api';
import { get, useDepartments } from '../lib/queries';
import { cleanParams, useUrlState } from '../lib/useUrlState';
import { formatDate, formatDuration, formatRelative, PRIORITY } from '../lib/format';
import { bucketLabel, exportStatsPdf } from '../lib/statsPdf';
import { useAuth } from '../auth/AuthContext';
import { Button, EmptyState, ErrorBlock, PageHeader, Skeleton, useToast } from '../components/ui';
import { PriorityBadge, StatusBadge } from '../components/TicketBadges';

function Kpi({ label, value, detail }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {detail ? <div className="detail">{detail}</div> : null}
    </div>
  );
}

function Timeline({ stats }) {
  const max = Math.max(1, ...stats.timeline.flatMap((bucket) => [bucket.created, bucket.closed]));
  const labelEvery = Math.ceil(stats.timeline.length / 15);
  return (
    <div className="chart" role="img" aria-label={`Tickets créés et fermés par ${stats.granularity === 'day' ? 'jour' : 'mois'}`}>
      {stats.timeline.map((bucket, index) => (
        <div className="chart-group" key={bucket.key} title={`${bucketLabel(bucket.key, stats.granularity)} : ${bucket.created} créé(s), ${bucket.closed} fermé(s)`}>
          <div className="chart-bars">
            <span className="bar-created" style={{ height: `${(bucket.created / max) * 100}%` }} />
            <span className="bar-closed" style={{ height: `${(bucket.closed / max) * 100}%` }} />
          </div>
          <span className="chart-label">{index % labelEvery === 0 ? bucketLabel(bucket.key, stats.granularity) : ' '}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { account } = useAuth();
  const toast = useToast();
  const departments = useDepartments();
  const [filters, setFilters] = useUrlState({ period: 'month', departmentId: '' });
  const periods = useQuery({ queryKey: ['stats-periods'], queryFn: () => get('/stats/periods'), staleTime: Infinity });
  const stats = useQuery({
    queryKey: ['stats', filters],
    queryFn: () => get('/stats/tickets', cleanParams(filters)),
    placeholderData: keepPreviousData,
  });
  const s = stats.data;
  const departmentName = account.department?.name || departments.data?.find((department) => department.id === Number(filters.departmentId))?.name;

  const exportCsv = () => downloadFile(`/stats/tickets.csv?${new URLSearchParams(cleanParams(filters))}`, 'tickets.csv')
    .catch((error) => toast.error(errorMessage(error)));

  return (
    <>
      <PageHeader
        title="Statistiques"
        description={s ? `${s.periodLabel} · du ${formatDate(s.startDate)} au ${formatDate(s.endDate)} · fuseau ${s.timeZone}` : 'Indicateurs du support étudiant'}
        actions={(
          <>
            <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!s}>CSV</Button>
            <Button icon="download" onClick={() => exportStatsPdf(s, departmentName).catch(() => toast.error('Export PDF impossible'))} disabled={!s}>Rapport PDF</Button>
          </>
        )}
      />
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Période">
          {periods.data?.map((period) => (
            <button key={period.key} type="button" className="chip-toggle" aria-pressed={filters.period === period.key} onClick={() => setFilters({ period: period.key }, { resetPage: false })}>{period.label}</button>
          ))}
        </div>
        {!account.department ? (
          <select className="select" aria-label="Service" value={filters.departmentId} onChange={(event) => setFilters({ departmentId: event.target.value }, { resetPage: false })}>
            <option value="">Tous les services</option>
            {departments.data?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        ) : null}
      </div>

      {stats.isError ? <ErrorBlock error={errorMessage(stats.error)} onRetry={stats.refetch} /> : null}
      {stats.isPending ? <Skeleton rows={3} height={90} /> : null}
      {s ? (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-kpi">
            <Kpi label="Tickets créés" value={s.created.total} detail={`${s.created.open} ouverts · ${s.created.in_progress} en cours · ${s.created.closed} fermés`} />
            <Kpi label="Fermés sur la période" value={s.closedInPeriod} detail="Selon la date de fermeture" />
            <Kpi label="Déjà résolus" value={`${s.resolvedShare} %`} detail="des tickets créés sur la période" />
            <Kpi label="En attente" value={s.backlog.total} detail={s.backlog.oldestCreatedAt ? `Le plus ancien : ${formatRelative(s.backlog.oldestCreatedAt)}` : 'Aucun ticket en attente'} />
            <Kpi label="Délai de 1ʳᵉ réponse" value={formatDuration(s.firstResponseTime.averageHours)} detail={`médiane ${formatDuration(s.firstResponseTime.medianHours)}`} />
            <Kpi label="Délai de résolution" value={formatDuration(s.resolutionTime.averageHours)} detail={`médiane ${formatDuration(s.resolutionTime.medianHours)}`} />
            <Kpi label="Satisfaction" value={s.satisfaction.average ? `${s.satisfaction.average}/5` : '—'} detail={`${s.satisfaction.count} avis d’étudiants`} />
          </div>

          <div className="grid grid-2">
            <div className="stack" style={{ gap: 16 }}>
              <section className="card">
                <div className="card-header">
                  <div><h2>Évolution</h2><p>Tickets créés (date de création) et fermés (date de fermeture).</p></div>
                  <div className="legend"><span><i className="bar-created" />Créés</span><span><i className="bar-closed" />Fermés</span></div>
                </div>
                {s.created.total || s.closedInPeriod ? <Timeline stats={s} /> : <EmptyState icon="chart" title="Aucune activité" description="Aucun ticket créé ni fermé sur cette période." />}
              </section>

              <section className="card">
                <div className="card-header"><div><h2>Par service</h2><p>Statut actuel des tickets créés sur la période.</p></div></div>
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table className="table">
                    <thead><tr><th scope="col">Service</th><th scope="col">Créés</th><th scope="col">Ouverts</th><th scope="col">En cours</th><th scope="col">Fermés</th><th scope="col">Fermés (période)</th><th scope="col">Résolution moy.</th></tr></thead>
                    <tbody>
                      {s.departments.map((row) => (
                        <tr key={row.departmentId}>
                          <td><strong>{row.department}</strong><div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${s.created.total ? (row.created / s.created.total) * 100 : 0}%` }} /></div></td>
                          <td>{row.created}</td><td>{row.open}</td><td>{row.inProgress}</td><td>{row.closed}</td><td>{row.closedInPeriod}</td>
                          <td>{formatDuration(row.averageResolutionHours)}</td>
                        </tr>
                      ))}
                      {!s.departments.length ? <tr><td colSpan={7} className="muted">Aucune donnée.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="stack" style={{ gap: 16 }}>
              <section className="card card-body stack">
                <h2>Priorités</h2>
                {s.priorities.map((row) => (
                  <div key={row.priority}>
                    <div className="row"><PriorityBadge priority={row.priority} /><span className="spacer" /><strong>{row.count}</strong></div>
                    <div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${s.created.total ? (row.count / s.created.total) * 100 : 0}%` }} /></div>
                  </div>
                ))}
                <p className="muted small">Répartition des {s.created.total} tickets créés ({Object.values(PRIORITY).map((p) => p.label.toLowerCase()).join(', ')}).</p>
              </section>

              <section className="card card-body stack">
                <h2>Agents</h2>
                {s.agents.length ? s.agents.map((row) => (
                  <div className="row" key={row.agentId || 0}>
                    <span>{row.agent}</span><span className="spacer" />
                    <span className="muted small">{formatDuration(row.averageResolutionHours)} moy.</span>
                    <strong>{row.closed}</strong>
                  </div>
                )) : <p className="muted">Aucun ticket résolu sur la période.</p>}
              </section>

              <section className="card card-body stack">
                <div className="row"><h2>Derniers tickets</h2><span className="spacer" /><Link to="/tickets?status=all" className="btn btn-ghost btn-sm">Tout voir</Link></div>
                {s.recent.length ? s.recent.map((ticket) => (
                  <Link key={ticket.id} to={`/tickets/${ticket.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="row"><span className="muted mono">#{ticket.id}</span><strong className="cell-title">{ticket.title}</strong></div>
                    <div className="row small muted"><StatusBadge status={ticket.status} />{ticket.department} · {formatRelative(ticket.createdAt)}</div>
                  </Link>
                )) : <p className="muted">Aucun ticket sur la période.</p>}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
