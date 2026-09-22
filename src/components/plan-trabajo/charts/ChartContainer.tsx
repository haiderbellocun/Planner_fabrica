import type { ReactNode } from 'react';
import { Loader2, Inbox, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  actions?: ReactNode;
  children: ReactNode;
  minHeight?: number;
  className?: string;
}

/**
 * Wrapper estándar para toda visualización del Plan de Trabajo: evita que un
 * ResponsiveLine/ResponsiveBar de Nivo intente renderizar con altura 0 o con
 * data.length === 0 (ambos casos rompen Nivo silenciosamente).
 */
export function ChartContainer({
  title,
  subtitle,
  loading,
  empty,
  error,
  emptyMessage = 'Sin datos para este filtro',
  errorMessage = 'No se pudo cargar esta información',
  actions,
  children,
  minHeight = 280,
  className,
}: ChartContainerProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent>
        <div style={{ minHeight }} className="relative w-full">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-6 w-6" />
              <p className="text-xs">{errorMessage}</p>
            </div>
          ) : empty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Inbox className="h-6 w-6" />
              <p className="text-xs">{emptyMessage}</p>
            </div>
          ) : (
            children
          )}
        </div>
      </CardContent>
    </Card>
  );
}
