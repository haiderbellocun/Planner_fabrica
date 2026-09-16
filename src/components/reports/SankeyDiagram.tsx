import { useRef, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { chartColors, axisTick } from '@/components/charts/chartTheme';

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W  = 100;
const NODE_H  = 44;
const NODE_R  = 6;
const SVG_W   = 760;
const SVG_H   = 380;
const H_PAD   = 20;
const V_GAP   = 36;

// ── State colors (solid) ──────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  'Sin iniciar': axisTick.fill,
  'En proceso':  chartColors.teal,
  'En revisión': chartColors.yellow,
  'En pausa':    chartColors.slate,
  'Ajustes':     chartColors.coral,
  'Finalizado':  chartColors.green,
};

// ── Fixed column order (left → right) ─────────────────────────────────────────
const COLS: string[][] = [
  ['Sin iniciar'],
  ['En proceso'],
  ['En revisión', 'En pausa'],
  ['Ajustes'],
  ['Finalizado'],
];

// ── Public prop types (kept stable for Reports.tsx caller) ───────────────────
export interface SankeyNodeInput {
  id: string;
  color?: string;
  avg_hours?: number;
  task_count?: number;
  display_order?: number;
}

export interface SankeyLinkInput {
  source: string;
  target: string;
  value: number;
}

interface SankeyDiagramProps {
  nodes: SankeyNodeInput[];
  links: SankeyLinkInput[];
  height?: number; // accepted but ignored; SVG drives its own aspect ratio
}

// ── Internal layout types ─────────────────────────────────────────────────────
interface PlacedNode {
  id: string;
  x: number;
  y: number;
  color: string;
  avg_hours?: number;
  task_count?: number;
}

interface PlacedLink {
  key: string;
  source: string;
  target: string;
  value: number;
  srcX: number;  srcCY: number;  srcT: number;
  tgtX: number;  tgtCY: number;  tgtT: number;
  gradId: string;
  srcColor: string;
  tgtColor: string;
}

interface TooltipState {
  cx: number;
  cy: number;
  source: string;
  target: string;
  value: number;
}

