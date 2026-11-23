import { Badge } from './ui';
import { PRIORITY, STATUS, slaTone } from '../lib/format';

export function StatusBadge({ status }) {
  const info = STATUS[status] || { label: status, tone: 'neutral' };
  return <Badge tone={info.tone} dot>{info.label}</Badge>;
}

export function PriorityBadge({ priority, hideNormal }) {
  if (hideNormal && (priority === 'normal' || priority === 'low')) return null;
  const info = PRIORITY[priority] || { label: priority, tone: 'neutral' };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

export function SlaBadge({ ticket }) {
  const sla = slaTone(ticket);
  return sla ? <Badge tone={sla.tone} title={sla.label}>{sla.label}</Badge> : null;
}
