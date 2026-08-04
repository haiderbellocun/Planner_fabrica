// Shared "storytelling" primitives — hero banners, stat tiles, spotlight cards,
// attention panels, status pills, sparklines. Backed by the .stat-tile /
// .hero-banner / .spotlight-card / .attn-item / .status-pill classes in
// index.css, so the visual recipe lives in one place.
import type { ReactNode } from 'react';
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
}

export function StatTile({ label, value, sub, pill, sparkline, className }: StatTileProps) {
  return (
    <div className={cn('stat-tile', className)}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span className="stat-tile-label">{label}</span>
        {pill && <StatusPill tone={pill.tone}>{pill.label}</StatusPill>}
      </div>
      <div className="stat-tile-value">{value}</div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {sparkline && (
        <Sparkline
          data={sparkline.data}
          color={sparkline.color ?? 'hsl(var(--primary))'}
          height={32}
          className="mt-2.5"
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
