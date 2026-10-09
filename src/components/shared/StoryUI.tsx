// Shared "storytelling" primitives — hero banners, stat tiles, spotlight cards,
// attention panels, status pills, sparklines. Backed by the .stat-tile /
// .hero-banner / .spotlight-card / .attn-item / .status-pill classes in
// index.css, so the visual recipe lives in one place.
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Inbox, SearchX, Settings2, ShieldAlert, type LucideIcon } from 'lucide-react';
import { describeError, getErrorStatus } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------- Sparkline ----------

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ data, color = 'hsl(var(--primary))', width = 100, height = 30, className }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className={className} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- StatusPill ----------

type PillTone = 'good' | 'warning' | 'critical' | 'info' | 'available';

export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={cn('status-pill', `status-pill-${tone}`)}>{children}</span>;
}

// ---------- StatTile ----------

interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  pill?: { tone: PillTone; label: string };
  sparkline?: { data: number[]; color?: string };
  className?: string;
  /** Decorative illustration, top-right corner. Optional — most tiles have none. */
  decorationImage?: string;
  /** Second, smaller decorative illustration, bottom-left corner. */
  accentImage?: string;
  /** Promote this tile above its siblings — the one or two KPIs that matter
      most on the page, not every tile in a row (that would defeat the point). */
  emphasis?: 'primary' | 'default';
}

export function StatTile({ label, value, sub, pill, sparkline, className, decorationImage, accentImage, emphasis = 'default' }: StatTileProps) {
  return (
    <div className={cn('stat-tile', emphasis === 'primary' && 'stat-tile-primary', className)}>
      {decorationImage && (
        <img src={decorationImage} alt="" loading="lazy" decoding="async" className="absolute right-1 top-1 h-28 w-28 object-contain opacity-80 pointer-events-none select-none" />
      )}
      {accentImage && (
        <img src={accentImage} alt="" className="absolute left-0 bottom-0 h-24 w-auto object-contain opacity-40 pointer-events-none select-none" />
      )}
      <div className="relative flex items-start justify-between gap-2 mb-2.5">
        <span className="stat-tile-label">{label}</span>
        {pill && <StatusPill tone={pill.tone}>{pill.label}</StatusPill>}
      </div>
      <div className={cn('relative stat-tile-value', emphasis === 'primary' && 'text-[32px]')}>{value}</div>
      {sub && <p className="relative text-xs text-muted-foreground mt-1">{sub}</p>}
      {sparkline && (
        <Sparkline
          data={sparkline.data}
          color={sparkline.color ?? 'hsl(var(--primary))'}
          height={32}
          className="relative mt-2.5"
        />
      )}
    </div>
  );
}

// ---------- HeroBanner ----------

interface HeroStat {
  value: ReactNode;
  label: string;
  delta?: { text: string; direction: 'up' | 'down' };
}

interface HeroBannerProps {
  eyebrow: string;
  story: ReactNode;
  stats?: HeroStat[];
  className?: string;
}

