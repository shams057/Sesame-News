import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './TicketStatsPage.css';
import sesameLogo from '../assets/sesame-logo.png';

const PERIODS = ['Aujourd’hui', '7 derniers jours', 'Ce mois-ci', 'Semestre 1', 'Année 2026-2027'];

const DEPARTMENTS = [
  ['Service Scolarité', 'Pôle Central', 284, '19.9%', 81],
  ['Service IT', 'Infrastructure & ENT', 210, '14.7%', 89],
  ['Département licence Informatique', 'Pédagogie', 168, '11.8%', 86],
  ['Service Stage', 'Conventions & PFE', 142, '9.9%', 92],
  ['Département Prepa_Ingénieur', 'Pédagogie', 125, '8.8%', 84],
  ['Service Finance', 'Comptabilité', 112, '7.8%', 78],
  ['Département Management', 'Business School', 98, '6.9%', 87],
  ['Service Admission', 'Inscriptions', 85, '6.0%', 94],
  ['Service Student Success', 'Accompagnement', 64, '4.5%', 90],
  ['Département FTA', 'Alternance', 48, '3.4%', 83],
  ['Service qualité', 'Audit & Process', 36, '2.5%', 97],
  ['Service coopération international', 'Mobilité & Échanges', 32, '2.2%', 88],
  ['Service Marketing', 'Communication', 24, '1.7%', 95],
];

const DEPARTMENT_OPTIONS = ['Tous les départements (13 services)', ...DEPARTMENTS.map(([name]) => name)];

const TICKET_TYPES_ALL = [
  ['Pédagogie & Notes d’examen', 38, 'blue'],
  ['Accès ENT, Moodle & Clés Wi-Fi', 26, 'cobalt'],
  ['Conventions de Stage & PFE', 16, 'violet'],
  ['Attestations & Administratif', 12, 'slate'],
  ['Suggestions de Vie Étudiante', 8, 'green'],
];

const TICKET_TYPES_BY_DEPT = {
  'Service Scolarité': [
    ['Attestations & Administratif', 42, 'slate'],
    ['Pédagogie & Notes d\'examen', 28, 'blue'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 14, 'cobalt'],
    ['Conventions de Stage & PFE', 10, 'violet'],
    ['Suggestions de Vie Étudiante', 6, 'green'],
  ],
  'Service IT': [
    ['Accès ENT, Moodle & Clés Wi-Fi', 52, 'cobalt'],
    ['Pédagogie & Notes d\'examen', 18, 'blue'],
    ['Attestations & Administratif', 15, 'slate'],
    ['Suggestions de Vie Étudiante', 10, 'green'],
    ['Conventions de Stage & PFE', 5, 'violet'],
  ],
  'Département licence Informatique': [
    ['Pédagogie & Notes d\'examen', 55, 'blue'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 20, 'cobalt'],
    ['Conventions de Stage & PFE', 12, 'violet'],
    ['Attestations & Administratif', 8, 'slate'],
    ['Suggestions de Vie Étudiante', 5, 'green'],
  ],
  'Service Stage': [
    ['Conventions de Stage & PFE', 58, 'violet'],
    ['Attestations & Administratif', 22, 'slate'],
    ['Pédagogie & Notes d\'examen', 10, 'blue'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 6, 'cobalt'],
    ['Suggestions de Vie Étudiante', 4, 'green'],
  ],
  'Département Prepa_Ingénieur': [
    ['Pédagogie & Notes d\'examen', 48, 'blue'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 24, 'cobalt'],
    ['Attestations & Administratif', 14, 'slate'],
    ['Conventions de Stage & PFE', 8, 'violet'],
    ['Suggestions de Vie Étudiante', 6, 'green'],
  ],
  'Service Finance': [
    ['Attestations & Administratif', 45, 'slate'],
    ['Pédagogie & Notes d\'examen', 25, 'blue'],
    ['Conventions de Stage & PFE', 15, 'violet'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 10, 'cobalt'],
    ['Suggestions de Vie Étudiante', 5, 'green'],
  ],
  'Département Management': [
    ['Pédagogie & Notes d\'examen', 44, 'blue'],
    ['Conventions de Stage & PFE', 22, 'violet'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 16, 'cobalt'],
    ['Attestations & Administratif', 11, 'slate'],
    ['Suggestions de Vie Étudiante', 7, 'green'],
  ],
  'Service Admission': [
    ['Attestations & Administratif', 50, 'slate'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 22, 'cobalt'],
    ['Pédagogie & Notes d\'examen', 15, 'blue'],
    ['Suggestions de Vie Étudiante', 8, 'green'],
    ['Conventions de Stage & PFE', 5, 'violet'],
  ],
  'Service Student Success': [
    ['Suggestions de Vie Étudiante', 35, 'green'],
    ['Pédagogie & Notes d\'examen', 28, 'blue'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 18, 'cobalt'],
    ['Attestations & Administratif', 12, 'slate'],
    ['Conventions de Stage & PFE', 7, 'violet'],
  ],
  'Département FTA': [
    ['Conventions de Stage & PFE', 40, 'violet'],
    ['Pédagogie & Notes d\'examen', 30, 'blue'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 15, 'cobalt'],
    ['Attestations & Administratif', 10, 'slate'],
    ['Suggestions de Vie Étudiante', 5, 'green'],
  ],
  'Service qualité': [
    ['Attestations & Administratif', 38, 'slate'],
    ['Suggestions de Vie Étudiante', 25, 'green'],
    ['Pédagogie & Notes d\'examen', 18, 'blue'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 12, 'cobalt'],
    ['Conventions de Stage & PFE', 7, 'violet'],
  ],
  'Service coopération international': [
    ['Conventions de Stage & PFE', 35, 'violet'],
    ['Attestations & Administratif', 28, 'slate'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 18, 'cobalt'],
    ['Pédagogie & Notes d\'examen', 12, 'blue'],
    ['Suggestions de Vie Étudiante', 7, 'green'],
  ],
  'Service Marketing': [
    ['Suggestions de Vie Étudiante', 40, 'green'],
    ['Attestations & Administratif', 25, 'slate'],
    ['Accès ENT, Moodle & Clés Wi-Fi', 18, 'cobalt'],
    ['Pédagogie & Notes d\'examen', 12, 'blue'],
    ['Conventions de Stage & PFE', 5, 'violet'],
  ],
};

