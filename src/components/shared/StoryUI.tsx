// Shared "storytelling" primitives — hero banners, stat tiles, spotlight cards,
// attention panels, status pills, sparklines. Backed by the .stat-tile /
// .hero-banner / .spotlight-card / .attn-item / .status-pill classes in
// index.css, so the visual recipe lives in one place.
import type { ReactNode } from 'react';
import { Loader2, Inbox, type LucideIcon } from 'lucide-react';
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
        <img src={decorationImage} alt="" className="absolute right-1 top-1 h-28 w-28 object-contain opacity-80 pointer-events-none select-none" />
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
      <p className="relative text-[11.5px] uppercase tracking-wider font-semibold text-primary-foreground/70 mb-2.5">
        {eyebrow}
      </p>
      <p className="relative text-[19px] leading-relaxed max-w-2xl mb-0" style={{ textWrap: 'balance' }}>
        {story}
      </p>
      {stats && stats.length > 0 && (
        <div className="relative flex flex-wrap gap-9 items-end mt-6">
          {stats.map((s, i) => (
            <div key={i}>
              <div className="figure text-[36px] font-semibold leading-none">{s.value}</div>
              <div className="text-[12.5px] text-primary-foreground/75 mt-1.5">
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
      <span className="text-[11px] font-bold uppercase tracking-wide text-primary-deep">{tag}</span>
      <div className="flex items-center gap-2.5">
        {avatar}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{name}</div>
          {role && <div className="text-[11.5px] text-muted-foreground truncate">{role}</div>}
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
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="text-[12.5px] text-muted-foreground mt-0.5">{description}</div>
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
      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md uppercase tracking-widest whitespace-nowrap">
        {tag}
      </span>
      <h2 className="text-[15px] font-black tracking-tight text-foreground">{title}</h2>
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
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