// ── Layout engine ─────────────────────────────────────────────────────────────
function buildLayout(
  nodes: SankeyNodeInput[],
  links: SankeyLinkInput[],
): { placedNodes: PlacedNode[]; placedLinks: PlacedLink[] } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // 1. Place nodes according to COLS definition
  const colCount   = COLS.length;
  const colSpacing = (SVG_W - 2 * H_PAD - NODE_W) / (colCount - 1);
  const nodePos: Record<string, PlacedNode> = {};

  COLS.forEach((colIds, colIdx) => {
    const x       = H_PAD + colIdx * colSpacing;
    const present = colIds.filter((id) => nodeMap.has(id));
    if (!present.length) return;

    const totalH = present.length * NODE_H + (present.length - 1) * V_GAP;
    const startY = (SVG_H - totalH) / 2;

    present.forEach((id, rowIdx) => {
      const n = nodeMap.get(id)!;
      nodePos[id] = {
        id,
        x,
        y:          startY + rowIdx * (NODE_H + V_GAP),
        color:      n.color ?? NODE_COLORS[id] ?? axisTick.fill,
        avg_hours:  n.avg_hours,
        task_count: n.task_count,
      };
    });
  });

  // 2. Keep only forward links (srcX < tgtX) to avoid cycles
  const fwdLinks = links.filter(
    (l) =>
      l.value > 0 &&
      l.source !== l.target &&
      nodePos[l.source] !== undefined &&
      nodePos[l.target] !== undefined &&
      nodePos[l.source].x < nodePos[l.target].x,
  );

  if (!fwdLinks.length) return { placedNodes: Object.values(nodePos), placedLinks: [] };

  // 3. Scale link thickness
  const maxVal = fwdLinks.reduce((m, l) => Math.max(m, l.value), 1);
  const thick  = (v: number) =>
    Math.max(3, Math.min(NODE_H * 0.65, (v / maxVal) * NODE_H * 0.65));

  // 4. Distribute ports on source-right / target-left sides
  const srcGroups: Record<string, SankeyLinkInput[]> = {};
  const tgtGroups: Record<string, SankeyLinkInput[]> = {};
  fwdLinks.forEach((l) => {
    (srcGroups[l.source] ??= []).push(l);
    (tgtGroups[l.target] ??= []).push(l);
  });

  const srcPort: Record<string, { cy: number; t: number }> = {};
  const tgtPort: Record<string, { cy: number; t: number }> = {};

  Object.entries(srcGroups).forEach(([id, lks]) => {
    const node  = nodePos[id];
    const total = lks.reduce((s, l) => s + thick(l.value), 0);
    let   acc   = node.y + (NODE_H - total) / 2;
    lks.forEach((l) => {
      const t = thick(l.value);
      srcPort[`${l.source}→${l.target}`] = { cy: acc + t / 2, t };
      acc += t;
    });
  });

  Object.entries(tgtGroups).forEach(([id, lks]) => {
    const node  = nodePos[id];
    const total = lks.reduce((s, l) => s + thick(l.value), 0);
    let   acc   = node.y + (NODE_H - total) / 2;
    lks.forEach((l) => {
      const t = thick(l.value);
      tgtPort[`${l.source}→${l.target}`] = { cy: acc + t / 2, t };
      acc += t;
    });
  });

  // 5. Assemble placed links
  const placedLinks: PlacedLink[] = fwdLinks.flatMap((l) => {
    const key = `${l.source}→${l.target}`;
    const sp  = srcPort[key];
    const tp  = tgtPort[key];
    if (!sp || !tp) return [];
    return [{
      key,
      source:   l.source,
      target:   l.target,
      value:    l.value,
      srcX:     nodePos[l.source].x + NODE_W,
      srcCY:    sp.cy,
      srcT:     sp.t,
      tgtX:     nodePos[l.target].x,
      tgtCY:    tp.cy,
      tgtT:     tp.t,
      gradId:   `skg_${l.source}_${l.target}`.replace(/[^a-z0-9_]/gi, '_'),
      srcColor: nodePos[l.source].color,
      tgtColor: nodePos[l.target].color,
    }];
  });

  return { placedNodes: Object.values(nodePos), placedLinks };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SankeyDiagram({ nodes, links }: SankeyDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverKey, setHoverKey]   = useState<string | null>(null);
  const [tooltip,  setTooltip]    = useState<TooltipState | null>(null);

  const { placedNodes, placedLinks } = useMemo(
    () => buildLayout(nodes, links),
    [nodes, links],
  );

  // ── Tooltip handlers ───────────────────────────────────────────────────────
  const onLinkEnter = (e: React.MouseEvent, pl: PlacedLink) => {
    setHoverKey(pl.key);
    const box = containerRef.current?.getBoundingClientRect();
    if (box) setTooltip({ cx: e.clientX - box.left, cy: e.clientY - box.top, source: pl.source, target: pl.target, value: pl.value });
  };
  const onLinkMove = (e: React.MouseEvent) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (box) setTooltip((p) => p ? { ...p, cx: e.clientX - box.left, cy: e.clientY - box.top } : null);
  };
  const onLinkLeave = () => { setHoverKey(null); setTooltip(null); };

  if (!placedNodes.length) {
    return (
      <Card className="rounded-2xl border border-border bg-card shadow-card">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sin datos de transiciones suficientes para el diagrama.
        </CardContent>
      </Card>
    );
  }

  const aspectPct = (SVG_H / SVG_W) * 100;

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Diagrama de flujo — estados y volumen de transiciones</CardTitle>
        <CardDescription className="text-xs">
          Cajas = estados · grosor de cinta = volumen de tareas · número = tareas en esa transición · pasa el cursor para detalle
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        {/* Responsive container via padding-bottom trick */}
        <div
          ref={containerRef}
          style={{ position: 'relative', width: '100%', paddingBottom: `${aspectPct}%` }}
        >
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              {/* Node drop-shadow */}
              <filter id="sk-node-shadow" x="-20%" y="-50%" width="140%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="2"  floodColor="rgba(0,0,0,0.12)" />
              </filter>

              {/* One linear gradient per link */}
              {placedLinks.map((pl) => (
                <linearGradient key={pl.gradId} id={pl.gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor={pl.srcColor} />
                  <stop offset="100%" stopColor={pl.tgtColor} />
                </linearGradient>
              ))}
            </defs>

            {/* ── Ribbons (drawn first so nodes sit on top) ── */}
            {placedLinks.map((pl) => {
              const isHover = hoverKey === pl.key;
              const mx      = (pl.srcX + pl.tgtX) / 2;
              const hs      = pl.srcT / 2;
              const ht      = pl.tgtT / 2;

              const ribbon = [
                `M ${pl.srcX} ${pl.srcCY - hs}`,
                `C ${mx} ${pl.srcCY - hs} ${mx} ${pl.tgtCY - ht} ${pl.tgtX} ${pl.tgtCY - ht}`,
                `L ${pl.tgtX} ${pl.tgtCY + ht}`,
                `C ${mx} ${pl.tgtCY + ht} ${mx} ${pl.srcCY + hs} ${pl.srcX} ${pl.srcCY + hs}`,
                'Z',
              ].join(' ');

              // Arrowhead at target entry, pointing right into the node
              const aBase = Math.min(pl.tgtT * 0.65, 9);
              const aLen  = aBase * 1.35;
              const arrow = aBase >= 3
                ? `M ${pl.tgtX} ${pl.tgtCY} L ${pl.tgtX - aLen} ${pl.tgtCY - aBase / 2} L ${pl.tgtX - aLen} ${pl.tgtCY + aBase / 2} Z`
                : null;

              // Count label on thick ribbons
              const midX     = mx;
              const midY     = (pl.srcCY + pl.tgtCY) / 2;
              const showLabel = pl.srcT >= 7;

              return (
                <g key={pl.key}>
                  {/* Ribbon */}
                  <path
                    d={ribbon}
                    fill={`url(#${pl.gradId})`}
                    fillOpacity={isHover ? 0.45 : 0.18}
                    style={{ cursor: 'pointer', transition: 'fill-opacity 0.18s ease' }}
                    onMouseEnter={(e) => onLinkEnter(e, pl)}
                    onMouseMove={onLinkMove}
                    onMouseLeave={onLinkLeave}
                  />
                  {/* Arrow */}
                  {arrow && (
                    <path
                      d={arrow}
                      fill={pl.tgtColor}
                      opacity={isHover ? 0.85 : 0.55}
                      style={{ pointerEvents: 'none', transition: 'opacity 0.18s ease' }}
                    />
                  )}
                  {/* Count label */}
                  {showLabel && (
                    <text
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontWeight={700}
                      fill="rgba(0,0,0,0.55)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {pl.value}
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── Node boxes ── */}
            {placedNodes.map((n) => {
              const hasStats = n.avg_hours != null || n.task_count != null;
              // Vertical text layout inside 44px box
              const nameY  = hasStats ? n.y + 11  : n.y + NODE_H / 2;
              const hoursY = n.y + 25;
              const countY = n.y + 37;

              return (
                <g key={n.id}>
                  <rect
                    x={n.x}
                    y={n.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={NODE_R}
                    ry={NODE_R}
                    fill={n.color}
                    filter="url(#sk-node-shadow)"
                  />
                  {/* Line 1 — state name */}
                  <text
                    x={n.x + NODE_W / 2}
                    y={nameY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={10.5}
                    fontWeight={700}
                    fill="white"
                    style={{ userSelect: 'none' }}
                  >
                    {n.id}
                  </text>
                  {/* Line 2 — avg hours */}
                  {n.avg_hours != null && (
                    <text
                      x={n.x + NODE_W / 2}
                      y={hoursY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={9}
                      fontWeight={500}
                      fill="rgba(255,255,255,0.82)"
                      style={{ userSelect: 'none' }}
                    >
                      {Number(n.avg_hours).toFixed(1)}h avg
                    </text>
                  )}
                  {/* Line 3 — task count */}
                  {n.task_count != null && (
                    <text
                      x={n.x + NODE_W / 2}
                      y={countY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={8.5}
                      fontWeight={600}
                      fill="rgba(255,255,255,0.65)"
                      style={{ userSelect: 'none' }}
                    >
                      {n.task_count} tareas
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* ── HTML tooltip (positioned relative to containerRef) ── */}
          {tooltip && (
            <div
              style={{
                position:    'absolute',
                left:        tooltip.cx + 14,
                top:         tooltip.cy - 32,
                background:  'hsl(var(--card))',
                border:      '1px solid hsl(var(--border))',
                borderRadius: 8,
                padding:     '7px 12px',
                fontSize:    11,
                boxShadow:   '0 4px 16px rgba(0,0,0,0.12)',
                zIndex:      100,
                pointerEvents: 'none',
                whiteSpace:  'nowrap',
              }}
            >
              <div style={{ fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>
                {tooltip.source} → {tooltip.target}
              </div>
              <div style={{ color: 'hsl(var(--muted-foreground))' }}>
                <strong style={{ color: 'hsl(var(--foreground))' }}>{tooltip.value}</strong> tareas en esta transición
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
