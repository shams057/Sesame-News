import { formatDate, formatDuration, PRIORITY } from './format';

const NAVY = [2, 62, 154];
const TEAL = [60, 193, 187];

function bucketLabel(key, granularity) {
  if (granularity === 'month') {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
  }
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/** Draws the created/closed bar chart directly with jsPDF primitives. */
function drawChart(doc, stats, x, y, width, height) {
  const data = stats.timeline;
  const max = Math.max(1, ...data.flatMap((bucket) => [bucket.created, bucket.closed]));
  doc.setDrawColor(220);
  doc.line(x, y + height, x + width, y + height);
  const slot = width / Math.max(data.length, 1);
  const barWidth = Math.min(4, slot / 2.6);
  const labelEvery = Math.ceil(data.length / 12);
  data.forEach((bucket, index) => {
    const cx = x + slot * index + slot / 2;
    const createdHeight = (bucket.created / max) * height;
    const closedHeight = (bucket.closed / max) * height;
    doc.setFillColor(...NAVY);
    if (createdHeight) doc.rect(cx - barWidth - 0.3, y + height - createdHeight, barWidth, createdHeight, 'F');
    doc.setFillColor(...TEAL);
    if (closedHeight) doc.rect(cx + 0.3, y + height - closedHeight, barWidth, closedHeight, 'F');
    if (index % labelEvery === 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(110);
      doc.text(bucketLabel(bucket.key, stats.granularity), cx, y + height + 4, { align: 'center' });
    }
  });
  doc.setFontSize(8);
  doc.setFillColor(...NAVY); doc.rect(x, y - 6, 3, 3, 'F'); doc.setTextColor(60); doc.text('Créés', x + 5, y - 3.6);
  doc.setFillColor(...TEAL); doc.rect(x + 22, y - 6, 3, 3, 'F'); doc.text('Fermés', x + 27, y - 3.6);
  doc.text(`max ${max}`, x + width, y - 3.6, { align: 'right' });
}

/** jsPDF is loaded on demand: it is only needed when a report is exported. */
export async function exportStatsPdf(stats, departmentName) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('Rapport — Tickets de support', 14, 18);
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text(`${stats.periodLabel} (du ${formatDate(stats.startDate)} au ${formatDate(stats.endDate)}) · ${departmentName || 'Tous les services'} · généré le ${formatDate(new Date())}`, 14, 25);

  autoTable(doc, {
    startY: 31,
    theme: 'grid',
    headStyles: { fillColor: NAVY },
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Tickets créés', `${stats.created.total} (ouverts ${stats.created.open}, en cours ${stats.created.in_progress}, fermés ${stats.created.closed})`],
      ['Tickets fermés sur la période', String(stats.closedInPeriod)],
      ['Part des tickets créés déjà résolus', `${stats.resolvedShare} %`],
      ['En attente (tous tickets non fermés)', String(stats.backlog.total)],
      ['Délai de résolution (moyen / médian)', `${formatDuration(stats.resolutionTime.averageHours)} / ${formatDuration(stats.resolutionTime.medianHours)}`],
      ['Délai de 1ʳᵉ réponse (moyen / médian)', `${formatDuration(stats.firstResponseTime.averageHours)} / ${formatDuration(stats.firstResponseTime.medianHours)}`],
      ['Satisfaction', stats.satisfaction.average ? `${stats.satisfaction.average} / 5 (${stats.satisfaction.count} avis)` : '—'],
    ],
  });

  const chartTop = doc.lastAutoTable.finalY + 16;
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text('Évolution', 14, chartTop - 8);
  drawChart(doc, stats, 14, chartTop, 182, 48);

  autoTable(doc, {
    startY: chartTop + 60,
    headStyles: { fillColor: NAVY },
    head: [['Service', 'Créés', 'Ouverts', 'En cours', 'Fermés', 'Fermés sur la période', 'Résolution moy.']],
    body: stats.departments.map((row) => [row.department, row.created, row.open, row.inProgress, row.closed, row.closedInPeriod, formatDuration(row.averageResolutionHours)]),
  });

  if (stats.agents.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      headStyles: { fillColor: NAVY },
      head: [['Agent', 'Tickets résolus', 'Résolution moy.']],
      body: stats.agents.map((row) => [row.agent, row.closed, formatDuration(row.averageResolutionHours)]),
    });
  }

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    headStyles: { fillColor: NAVY },
    head: [['Priorité', 'Tickets créés']],
    body: stats.priorities.map((row) => [PRIORITY[row.priority].label, row.count]),
  });

  doc.save(`rapport_tickets_${stats.period}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export { bucketLabel };
