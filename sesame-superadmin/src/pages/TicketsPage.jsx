import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { errorMessage } from '../lib/api';
import { get, useAdmins, useDepartments } from '../lib/queries';
import { cleanParams, useUrlState } from '../lib/useUrlState';
import { formatDateTime, formatRelative } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorBlock, PageHeader, Pagination, SearchInput, Skeleton } from '../components/ui';
import { PriorityBadge, SlaBadge, StatusBadge } from '../components/TicketBadges';

const STATUS_FILTERS = [
  ['active', 'À traiter'],
  ['open', 'Ouverts'],
  ['in_progress', 'En cours'],
  ['closed', 'Fermés'],
  ['all', 'Tous'],
];

export default function TicketsPage() {
  const { account } = useAuth();
  const [filters, setFilters] = useUrlState({
    status: 'active', departmentId: '', priority: '', assigned: '', unread: '', q: '', sort: '-createdAt', page: 0,
  });
  const departments = useDepartments();
  const admins = useAdmins();
  const tickets = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => get('/tickets', cleanParams({ ...filters, status: filters.status === 'all' ? '' : filters.status, pageSize: 20 })),
    placeholderData: keepPreviousData,
  });

  const data = tickets.data;
  return (
    <>
      <PageHeader
        title="Tickets"
        description={account.department ? `File du service ${account.department.name}` : 'Toutes les demandes des étudiants'}
      />

      <div className="toolbar" role="group" aria-label="Filtres">
        <div className="chips" role="group" aria-label="Statut">
          {STATUS_FILTERS.map(([value, label]) => (
            <button key={value} type="button" className="chip-toggle" aria-pressed={filters.status === value} onClick={() => setFilters({ status: value })}>
              {label}
            </button>
          ))}
        </div>
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} placeholder="Titre, description ou #numéro" label="Rechercher un ticket" />
        {!account.department ? (
          <select className="select" aria-label="Service" value={filters.departmentId} onChange={(event) => setFilters({ departmentId: event.target.value })}>
            <option value="">Tous les services</option>
            {departments.data?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        ) : null}
        <select className="select" aria-label="Priorité" value={filters.priority} onChange={(event) => setFilters({ priority: event.target.value })}>
          <option value="">Toutes priorités</option>
          <option value="urgent">Urgente</option>
          <option value="high">Haute</option>
          <option value="normal">Normale</option>
          <option value="low">Basse</option>
        </select>
        <select className="select" aria-label="Assignation" value={filters.assigned} onChange={(event) => setFilters({ assigned: event.target.value })}>
          <option value="">Tous les agents</option>
          <option value="me">Assignés à moi</option>
          <option value="unassigned">Non assignés</option>
          {admins.data?.filter((admin) => admin.id !== account.id).map((admin) => <option key={admin.id} value={admin.id}>{admin.displayName || admin.login}</option>)}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={filters.unread === 'true'} onChange={(event) => setFilters({ unread: event.target.checked ? 'true' : '' })} />
          <span>Non lus uniquement</span>
        </label>
        <select className="select" aria-label="Tri" value={filters.sort} onChange={(event) => setFilters({ sort: event.target.value })}>
          <option value="-createdAt">Plus récents</option>
          <option value="createdAt">Plus anciens</option>
          <option value="-updatedAt">Dernière activité</option>
          <option value="priority">Priorité</option>
        </select>
      </div>

      <div className="card">
        {tickets.isError ? <div className="card-body"><ErrorBlock error={errorMessage(tickets.error)} onRetry={tickets.refetch} /></div> : null}
        {tickets.isPending ? <Skeleton rows={6} /> : null}
        {data && !data.content.length ? (
          <EmptyState icon="ticket" title="Aucun ticket" description="Aucun ticket ne correspond à ces filtres." />
        ) : null}
        {data?.content.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Ticket</th>
                  <th scope="col">Étudiant</th>
                  <th scope="col">Service</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Assigné à</th>
                  <th scope="col">Créé</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <div className="row">
                        {ticket.unreadCount ? <span className="unread-dot" title={`${ticket.unreadCount} message(s) non lu(s)`} aria-label="Messages non lus" /> : null}
                        <span className="muted mono">#{ticket.id}</span>
                        <Link className="cell-title" to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                        <PriorityBadge priority={ticket.priority} hideNormal />
                        <SlaBadge ticket={ticket} />
                      </div>
                      <div className="cell-sub">{ticket.description}</div>
                    </td>
                    <td>{ticket.user?.name || <span className="muted">Compte supprimé</span>}</td>
                    <td>{ticket.department?.name}</td>
                    <td><StatusBadge status={ticket.status} /></td>
                    <td>{ticket.assignedTo?.name || <span className="muted">—</span>}</td>
                    <td title={formatDateTime(ticket.createdAt)}>{formatRelative(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data ? <Pagination page={filters.page} totalPages={data.totalPages} totalElements={data.totalElements} label="tickets" onChange={(page) => setFilters({ page }, { resetPage: false })} /> : null}
      </div>
    </>
  );
}