const PERIOD_DATA = {
  'Aujourd’hui': {
    kpis: [
      { icon: 'receipt_long', iconClass: 'blue-icon', label: 'Total Réclamations & Suggestions', value: '47', suffix: 'tickets', change: '+5%', detail: '36 Réclamations (77%) · 11 Suggestions (23%)', changeIcon: 'arrow_upward' },
      { icon: 'check_circle', iconClass: 'green-icon', label: 'Taux de Résolution', value: '89.4%', suffix: '', change: '+4.1%', detail: '42 résolus · 5 en cours', changeIcon: 'trending_up' },
      { icon: 'schedule', iconClass: 'blue-icon', label: 'Délai Moyen de Traitement', value: '3h 45m', suffix: '', change: '-22% plus rapide', detail: 'Objectif journalier < 6h respecté', changeIcon: 'speed' },
      { icon: 'star', iconClass: 'amber-icon', label: 'Satisfaction Étudiante (CSAT)', value: '4.6', suffix: '/ 5', change: '92% positifs', detail: 'Basé sur 28 avis formulés aujourd’hui', changeIcon: 'thumb_up' },
    ],
    chart: {
      title: 'Flux Horaire de la Journée',
      description: 'Tickets reçus vs Tickets clôturés par tranche horaire',
      receivedTotal: '47',
      resolvedTotal: '42',
      bars: [
        ['08h-10h', 45, 38, 7, 6],
        ['10h-12h', 90, 80, 15, 13],
        ['12h-14h', 55, 48, 9, 8],
        ['14h-16h', 75, 68, 12, 11],
        ['16h-18h', 25, 25, 4, 4],
      ],
      note: 'Pic d’activité constaté entre 10h et 12h (pause matinale et accueil guichet scolarité).',
      capacityNote: 'Capacité de traitement moyenne : ~6 tickets/heure',
    },
    departments: [
      ['Service Scolarité', 'Pôle Central', 10, '21.3%', 88],
      ['Service IT', 'Infrastructure & ENT', 8, '17.0%', 91],
      ['Département licence Informatique', 'Pédagogie', 6, '12.8%', 85],
      ['Service Stage', 'Conventions & PFE', 5, '10.6%', 94],
      ['Département Prepa_Ingénieur', 'Pédagogie', 4, '8.5%', 82],
      ['Service Finance', 'Comptabilité', 4, '8.5%', 80],
      ['Département Management', 'Business School', 3, '6.4%', 90],
      ['Service Admission', 'Inscriptions', 2, '4.3%', 95],
      ['Service Student Success', 'Accompagnement', 2, '4.3%', 92],
      ['Département FTA', 'Alternance', 1, '2.1%', 85],
      ['Service qualité', 'Audit & Process', 1, '2.1%', 98],
      ['Service coopération international', 'Mobilité & Échanges', 1, '2.1%', 90],
      ['Service Marketing', 'Communication', 0, '0.0%', 100],
    ],
  },

  '7 derniers jours': {
    kpis: [
      { icon: 'receipt_long', iconClass: 'blue-icon', label: 'Total Réclamations & Suggestions', value: '318', suffix: 'tickets', change: '+8%', detail: '241 Réclamations (76%) · 77 Suggestions (24%)', changeIcon: 'arrow_upward' },
      { icon: 'check_circle', iconClass: 'green-icon', label: 'Taux de Résolution', value: '86.8%', suffix: '', change: '+2.5%', detail: '276 résolus · 42 en cours', changeIcon: 'trending_up' },
      { icon: 'schedule', iconClass: 'blue-icon', label: 'Délai Moyen de Traitement', value: '24h 30m', suffix: '', change: '-18% plus rapide', detail: 'Objectif hebdomadaire < 48h respecté', changeIcon: 'speed' },
      { icon: 'star', iconClass: 'amber-icon', label: 'Satisfaction Étudiante (CSAT)', value: '4.4', suffix: '/ 5', change: '89% positifs', detail: 'Basé sur 195 avis formulés', changeIcon: 'thumb_up' },
    ],
    chart: {
      title: 'Évolution Quotidienne (7 derniers jours)',
      description: 'Tickets enregistrés vs clôturés chaque jour',
      receivedTotal: '318',
      resolvedTotal: '276',
      bars: [
        ['Mer', 65, 58, 45, 40],
        ['Jeu', 82, 74, 57, 51],
        ['Ven', 70, 62, 49, 43],
        ['Sam', 22, 20, 15, 14],
        ['Dim', 14, 12, 10, 8],
        ['Lun', 95, 80, 66, 56],
        ['Mar', 85, 78, 59, 54],
      ],
      note: 'Forte baisse le week-end, puis rebond d’activité le lundi matin dès la reprise.',
      capacityNote: 'Capacité de traitement moyenne : ~45 tickets/jour',
    },
    departments: [
      ['Service Scolarité', 'Pôle Central', 62, '19.5%', 83],
      ['Service IT', 'Infrastructure & ENT', 48, '15.1%', 90],
      ['Département licence Informatique', 'Pédagogie', 38, '11.9%', 87],
      ['Service Stage', 'Conventions & PFE', 32, '10.1%', 93],
      ['Département Prepa_Ingénieur', 'Pédagogie', 28, '8.8%', 85],
      ['Service Finance', 'Comptabilité', 25, '7.9%', 79],
      ['Département Management', 'Business School', 22, '6.9%', 88],
      ['Service Admission', 'Inscriptions', 19, '6.0%', 95],
      ['Service Student Success', 'Accompagnement', 14, '4.4%', 91],
      ['Département FTA', 'Alternance', 11, '3.5%', 84],
      ['Service qualité', 'Audit & Process', 8, '2.5%', 98],
      ['Service coopération international', 'Mobilité & Échanges', 7, '2.2%', 89],
      ['Service Marketing', 'Communication', 4, '1.2%', 96],
    ],
  },

  'Ce mois-ci': {
    kpis: [
      { icon: 'receipt_long', iconClass: 'blue-icon', label: 'Total Réclamations & Suggestions', value: '1 428', suffix: 'tickets', change: '+12%', detail: '1 085 Réclamations (76%) · 343 Suggestions (24%)', changeIcon: 'arrow_upward' },
      { icon: 'check_circle', iconClass: 'green-icon', label: 'Taux de Résolution', value: '84.6%', suffix: '', change: '+3.2%', detail: '1 208 résolus · 220 en cours', changeIcon: 'trending_up' },
      { icon: 'schedule', iconClass: 'blue-icon', label: 'Délai Moyen de Traitement', value: '48h 20m', suffix: '', change: '-15% plus rapide', detail: 'Objectif < 72h respecté (91.8%)', changeIcon: 'speed' },
      { icon: 'star', iconClass: 'amber-icon', label: 'Satisfaction Étudiante (CSAT)', value: '4.2', suffix: '/ 5', change: '86% positifs', detail: 'Basé sur 890 avis formulés', changeIcon: 'thumb_up' },
    ],
    chart: {
      title: 'Évolution Hebdomadaire du Flux',
      description: 'Comparaison dynamique : Réclamations reçues vs Tickets clôturés sur les 4 semaines',
      receivedTotal: '1 428',
      resolvedTotal: '1 208',
      bars: [
        ['Semaine 1', 82, 72, '330', '280'],
        ['Semaine 2', 89, 80, '356', '310'],
        ['Semaine 3', 93, 79, '372', '308'],
        ['Semaine 4', 92, 80, '370', '310'],
      ],
      note: 'Répartition des tickets reçus et clôturés sur les quatre semaines de la période sélectionnée.',
      capacityNote: 'Capacité de traitement moyenne : ~42 tickets/jour',
    },
    departments: DEPARTMENTS,
  },

  'Semestre 1': {
    kpis: [
      { icon: 'receipt_long', iconClass: 'blue-icon', label: 'Total Réclamations & Suggestions', value: '5 240', suffix: 'tickets', change: '+14.8%', detail: '3 980 Réclamations (76%) · 1 260 Suggestions (24%)', changeIcon: 'arrow_upward' },
      { icon: 'check_circle', iconClass: 'green-icon', label: 'Taux de Résolution', value: '88.2%', suffix: '', change: '+4.6%', detail: '4 621 résolus · 619 en cours', changeIcon: 'trending_up' },
      { icon: 'schedule', iconClass: 'blue-icon', label: 'Délai Moyen de Traitement', value: '42h 10m', suffix: '', change: '-19% plus rapide', detail: 'Objectif S1 respecté sur 11/13 départements', changeIcon: 'speed' },
      { icon: 'star', iconClass: 'amber-icon', label: 'Satisfaction Étudiante (CSAT)', value: '4.3', suffix: '/ 5', change: '88% positifs', detail: 'Basé sur 3 410 avis formulés au S1', changeIcon: 'thumb_up' },
    ],
    chart: {
      title: 'Flux Mensuel du Semestre 1',
      description: 'Suivi mensuel des réclamations et résolutions de Septembre à Février',
      receivedTotal: '5 240',
      resolvedTotal: '4 621',
      bars: [
        ['Sept.', 85, 72, '1 120', '950'],
        ['Oct.', 100, 88, '1 315', '1 157'],
        ['Nov.', 75, 68, '985', '890'],
        ['Déc.', 55, 50, '720', '655'],
        ['Janv.', 65, 60, '850', '785'],
        ['Févr.', 50, 48, '650', '624'],
      ],
      note: 'Concentration majeure en début de semestre (septembre/octobre) avant stabilisation rapide.',
      capacityNote: 'Capacité moyenne semestrielle : ~48 tickets/jour',
    },
    departments: [
      ['Service Scolarité', 'Pôle Central', 1042, '19.9%', 84],
      ['Service IT', 'Infrastructure & ENT', 770, '14.7%', 91],
      ['Département licence Informatique', 'Pédagogie', 618, '11.8%', 88],
      ['Service Stage', 'Conventions & PFE', 520, '9.9%', 93],
      ['Département Prepa_Ingénieur', 'Pédagogie', 460, '8.8%', 86],
      ['Service Finance', 'Comptabilité', 410, '7.8%', 82],
      ['Département Management', 'Business School', 360, '6.9%', 89],
      ['Service Admission', 'Inscriptions', 312, '6.0%', 96],
      ['Service Student Success', 'Accompagnement', 235, '4.5%', 92],
      ['Département FTA', 'Alternance', 178, '3.4%', 85],
      ['Service qualité', 'Audit & Process', 132, '2.5%', 98],
      ['Service coopération international', 'Mobilité & Échanges', 118, '2.3%', 90],
      ['Service Marketing', 'Communication', 85, '1.6%', 96],
    ],
  },

  'Année 2026-2027': {
    kpis: [
      { icon: 'receipt_long', iconClass: 'blue-icon', label: 'Total Réclamations & Suggestions', value: '9 850', suffix: 'tickets', change: '+18.2%', detail: '7 486 Réclamations (76%) · 2 364 Suggestions (24%)', changeIcon: 'arrow_upward' },
      { icon: 'check_circle', iconClass: 'green-icon', label: 'Taux de Résolution', value: '90.5%', suffix: '', change: '+5.8%', detail: '8 914 résolus · 936 en cours', changeIcon: 'trending_up' },
      { icon: 'schedule', iconClass: 'blue-icon', label: 'Délai Moyen de Traitement', value: '39h 45m', suffix: '', change: '-25% plus rapide', detail: 'Amélioration continue de la réactivité annuelle', changeIcon: 'speed' },
      { icon: 'star', iconClass: 'amber-icon', label: 'Satisfaction Étudiante (CSAT)', value: '4.5', suffix: '/ 5', change: '91% positifs', detail: 'Basé sur 6 820 avis formulés sur l’année', changeIcon: 'thumb_up' },
    ],
    chart: {
      title: 'Flux Annuel Global (2026-2027)',
      description: 'Historique mensuel complet des tickets sur l’année académique',
      receivedTotal: '9 850',
      resolvedTotal: '8 914',
      bars: [
        ['Sept.', 80, 70, '1 120', '980'],
        ['Oct.', 98, 86, '1 380', '1 210'],
        ['Nov.', 74, 66, '1 040', '930'],
        ['Déc.', 54, 50, '760', '700'],
        ['Janv.', 68, 62, '950', '870'],
        ['Févr.', 58, 54, '810', '755'],
        ['Mars', 72, 68, '1 010', '950'],
        ['Avr.', 65, 62, '910', '870'],
        ['Mai', 60, 57, '840', '800'],
        ['Juin', 75, 71, '1 050', '995'],
      ],
      note: 'Performance record de résolution observée au second semestre grâce aux nouveaux workflows d’automatisation.',
      capacityNote: 'Capacité globale annuelle : ~52 tickets/jour ouvré',
    },
    departments: [
      ['Service Scolarité', 'Pôle Central', 1960, '19.9%', 87],
      ['Service IT', 'Infrastructure & ENT', 1450, '14.7%', 93],
      ['Département licence Informatique', 'Pédagogie', 1162, '11.8%', 91],
      ['Service Stage', 'Conventions & PFE', 975, '9.9%', 95],
      ['Département Prepa_Ingénieur', 'Pédagogie', 865, '8.8%', 89],
      ['Service Finance', 'Comptabilité', 770, '7.8%', 85],
      ['Département Management', 'Business School', 680, '6.9%', 92],
      ['Service Admission', 'Inscriptions', 590, '6.0%', 97],
      ['Service Student Success', 'Accompagnement', 440, '4.5%', 94],
      ['Département FTA', 'Alternance', 335, '3.4%', 88],
      ['Service qualité', 'Audit & Process', 248, '2.5%', 99],
      ['Service coopération international', 'Mobilité & Échanges', 220, '2.2%', 93],
      ['Service Marketing', 'Communication', 155, '1.6%', 98],
    ],
  },
};

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function MetricCard({ icon, iconClass, label, value, suffix, change, detail, changeIcon = 'trending_up' }) {
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
        <span className="success-pill"><Icon>{changeIcon}</Icon>{change}</span>
        <span className="metric-detail">{detail}</span>
      </div>
    </article>
  );
}

