import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useReportOntimeByEquipo } from '@/hooks/useReports';
import { chartColors, axisTick, gridColor } from '@/components/charts/chartTheme';
import { Loader2 } from 'lucide-react';

const PALETTE = [chartColors.tealDeep, chartColors.blue] as const;

function Figure({ cx, color }: { cx: number; color: string }) {
  return (
    <g fill={color}>
      <circle cx={cx} cy={76} r={14} />
      {/* Trapezoid torso */}
      <path d={`M${cx - 14},90 L${cx + 14},90 L${cx + 11},134 L${cx - 11},134 Z`} />
      {/* Legs */}
      <rect x={cx - 11} y={134} width={10} height={34} rx={2} />
      <rect x={cx + 1}  y={134} width={10} height={34} rx={2} />
    </g>
  );
}

export function EquipoOntimeChart() {
  const { data = [], isLoading } = useReportOntimeByEquipo();
  const top2 = data.slice(0, 2);

  const left  = top2[0] ?? null;
  const right = top2[1] ?? null;

  const leftColor  = PALETTE[0];
  const rightColor = PALETTE[1];

  return (
    <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Entregas a tiempo</CardTitle>
        <CardDescription className="text-xs">
          Tareas completadas antes del vencimiento, por equipo
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : top2.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Sin datos de tareas completadas
          </div>
        ) : (
          <svg
            viewBox="0 0 320 210"
            width="100%"
            xmlns="http://www.w3.org/2000/svg"
            aria-label={`Entregas a tiempo: ${left?.cargo ?? ''} ${left?.pct ?? 0}%, ${right?.cargo ?? ''} ${right?.pct ?? 0}%`}
            role="img"
          >
            {/* Tinted territory halves */}
            <rect x="0"   y="0" width="160" height="210" fill={leftColor}  fillOpacity={0.08} />
            <rect x="160" y="0" width="160" height="210" fill={rightColor} fillOpacity={0.08} />

            {/* Top accent stripe */}
            <rect x="0"   y="0" width="160" height="3" fill={leftColor}  />
            <rect x="160" y="0" width="160" height="3" fill={rightColor} />

            {/* Ghost percentage text — territory marker */}
            {left && (
              <text
                x="80" y="155" textAnchor="middle"
                fontSize="72" fontWeight="800"
                fill={leftColor} opacity="0.07"
                fontFamily="-apple-system,'Helvetica Neue',Arial,sans-serif"
              >
                {left.pct}%
              </text>
            )}
            {right && (
              <text
                x="240" y="155" textAnchor="middle"
                fontSize="72" fontWeight="800"
                fill={rightColor} opacity="0.07"
                fontFamily="-apple-system,'Helvetica Neue',Arial,sans-serif"
              >
                {right.pct}%
              </text>
            )}

            {/* Vertical hairline */}
            <line x1="160" y1="10" x2="160" y2="190" stroke={gridColor} strokeWidth="0.75" />

            {/* Figures */}
            {left  && <Figure cx={80}  color={leftColor}  />}
            {right && <Figure cx={240} color={rightColor} />}

            {/* Left stats */}
            {left && (
              <>
                <text
                  x="80" y="184" textAnchor="middle"
                  fontSize="18" fontWeight="700" fill={leftColor}
                  letterSpacing="-0.5"
                  fontFamily="-apple-system,'Helvetica Neue',Arial,sans-serif"
                >
                  {left.pct}%
                </text>
                <text
                  x="80" y="197" textAnchor="middle"
                  fontSize="8.5" fontWeight="500" fill={axisTick.fill}
                  letterSpacing="0.8"
                  fontFamily="-apple-system,'Helvetica Neue',Arial,sans-serif"
                >
                  {left.cargo.toUpperCase()}
                </text>
              </>
            )}

            {/* Right stats */}
            {right && (
              <>
                <text
                  x="240" y="184" textAnchor="middle"
                  fontSize="18" fontWeight="700" fill={rightColor}
                  letterSpacing="-0.5"
                  fontFamily="-apple-system,'Helvetica Neue',Arial,sans-serif"
                >
                  {right.pct}%
                </text>
                <text
                  x="240" y="197" textAnchor="middle"
                  fontSize="8.5" fontWeight="500" fill={axisTick.fill}
                  letterSpacing="0.8"
                  fontFamily="-apple-system,'Helvetica Neue',Arial,sans-serif"
                >
                  {right.cargo.toUpperCase()}
                </text>
              </>
            )}

            {/* One-equipo fallback: show centered */}
            {!right && left && (
              <text
                x="240" y="120" textAnchor="middle"
                fontSize="10" fill={axisTick.fill}
                fontFamily="-apple-system,'Helvetica Neue',Arial,sans-serif"
              >
                Sin segundo equipo
              </text>
            )}
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
