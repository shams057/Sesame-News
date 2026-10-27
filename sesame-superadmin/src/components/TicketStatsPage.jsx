import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './TicketStatsPage.css';
import sesameLogo from '../assets/sesame-logo.png';

// ─── Helpers ────────────────────────────────────────────────────────
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h ${String(mins % 60).padStart(2, '0')}`;
  const days = Math.floor(hrs / 24);
  return `Il y a ${days}j`;
}

function mapStatus(status) {
  if (status === 'closed') return { label: 'Résolu', tone: 'resolved' };
  return { label: 'En cours', tone: 'progress' };
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 24) return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return `${days}j ${remHrs}h`;
}

/** Fetch ALL tickets across all pages */
async function fetchAllTickets() {
  const all = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const res = await api.get(`/tickets?page=${page}`);
    const data = res.data;
    all.push(...(data.content || []));
    totalPages = data.totalPages || 1;
    page++;
  }
  return all;
}

/** Filter tickets by a date range */
function filterByPeriod(tickets, periodKey) {
  const now = new Date();
  let start;

  switch (periodKey) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }
    case '7days': {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case 'semester': {
      // Sept–Feb or Mar–Aug depending on current month
      const m = now.getMonth(); // 0-indexed
      if (m >= 8) {
        // Sept onwards → semester starts Sept of current year
        start = new Date(now.getFullYear(), 8, 1);
      } else if (m <= 1) {
        // Jan-Feb → semester started Sept of previous year
        start = new Date(now.getFullYear() - 1, 8, 1);
      } else {
        // Mar-Aug → semester starts Mar
        start = new Date(now.getFullYear(), 2, 1);
      }
      break;
    }
    case 'year': {
      // Academic year: Sept of previous year if we're before Sept, else Sept of current year
      const month = now.getMonth();
      const yearStart = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      start = new Date(yearStart, 8, 1);
      break;
    }
    default:
      return tickets;
  }

  return tickets.filter((t) => new Date(t.createdAt) >= start);
}

/** Compute stats from a list of tickets */
function computeStats(tickets) {
  const total = tickets.length;
  const closed = tickets.filter((t) => t.status === 'closed').length;
  const open = total - closed;
  const resolutionRate = total > 0 ? ((closed / total) * 100).toFixed(1) : '0.0';

  // Average treatment time (only for closed tickets with openedAt and closedAt)
  const durations = tickets
    .filter((t) => t.status === 'closed' && t.openedAt && t.closedAt)
    .map((t) => new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime())
    .filter((d) => d > 0);
  const avgTreatmentMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  // Department breakdown
  const deptMap = {};
  for (const t of tickets) {
    if (!deptMap[t.department]) deptMap[t.department] = { total: 0, closed: 0 };
    deptMap[t.department].total++;
    if (t.status === 'closed') deptMap[t.department].closed++;
  }
  const departments = Object.entries(deptMap)
    .map(([name, d]) => ({
      name,
      total: d.total,
      closed: d.closed,
      share: total > 0 ? ((d.total / total) * 100).toFixed(1) : '0.0',
      resolved: d.total > 0 ? ((d.closed / d.total) * 100).toFixed(0) : '0',
    }))
    .sort((a, b) => b.total - a.total);

  return { total, closed, open, resolutionRate, avgTreatmentMs, departments };
}

/** Build bar-chart data grouped by date labels */
function computeChartBars(tickets, periodKey) {
  const now = new Date();

  // Define buckets based on period
  let buckets = []; // { label, start, end }

  switch (periodKey) {
    case 'today': {
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const pairs = [
        ['08h-10h', 8, 10], ['10h-12h', 10, 12], ['12h-14h', 12, 14],
        ['14h-16h', 14, 16], ['16h-18h', 16, 18],
      ];
      for (const [label, sh, eh] of pairs) {
        buckets.push({
          label,
          start: new Date(base.getFullYear(), base.getMonth(), base.getDate(), sh),
          end: new Date(base.getFullYear(), base.getMonth(), base.getDate(), eh),
        });
      }
      break;
    }
    case '7days': {
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        buckets.push({ label: dayNames[start.getDay()], start, end });
      }
      break;
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      for (let w = 0; w < 4; w++) {
        const start = new Date(monthStart);
        start.setDate(start.getDate() + w * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        buckets.push({ label: `Semaine ${w + 1}`, start, end });
      }
      break;
    }
    case 'semester':
    case 'year': {
      const monthLabels = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
      const m = now.getMonth();
      let startMonth, startYear, count;
      if (periodKey === 'semester') {
        count = 6;
        if (m >= 8) { startMonth = 8; startYear = now.getFullYear(); }
        else if (m <= 1) { startMonth = 8; startYear = now.getFullYear() - 1; }
        else { startMonth = 2; startYear = now.getFullYear(); }
      } else {
        count = 12;
        startYear = m >= 8 ? now.getFullYear() : now.getFullYear() - 1;
        startMonth = 8; // September
      }
      for (let i = 0; i < count; i++) {
        const mIdx = (startMonth + i) % 12;
        const yr = startYear + Math.floor((startMonth + i) / 12);
        const start = new Date(yr, mIdx, 1);
        const end = new Date(yr, mIdx + 1, 1);
        if (start > now) break;
        buckets.push({ label: monthLabels[mIdx], start, end });
      }
      break;
    }
    default:
      break;
  }

  return buckets.map((b) => {
    const inBucket = tickets.filter((t) => {
      const d = new Date(t.createdAt);
      return d >= b.start && d < b.end;
    });
    const resolved = inBucket.filter((t) => t.status === 'closed').length;
    const unresolved = inBucket.length - resolved;
    const total = inBucket.length;
    const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const unresolvedPct = total > 0 ? 100 - resolvedPct : 0;
    return [b.label, unresolvedPct, resolvedPct, unresolved, resolved];
  });
}

const PERIOD_KEYS = [
  { key: 'today', label: 'Aujourd\'hui' },
  { key: '7days', label: '7 derniers jours' },
  { key: 'month', label: 'Ce mois-ci' },
  { key: 'semester', label: 'Semestre' },
  { key: 'year', label: 'Année' },
];

const CHART_TITLES = {
  today: { title: 'Flux Horaire de la Journée', desc: 'Tickets non résolus vs Tickets résolus par tranche horaire' },
  '7days': { title: 'Évolution Quotidienne (7 derniers jours)', desc: 'Tickets non résolus vs Tickets résolus chaque jour' },
  month: { title: 'Évolution Hebdomadaire du Flux', desc: 'Tickets non résolus vs Tickets résolus sur les 4 semaines' },
  semester: { title: 'Flux Mensuel du Semestre', desc: 'Suivi mensuel des tickets non résolus vs résolus' },
  year: { title: 'Flux Annuel Global', desc: 'Historique mensuel complet des tickets non résolus vs résolus' },
};

// ─── Sub-components ─────────────────────────────────────────────────
function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function MetricCard({ icon, iconClass, label, value, suffix, detail, changeIcon = 'trending_up' }) {
  return (
    <article className="stats-card metric-card">
      <div className="metric-main">
        <div>
          <span className="stats-label">{label}</span>
          <h3 className="metric-value">{value} {suffix && <span>{suffix}</span>}</h3>
        </div>
        <div className={`metric-icon ${iconClass}`}><Icon>{icon}</Icon></div>
      </div>
      <div className="metric-footer">
        <span className="success-pill"><Icon>{changeIcon}</Icon></span>
        <span className="metric-detail">{detail}</span>
      </div>
    </article>
  );
}

function PanelHeader({ title, description, legend = false, chartLegend = false, chartUnresolvedLabel, chartResolvedLabel }) {
  return (
    <div className="panel-header">
      <div><h2>{title}</h2><p className="panel-description">{description}</p></div>
      {legend && <div className="legend"><span><i className="blue-dot" />Volume</span><span><i className="green-dot" />Résolution</span></div>}
      {chartLegend && (
        <div className="legend">
          <span><i className="red-dot" />{chartUnresolvedLabel || 'Non résolus'}</span>
          <span><i className="green-dot" />{chartResolvedLabel || 'Résolus'}</span>
        </div>
      )}
    </div>
  );
}

function Activity({ id, status, tone, title, department, time }) {
  return <div className="activity-item"><div className="activity-top"><strong>{id}</strong><span className={`status-pill ${tone}`}>{status}</span></div><p>{title}</p><div className="activity-meta"><span>{department}</span><span>{time}</span></div></div>;
}

// ─── Main Component ─────────────────────────────────────────────────
export default function TicketStatsPage({ onNavigate }) {
  const [periodKey, setPeriodKey] = useState('month');
  const [department, setDepartment] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetchAllTickets()
      .then((tickets) => setAllTickets(tickets))
      .catch(() => setAllTickets([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derive unique departments from real data
  const departmentOptions = useMemo(() => {
    const depts = [...new Set(allTickets.map((t) => t.department).filter(Boolean))].sort();
    return ['all', ...depts];
  }, [allTickets]);

  // Filter by period, then by department
  const filteredTickets = useMemo(() => {
    let tickets = filterByPeriod(allTickets, periodKey);
    if (department !== 'all') {
      tickets = tickets.filter((t) => t.department === department);
    }
    return tickets;
  }, [allTickets, periodKey, department]);

  // Compute all stats
  const stats = useMemo(() => computeStats(filteredTickets), [filteredTickets]);

  // Chart bars
  const chartBars = useMemo(() => computeChartBars(filteredTickets, periodKey), [filteredTickets, periodKey]);
  const chartTotalUnresolved = chartBars.reduce((s, b) => s + b[3], 0);
  const chartTotalResolved = chartBars.reduce((s, b) => s + b[4], 0);

  // Recent 4 tickets (regardless of filter — always global)
  const recentTickets = useMemo(() => allTickets.slice(0, 4), [allTickets]);

  // KPIs computed from real data
  const kpis = useMemo(() => [
    { icon: 'receipt_long', iconClass: 'blue-icon', label: 'Total Tickets', value: stats.total.toLocaleString('fr-FR'), suffix: 'tickets', detail: `${stats.closed} résolus · ${stats.open} en cours`, changeIcon: 'arrow_upward' },
    { icon: 'check_circle', iconClass: 'green-icon', label: 'Taux de Résolution', value: `${stats.resolutionRate}%`, suffix: '', detail: `${stats.closed} résolus sur ${stats.total}`, changeIcon: 'trending_up' },
    { icon: 'schedule', iconClass: 'blue-icon', label: 'Délai Moyen de Traitement', value: formatDuration(stats.avgTreatmentMs), suffix: '', detail: stats.avgTreatmentMs > 0 ? `Basé sur ${allTickets.filter((t) => t.status === 'closed' && t.openedAt && t.closedAt).length} tickets résolus` : 'Aucune donnée de traitement', changeIcon: 'speed' },
    { icon: 'star', iconClass: 'amber-icon', label: 'Satisfaction Étudiante (CSAT)', value: '—', suffix: '/ 5', detail: 'Aucune donnée disponible', changeIcon: 'thumb_up' },
  ], [stats, allTickets]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
    window.setTimeout(() => setRefreshing(false), 500);
  };

  const chartInfo = CHART_TITLES[periodKey] || CHART_TITLES.month;

  // ─── PDF Export ───────────────────────────────────────────────────
  const exportPDF = async () => {
    let logoDataUrl = null;
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = sesameLogo;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      logoDataUrl = canvas.toDataURL('image/png');
    } catch {
      // Fallback to text if image can't load
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 16;
    const contentW = pageW - margin * 2;
    let y = 16;

    const BLUE = [37, 99, 235];
    const DARK = [11, 28, 48];
    const MUTED = [82, 93, 128];
    const GREEN_D = [6, 95, 70];
    const WHITE = [255, 255, 255];
    const RED = [220, 38, 38];

    const addNewPageIfNeeded = (needed) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 14) {
        doc.addPage();
        y = 16;
      }
    };

    const periodLabel = PERIOD_KEYS.find((p) => p.key === periodKey)?.label || periodKey;

    // ─── Header bar ──────────────────────────────────────────────
    doc.setFillColor(...BLUE);
    doc.roundedRect(margin, y, contentW, 28, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    doc.text('Rapport Statistiques Tickets', margin + 8, y + 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Université SESAME — Généré le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, margin + 8, y + 20);

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', pageW - margin - 38, y + 3, 34, 22);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...WHITE);
      doc.text('SESAME', pageW - margin - 8, y + 16, { align: 'right' });
    }
    y += 36;

    // ─── Period & filter ─────────────────────────────────────────
    doc.setFillColor(240, 243, 250);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(`Période : ${periodLabel}  |  Filtre : ${department === 'all' ? 'Tous les départements' : department}`, margin + 4, y + 6.5);
    y += 16;

    // ─── KPI Metrics ─────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text('Indicateurs Clés', margin, y);
    y += 6;

    const cardW = (contentW - 9) / 4;
    kpis.forEach((kpi, i) => {
      const x = margin + i * (cardW + 3);
      doc.setFillColor(...WHITE);
      doc.setDrawColor(220, 228, 240);
      doc.roundedRect(x, y, cardW, 28, 2, 2, 'FD');
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, x + 3, y + 6);
      doc.setFontSize(14);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(`${kpi.value} ${kpi.suffix || ''}`.trim(), x + 3, y + 14.5);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      const detailText = doc.splitTextToSize(kpi.detail, cardW - 6);
      doc.text(detailText, x + 3, y + 22);
    });
    y += 36;

    // ─── Bar Chart ───────────────────────────────────────────────
    if (chartBars.length > 0) {
      addNewPageIfNeeded(55);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...DARK);
      doc.text(chartInfo.title, margin, y);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(chartInfo.desc, margin, y + 5);

      const legendX = pageW - margin - 80;
      doc.setFillColor(...RED);
      doc.rect(legendX, y - 3, 4, 4, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...DARK);
      doc.text(`Non résolus (${chartTotalUnresolved})`, legendX + 6, y);
      doc.setFillColor(...GREEN_D);
      doc.rect(legendX + 42, y - 3, 4, 4, 'F');
      doc.text(`Résolus (${chartTotalResolved})`, legendX + 48, y);
      y += 10;

      const chartH = 38;
      const barAreaW = contentW - 10;
      const groupW = barAreaW / chartBars.length;

      doc.setDrawColor(220, 228, 240);
      doc.line(margin, y + chartH, margin + barAreaW, y + chartH);

      chartBars.forEach(([label, unresolved, resolved, unresolvedTip, resolvedTip], i) => {
        const cx = margin + 5 + i * groupW + groupW / 2;
        const barW = groupW * 0.25;
        const rH = (unresolved / 100) * chartH;
        doc.setFillColor(...RED);
        if (rH > 0) doc.roundedRect(cx - barW - 0.5, y + chartH - rH, barW, rH, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...RED);
        doc.text(String(unresolvedTip), cx - barW / 2 - 0.5, y + chartH - rH - 2, { align: 'center' });
        const sH = (resolved / 100) * chartH;
        doc.setFillColor(...GREEN_D);
        if (sH > 0) doc.roundedRect(cx + 0.5, y + chartH - sH, barW, sH, 1, 1, 'F');
        doc.setFontSize(7.5);
        doc.setTextColor(...GREEN_D);
        doc.text(String(resolvedTip), cx + barW / 2 + 0.5, y + chartH - sH - 2, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(label, cx, y + chartH + 5, { align: 'center' });
      });
      y += chartH + 12;

      // Flow summary
      const totalRate = (chartTotalUnresolved + chartTotalResolved) > 0
        ? `${((chartTotalResolved / (chartTotalUnresolved + chartTotalResolved)) * 100).toFixed(1)}%` : '—';
      doc.setFillColor(235, 242, 255);
      doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN_D);
      doc.text(`Résolus : ${chartTotalResolved}`, margin + 5, y + 7.5);
      doc.setTextColor(220, 38, 38);
      doc.text(`Non résolus : ${chartTotalUnresolved}`, margin + 50, y + 7.5);
      doc.setTextColor(...BLUE);
      doc.text(`Taux résolution : ${totalRate}`, margin + 110, y + 7.5);
      y += 18;
    }

    // ─── Department table ────────────────────────────────────────
    if (stats.departments.length > 0) {
      addNewPageIfNeeded(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...DARK);
      doc.text('Répartition par Département & Service', margin, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Département', 'Tickets', 'Part (tickets)', 'Résolus']],
        body: stats.departments.map((d) => [
          d.name,
          d.total,
          `${d.total} / ${stats.total}`,
          `${d.closed} / ${d.total}`,
        ]),
        styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 228, 240], lineWidth: 0.2 },
        headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 250, 255] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 55 },
          1: { halign: 'right', cellWidth: 18 },
          2: { halign: 'right', cellWidth: 28 },
          3: { halign: 'right', cellWidth: 24, textColor: GREEN_D, fontStyle: 'bold' },
        },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // ─── Recent Activity ─────────────────────────────────────────
    addNewPageIfNeeded(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text('Activité Récente', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Référence', 'Statut', 'Description', 'Service', 'Temps']],
      body: recentTickets.length > 0
        ? recentTickets.map((ticket) => [
            `#TKT-${ticket.id}`,
            mapStatus(ticket.status).label,
            ticket.title,
            ticket.department,
            formatRelativeTime(ticket.createdAt),
          ])
        : [['—', '—', 'Aucun ticket récent', '—', '—']],
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 228, 240], lineWidth: 0.2 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 255] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 28 },
        1: { cellWidth: 20 },
        4: { cellWidth: 24, textColor: MUTED },
      },
    });
    y = doc.lastAutoTable.finalY + 12;

    // ─── Footer on every page ────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(220, 228, 240);
      doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text('Université SESAME — Rapport confidentiel', margin, pageH - 6);
      doc.text(`Page ${p} / ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
    }

    doc.save(`Rapport_Tickets_SESAME_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="ticket-stats-page">
      <header className="stats-topbar">
        <div>
          <h1>Statistiques Tickets</h1>
          <p>Aperçu analytique de l'activité des tickets de support et réclamations étudiantes.</p>
        </div>
        <div className="stats-actions">
          <div className="date-chip"><Icon>calendar_today</Icon>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <button className="primary-button" type="button" onClick={exportPDF}>
            Exporter rapport
          </button>
        </div>
      </header>

      <main className="stats-workspace">
        <section className="filter-bar">
          <div className="period-picker">
            <span className="stats-overline">Période :</span>
            {PERIOD_KEYS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={periodKey === item.key ? 'filter-choice active' : 'filter-choice'}
                onClick={() => setPeriodKey(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="filter-actions">
            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filtrer par département">
              <option value="all">Tous les départements ({departmentOptions.length - 1} services)</option>
              {departmentOptions.filter((d) => d !== 'all').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button className="secondary-button" type="button" onClick={handleRefresh}>
              <Icon className={refreshing ? 'spin' : ''}>refresh</Icon>{refreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
          </div>
        </section>

        {loading ? (
          <section className="metric-grid" style={{ textAlign: 'center', padding: '3rem', gridColumn: '1/-1' }}>
            <p style={{ color: '#8896a6' }}>Chargement des données…</p>
          </section>
        ) : (
          <>
            <section className="metric-grid">
              {kpis.map((kpi) => (
                <MetricCard
                  key={kpi.label}
                  icon={kpi.icon}
                  iconClass={kpi.iconClass}
                  label={kpi.label}
                  value={kpi.value}
                  suffix={kpi.suffix}
                  detail={kpi.detail}
                  changeIcon={kpi.changeIcon}
                />
              ))}
            </section>

            <section className="analytics-grid">
              <div className="analytics-main">
                {/* ── Bar Chart ── */}
                <article className="stats-card panel">
                  <PanelHeader
                    title={chartInfo.title}
                    description={chartInfo.desc}
                    chartLegend
                    chartUnresolvedLabel={`Non résolus (${chartTotalUnresolved})`}
                    chartResolvedLabel={`Résolus (${chartTotalResolved})`}
                  />
                  {chartBars.length > 0 ? (
                    <div className="bar-chart">
                      {chartBars.map(([label, unresolved, resolved, unrTip, resTip]) => (
                        <div className="bar-group" key={label}>
                          <div className="bars">
                            <span className="received-bar bar-hover" style={{ height: `${unresolved}%` }} data-tip={`${unrTip} non résolus`} />
                            <span className="resolved-bar bar-hover" style={{ height: `${resolved}%` }} data-tip={`${resTip} résolus`} />
                          </div>
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#8896a6', padding: '2rem', textAlign: 'center' }}>Aucune donnée pour cette période.</p>
                  )}
                </article>

                {/* ── Department Breakdown ── */}
                <article className="stats-card panel">
                  <PanelHeader
                    title="Répartition par Département & Service"
                    description={`Volumes totaux, parts relatives et taux d'efficacité pour les ${stats.departments.length} départements.`}
                    legend
                  />
                  <div className="department-list">
                    {stats.departments.length === 0 && <p style={{ color: '#8896a6', padding: '1rem' }}>Aucun ticket pour cette période.</p>}
                    {stats.departments.map((d) => (
                      <div className="department-row" key={d.name}>
                        <div className="department-heading">
                          <div className="department-name"><strong>{d.name}</strong></div>
                          <div className="department-values"><strong>{d.total} tickets</strong><span>{d.share}%</span><b>{d.closed} / {d.total} résolus</b></div>
                        </div>
                        <div className="progress-track"><span style={{ width: `${d.share}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <div className="analytics-side">
                {/* ── Recent Activity ── */}
                <article className="stats-card panel">
                  <div className="activity-heading"><h2>Activité Récente</h2><button type="button" onClick={() => onNavigate?.('tickets')}>Voir historique</button></div>
                  <div className="activity-list">
                    {recentTickets.length === 0 && <p style={{ color: '#8896a6', fontSize: '0.9rem', padding: '1rem' }}>Aucun ticket récent.</p>}
                    {recentTickets.map((ticket) => {
                      const { label, tone } = mapStatus(ticket.status);
                      return (
                        <Activity
                          key={ticket.id}
                          id={`#TKT-${ticket.id}`}
                          status={label}
                          tone={tone}
                          title={ticket.title}
                          department={ticket.department}
                          time={formatRelativeTime(ticket.createdAt)}
                        />
                      );
                    })}
                  </div>
                </article>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