export default function TicketStatsPage({ onNavigate }) {
  const [period, setPeriod] = useState('Ce mois-ci');
  const [department, setDepartment] = useState(DEPARTMENT_OPTIONS[0]);
  const [refreshing, setRefreshing] = useState(false);

  const currentPeriodData = PERIOD_DATA[period] || PERIOD_DATA['Ce mois-ci'];

  const visibleDepartments = useMemo(
    () => department === DEPARTMENT_OPTIONS[0]
      ? currentPeriodData.departments
      : currentPeriodData.departments.filter(([name]) => name === department),
    [department, currentPeriodData],
  );

  const visibleTicketTypes = useMemo(
    () => department === DEPARTMENT_OPTIONS[0]
      ? TICKET_TYPES_ALL
      : (TICKET_TYPES_BY_DEPT[department] || TICKET_TYPES_ALL),
    [department],
  );

  const ticketTotal = useMemo(
    () => department === DEPARTMENT_OPTIONS[0]
      ? currentPeriodData.kpis[0].value
      : currentPeriodData.departments.find(([name]) => name === department)?.[2]?.toLocaleString('fr-FR') || '0',
    [department, currentPeriodData],
  );

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 500);
  };

  const exportPDF = async () => {
    // Preload SESAME logo from local asset
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
    const formatReportNumber = (value) => {
      const numericValue = Number(String(value).replace(/[^\d]/g, ''));
      return Number.isNaN(numericValue) ? String(value) : numericValue.toLocaleString('en-US');
    };

    const addNewPageIfNeeded = (needed) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 14) {
        doc.addPage();
        y = 16;
      }
    };

    // ─── Header bar ────────────────────────────────────────────────
    doc.setFillColor(...BLUE);
    doc.roundedRect(margin, y, contentW, 28, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    doc.text('Rapport Statistiques Tickets', margin + 8, y + 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Université SESAME — Généré le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, margin + 8, y + 20);

    // SESAME logo right side
    if (logoDataUrl) {
      // Keep the source aspect ratio instead of forcing the wide logo into a square.
      const logoW = 34;
      const logoH = 22;
      doc.addImage(logoDataUrl, 'PNG', pageW - margin - logoW - 4, y + 3, logoW, logoH);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...WHITE);
      doc.text('SESAME', pageW - margin - 8, y + 16, { align: 'right' });
    }
    y += 36;

    // ─── Period & filter info ──────────────────────────────────────
    doc.setFillColor(240, 243, 250);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(`Période : ${period}  |  Filtre : ${department}`, margin + 4, y + 6.5);
    y += 16;

    // ─── KPI Metrics ───────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text('Indicateurs Clés', margin, y);
    y += 6;

    const kpis = currentPeriodData.kpis.map((k) => ({
      label: k.label,
      value: `${formatReportNumber(k.value)} ${k.suffix || ''}`.trim(),
      change: k.change,
      detail: k.detail.replace(/\b(\d[\d ]*)\b/g, (match) => formatReportNumber(match)),
    }));

    const cardW = (contentW - 9) / 4;
    kpis.forEach((kpi, i) => {
      const x = margin + i * (cardW + 3);
      // Card background
      doc.setFillColor(...WHITE);
      doc.setDrawColor(220, 228, 240);
      doc.roundedRect(x, y, cardW, 28, 2, 2, 'FD');
      // Label
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, x + 3, y + 6);
      // Value
      doc.setFontSize(14);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, x + 3, y + 14.5);
      // Change pill
      doc.setFontSize(6);
      doc.setTextColor(...GREEN_D);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.change, x + 3, y + 20);
      // Detail
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      const detailText = doc.splitTextToSize(kpi.detail, cardW - 6);
      doc.text(detailText, x + 3, y + 24);
    });
    y += 36;

    // ─── Flow chart ────────────────────────────────────────────────
    addNewPageIfNeeded(55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text(currentPeriodData.chart.title, margin, y);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(currentPeriodData.chart.description, margin, y + 5);

    // Legend
    const legendX = pageW - margin - 65;
    doc.setFillColor(...BLUE);
    doc.rect(legendX, y - 3, 4, 4, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    doc.text(`Reçus (${formatReportNumber(currentPeriodData.chart.receivedTotal)})`, legendX + 6, y);
    doc.setFillColor(...GREEN_D);
    doc.rect(legendX + 34, y - 3, 4, 4, 'F');
    doc.text(`Résolus (${formatReportNumber(currentPeriodData.chart.resolvedTotal)})`, legendX + 40, y);
    y += 10;

    const chartH = 38;
    const barAreaW = contentW - 10;
    const groupW = barAreaW / currentPeriodData.chart.bars.length;

    // Draw baseline
    doc.setDrawColor(220, 228, 240);
    doc.line(margin, y + chartH, margin + barAreaW, y + chartH);

    currentPeriodData.chart.bars.forEach(([label, received, resolved, receivedTip, resolvedTip], i) => {
      const cx = margin + 5 + i * groupW + groupW / 2;
      const barW = groupW * 0.25;
      // Received bar
      const rH = (received / 100) * chartH;
      doc.setFillColor(...BLUE);
      doc.roundedRect(cx - barW - 0.5, y + chartH - rH, barW, rH, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...BLUE);
      doc.text(formatReportNumber(receivedTip), cx - barW / 2 - 0.5, y + chartH - rH - 2, { align: 'center' });
      // Resolved bar
      const sH = (resolved / 100) * chartH;
      doc.setFillColor(...GREEN_D);
      doc.roundedRect(cx + 0.5, y + chartH - sH, barW, sH, 1, 1, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(...GREEN_D);
      doc.text(formatReportNumber(resolvedTip), cx + barW / 2 + 0.5, y + chartH - sH - 2, { align: 'center' });
      // Period label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(label, cx, y + chartH + 5, { align: 'center' });
    });
    y += chartH + 12;

    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(currentPeriodData.chart.capacityNote, margin, y);
    y += 10;

    // ─── Flow summary (compact) ────────────────────────────────────
    const toCount = (value) => Number(String(value).replace(/[^\d]/g, '')) || 0;
    const totalReceived = toCount(currentPeriodData.chart.receivedTotal);
    const totalResolved = toCount(currentPeriodData.chart.resolvedTotal);
    const totalPending = Math.max(totalReceived - totalResolved, 0);
    const totalRate = totalReceived > 0 ? `${((totalResolved / totalReceived) * 100).toFixed(1)}%` : '—';

    doc.setFillColor(235, 242, 255);
    doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`Reçus : ${totalReceived.toLocaleString('en-US')}`, margin + 5, y + 7.5);
    doc.setTextColor(...GREEN_D);
    doc.text(`Résolus : ${totalResolved.toLocaleString('en-US')}`, margin + 50, y + 7.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`En attente : ${totalPending.toLocaleString('en-US')}`, margin + 100, y + 7.5);
    doc.setTextColor(...BLUE);
    doc.text(`Taux résolution : ${totalRate}`, margin + 140, y + 7.5);
    y += 18;

    // ─── Department table ──────────────────────────────────────────
    addNewPageIfNeeded(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text('Répartition par Département & Service', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Département', 'Catégorie', 'Tickets', 'Part', '% Résolu']],
      body: visibleDepartments.map(([name, cat, total, share, res]) => [name, cat, total, share, `${res}%`]),
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 228, 240], lineWidth: 0.2 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 255] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55 },
        2: { halign: 'right', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 16 },
        4: { halign: 'right', cellWidth: 20, textColor: GREEN_D, fontStyle: 'bold' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;

    // ─── Ticket Types ──────────────────────────────────────────────
    addNewPageIfNeeded(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text('Nature des Demandes', margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Type de demande', 'Proportion']],
      body: visibleTicketTypes.map(([label, value]) => [label, `${value}%`]),
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 228, 240], lineWidth: 0.2 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 255] },
      columnStyles: {
        1: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;

    // ─── SLA Alerts ────────────────────────────────────────────────
    addNewPageIfNeeded(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text('Alertes en direct', margin, y);
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text('2 urgences', margin + 50, y);
    y += 5;

    const alerts = [
      { title: 'Service Scolarité (14 tickets > 72h)', desc: 'Délivrance attestations de réussite master retardée suite aux inscriptions tardives.', color: [254, 242, 242] },
      { title: 'Service IT (6 tickets critiques)', desc: 'Accès identifiants Moodle pour les nouveaux arrivants cycle préparatoire.', color: [255, 253, 240] },
    ];

    alerts.forEach((alert) => {
      doc.setFillColor(...alert.color);
      doc.roundedRect(margin, y, contentW, 14, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(153, 27, 27);
      doc.text(alert.title, margin + 4, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      const descLines = doc.splitTextToSize(alert.desc, contentW - 8);
      doc.text(descLines, margin + 4, y + 10);
      y += 17;
    });
    y += 3;

    // ─── Recent Activity ───────────────────────────────────────────
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
      body: [
        ['#REC-2026-941', 'Résolu', 'Demande de convention de stage anticipé', 'Service Stage', 'Il y a 12 min'],
        ['#REC-2026-939', 'En cours', 'Erreur saisie note session de rattrapage BD', 'Licence Info', 'Il y a 34 min'],
        ['#SUG-2026-118', 'En révision', 'Extension des horaires de la bibliothèque', 'Student Success', 'Il y a 1h 05'],
      ],
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

    // ─── Footer on every page ──────────────────────────────────────
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

  return (
    <div className="ticket-stats-page">
      <header className="stats-topbar">
        <div>
          <h1>Statistiques Tickets</h1>
          <p>Aperçu analytique de l’activité des tickets de support et réclamations étudiantes.</p>
        </div>
        <div className="stats-actions">
          <div className="date-chip"><Icon>calendar_today</Icon>Mardi 13 Octobre 2026</div>
          <button className="primary-button" type="button" onClick={exportPDF}>
            Exporter rapport
          </button>
        </div>
      </header>

      <main className="stats-workspace">
        <section className="filter-bar">
          <div className="period-picker">
            <span className="stats-overline">Période :</span>
            {PERIODS.map((item) => (
              <button
                key={item}
                type="button"
                className={period === item ? 'filter-choice active' : 'filter-choice'}
                onClick={() => setPeriod(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="filter-actions">
            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filtrer par département">
              {DEPARTMENT_OPTIONS.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button className="secondary-button" type="button" onClick={handleRefresh}>
              <Icon className={refreshing ? 'spin' : ''}>refresh</Icon>{refreshing ? 'Actualisation…' : 'Actualiser'}
            </button>
          </div>
        </section>

        <section className="metric-grid">
          {currentPeriodData.kpis.map((kpi) => (
            <MetricCard
              key={kpi.label}
              icon={kpi.icon}
              iconClass={kpi.iconClass}
              label={kpi.label}
              value={kpi.value}
              suffix={kpi.suffix}
              change={kpi.change}
              detail={kpi.detail}
              changeIcon={kpi.changeIcon}
            />
          ))}
        </section>

        <section className="analytics-grid">
          <div className="analytics-main">
            <article className="stats-card panel">
              <PanelHeader
                title={currentPeriodData.chart.title}
                description={currentPeriodData.chart.description}
                chartLegend
                chartReceivedLabel={`Reçus (${currentPeriodData.chart.receivedTotal})`}
                chartResolvedLabel={`Résolus (${currentPeriodData.chart.resolvedTotal})`}
              />
              <div className="bar-chart">
                {currentPeriodData.chart.bars.map(([label, received, resolved, recTip, resTip]) => (
                  <div className="bar-group" key={label}>
                    <div className="bars">
                      <span className="received-bar bar-hover" style={{ height: `${received}%` }} data-tip={`${recTip} reçus`} />
                      <span className="resolved-bar bar-hover" style={{ height: `${resolved}%` }} data-tip={`${resTip} résolus`} />
                    </div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="chart-note"><span>{currentPeriodData.chart.note}</span><strong>{currentPeriodData.chart.capacityNote}</strong></div>
            </article>

            <article className="stats-card panel">
              <PanelHeader
                title="Répartition par Département & Service"
                description={`Volumes totaux, parts relatives et taux d'efficacité pour les ${visibleDepartments.length} unités de SESAME.`}
                legend
              />
              <div className="department-list">
                {visibleDepartments.map(([name, category, total, share, resolved]) => (
                  <div className="department-row" key={name}>
                    <div className="department-heading">
                      <div className="department-name"><strong>{name}</strong><span>{category}</span></div>
                      <div className="department-values"><strong>{total} tickets</strong><span>{share}</span><b>{resolved}% résolu</b></div>
                    </div>
                    <div className="progress-track"><span style={{ width: share }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="analytics-side">
            <article className="stats-card panel">
              <h2>Nature des Demandes</h2>
              <p className="panel-description">Typologie thématique des {ticketTotal} tickets{department !== DEPARTMENT_OPTIONS[0] ? ` — ${department}` : ''}.</p>
              <div className="type-list">
                {visibleTicketTypes.map(([label, value, color]) => (
                  <div key={label} className="type-row">
                    <div><span>{label}</span><strong>{value}%</strong></div>
                    <div className="progress-track"><span className={color} style={{ width: `${value}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>

            <article className="stats-card panel">
              <div className="alert-heading"><h2><Icon>warning</Icon>Alertes en direct</h2><span>2 urgences</span></div>
              <div className="alert-list">
                <Alert icon="notification_important" tone="critical" title="Service Scolarité (14 tickets > 72h)" description="Délivrance attestations de réussite master retardée suite aux inscriptions tardives." action="Assigner un agent de renfort" />
                <Alert icon="alarm" tone="warning" title="Service IT (6 tickets critiques)" description="Accès identifiants Moodle pour les nouveaux arrivants cycle préparatoire." action="Consulter la file prioritaire" />
              </div>
            </article>

            <article className="stats-card panel">
              <div className="activity-heading"><h2>Activité Récente</h2><button type="button" onClick={() => onNavigate?.('tickets')}>Voir historique</button></div>
              <div className="activity-list">
                <Activity id="#REC-2026-941" status="Résolu" tone="resolved" title="Demande de convention de stage anticipé" department="Service Stage" time="Il y a 12 min" />
                <Activity id="#REC-2026-939" status="En cours" tone="progress" title="Erreur saisie note session de rattrapage BD" department="Licence Info" time="Il y a 34 min" />
                <Activity id="#SUG-2026-118" status="En révision" tone="review" title="Extension des horaires de la bibliothèque" department="Student Success" time="Il y a 1h 05" />
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function PanelHeader({ title, description, legend = false, chartLegend = false, chartReceivedLabel, chartResolvedLabel }) {
  return (
    <div className="panel-header">
      <div><h2>{title}</h2><p className="panel-description">{description}</p></div>
      {legend && <div className="legend"><span><i className="blue-dot" />Volume</span><span><i className="green-dot" />Résolution</span></div>}
      {chartLegend && (
        <div className="legend">
          <span><i className="blue-dot" />{chartReceivedLabel || 'Reçus (1 428)'}</span>
          <span><i className="green-dot" />{chartResolvedLabel || 'Résolus (1 208)'}</span>
        </div>
      )}
    </div>
  );
}

function Alert({ icon, tone, title, description, action }) {
  return <div className={`alert-item ${tone}`}><Icon>{icon}</Icon><div><h3>{title}</h3><p>{description}</p><button type="button">{action} <Icon>arrow_forward</Icon></button></div></div>;
}

function Activity({ id, status, tone, title, department, time }) {
  return <div className="activity-item"><div className="activity-top"><strong>{id}</strong><span className={`status-pill ${tone}`}>{status}</span></div><p>{title}</p><div className="activity-meta"><span>{department}</span><span>{time}</span></div></div>;
}
