import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
}

export function formatRelativeDate(value: string | Date | null | undefined): string {
  if (!value) return 'sin actividad registrada';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'sin actividad registrada';
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}
