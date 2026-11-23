import React from 'react';
import { STATUS } from '../utils/format';
import { Badge } from './ui';

export default function StatusBadge({ status }) {
  const info = STATUS[status] || { label: status, tone: 'neutral' };
  return <Badge label={info.label} tone={info.tone} />;
}