export function HeroBanner({ eyebrow, story, stats, className }: HeroBannerProps) {
  return (
    <section className={cn('hero-banner', className)}>
      <p className="relative text-xs font-medium text-white/90 mb-2.5">
        {eyebrow}
      </p>
      <p className="relative text-xl leading-relaxed max-w-2xl mb-0" style={{ textWrap: 'balance' }}>
        {story}
      </p>
      {stats && stats.length > 0 && (
        <div className="relative flex flex-wrap gap-9 items-end mt-6">
          {stats.map((s, i) => (
            <div key={i}>
              <div className="figure text-4xl font-semibold leading-none">{s.value}</div>
              <div className="text-xs text-white/90 mt-1.5">
                {s.label}
                {s.delta && (
                  <span className={cn('ml-2 font-semibold', s.delta.direction === 'up' ? 'text-[hsl(152,70%,72%)]' : 'text-[hsl(12,100%,80%)]')}>
                    {s.delta.direction === 'up' ? '▲' : '▼'} {s.delta.text}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- SpotlightCard ----------

interface SpotlightCardProps {
  tag: ReactNode;
  avatar?: ReactNode;
  name: string;
  role?: string;
  metricValue: ReactNode;
  metricUnit?: string;
  note?: string;
  className?: string;
}

export function SpotlightCard({ tag, avatar, name, role, metricValue, metricUnit, note, className }: SpotlightCardProps) {
  return (
    <div className={cn('spotlight-card', className)}>
      <span className="text-xs font-semibold text-primary-deep">{tag}</span>
      <div className="flex items-center gap-2.5">
        {avatar}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{name}</div>
          {role && <div className="text-2xs text-muted-foreground truncate">{role}</div>}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="figure text-[22px] font-bold">{metricValue}</span>
        {metricUnit && <span className="text-xs text-muted-foreground">{metricUnit}</span>}
      </div>
      {note && <p className="text-xs text-muted-foreground leading-snug">{note}</p>}
    </div>
  );
}

// ---------- AttentionItem ----------

type AttnSeverity = 'critical' | 'warning' | 'good';

interface AttentionItemProps {
  severity: AttnSeverity;
  title: string;
  description: string;
  cta?: string;
  onClick?: () => void;
}

export function AttentionItem({ severity, title, description, cta, onClick }: AttentionItemProps) {
  return (
    <div className="attn-item">
      <div className={cn('attn-stripe', `attn-stripe-${severity}`)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      {cta && (
        <button
          type="button"
          onClick={onClick}
          className="text-xs font-bold text-primary-deep whitespace-nowrap hover:underline flex-shrink-0"
        >
          {cta} →
        </button>
      )}
    </div>
  );
}

// ---------- SectionHeader ----------
// Tag pill + title — groups a block of content within a page. One recipe
// shared across pages instead of each one redefining the same pill+h2 pair.

export function SectionHeader({ tag, title, className }: { tag: string; title: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline gap-3 mb-5', className)}>
      <span className="text-2xs font-semibold text-primary-deep bg-primary/10 px-2.5 py-1 rounded-md whitespace-nowrap">
        {tag}
      </span>
      <h2 className="text-section">{title}</h2>
    </div>
  );
}

// ---------- FormSection ----------
// Groups related fields under a small caption — the same Separator+h4 recipe
// already used ad-hoc in TaskDetailSheet, formalized so create/edit dialogs
// don't repeat the same markup or invent a second pattern.

export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ---------- LoadingState ----------
// Shared spinner for section/page-level loading. Always brand teal — never a
// one-off color per page (Reports used to force an indigo spinner here).

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Cargando…', className }: LoadingStateProps = {}) {
  return (
    <div className={cn('flex items-center justify-center min-h-[300px]', className)} role="status" aria-label={label}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// ---------- EmptyState ----------
// Shared "nothing here yet" panel — one recipe for every table/chart/section
// in the app instead of each page reinventing its own icon/opacity/CTA.

interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ message, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-muted-foreground', className)}>
      <Icon className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm text-center max-w-sm">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 text-xs font-bold text-primary-deep hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ---------- ErrorState ----------
// Fallo real de una consulta (red, servidor, permisos). Se distingue de EmptyState (no hay datos) y de
// LoadingState/Skeletons (aún cargando): nunca debe mostrarse un "no hay X" cuando la API falló.
// Con `error` conserva el mensaje del servidor y diferencia permisos (401/403) de fallos de red o servidor;
// un 403 no ofrece «Reintentar» (reintentar no concede permisos).

interface ErrorStateProps {
  /** Texto base (qué no se pudo cargar). Con `error` se le añade el motivo. */
  message?: string;
  error?: unknown;
  /** Si se pasa, muestra «Reintentar» (normalmente `refetch` de la consulta). */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({ message = 'No se pudo cargar la información.', error, onRetry, retrying = false, className }: ErrorStateProps) {
  const status = getErrorStatus(error);
  const forbidden = status === 403;
  const d = error === undefined ? { title: undefined, message } : describeError(error, message);
  const Icon = status === 401 || forbidden ? ShieldAlert : AlertCircle;
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      <Icon className="h-10 w-10 text-destructive-strong" aria-hidden="true" />
      {d.title && <p className="text-sm font-semibold text-foreground">{d.title}</p>}
      <p className="text-sm text-foreground max-w-sm">{d.message}</p>
      {onRetry && !forbidden && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          {retrying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Reintentar
        </Button>
      )}
    </div>
  );
}

// ---------- RefetchError ----------
// La actualización falló pero hay datos anteriores: se mantienen visibles y se avisa sin bloquear.

export function RefetchError({ error, onRetry, retrying = false, className }: { error?: unknown; onRetry?: () => void; retrying?: boolean; className?: string }) {
  const d = describeError(error, 'No se pudo actualizar la información.');
  return (
    <div role="status" className={cn('mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-strong', className)}>
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0">{d.title ? `${d.title}: ` : ''}{d.message} Se muestran los datos anteriores.</span>
      {onRetry && !isForbidden(error) && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-warning-strong" onClick={onRetry} disabled={retrying}>
          {retrying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Reintentar
        </Button>
      )}
    </div>
  );
}

const isForbidden = (error: unknown) => getErrorStatus(error) === 403;

// ---------- UpdatingIndicator ----------
// Actualización en segundo plano (hay datos): indicador discreto, con retardo para evitar parpadeos.

export function UpdatingIndicator({ active, delayMs = 400, className }: { active: boolean; delayMs?: number; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      {show && (<><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Actualizando…</>)}
    </span>
  );
}

// ---------- Estados vacíos con significado propio ----------

/** Hay registros, pero ninguno cumple los filtros. */
export function NoResultsState({ message = 'Ningún resultado con los filtros seleccionados.', onClear, className }: { message?: string; onClear?: () => void; className?: string }) {
  return <EmptyState icon={SearchX} message={message} action={onClear ? { label: 'Limpiar filtros', onClick: onClear } : undefined} className={className} />;
}

/** El usuario no tiene permiso para ver o gestionar esta sección. */
export function NoPermissionState({ message = 'No tienes permiso para ver esta sección.', className }: { message?: string; className?: string }) {
  return <EmptyState icon={ShieldAlert} message={message} className={className} />;
}

/** Falta una configuración previa para poder mostrar la información. */
export function SetupNeededState({ message, action, className }: { message: string; action?: { label: string; onClick: () => void }; className?: string }) {
  return <EmptyState icon={Settings2} message={message} action={action} className={className} />;
}
