import type { ReactNode } from 'react';
import { Loader2, Inbox, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeError, getErrorStatus } from '@/lib/apiError';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  /** Error original de la consulta: permite explicar el motivo (permisos, red, servidor). */
  errorDetail?: unknown;
  /** Si se pasa, el error ofrece «Reintentar» (salvo 403). */
  onRetry?: () => void;
  retrying?: boolean;
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
  errorDetail,
  onRetry,
  retrying,
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
            <div className="absolute inset-0" role="status" aria-busy="true" aria-label={`Cargando ${title}`}>
              <Skeleton className="h-full w-full rounded-lg" />
            </div>
          ) : error ? (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
              {getErrorStatus(errorDetail) === 403 || getErrorStatus(errorDetail) === 401 ? <ShieldAlert className="h-6 w-6" aria-hidden="true" /> : <AlertTriangle className="h-6 w-6" aria-hidden="true" />}
              <p className="text-xs">{errorDetail === undefined ? errorMessage : describeError(errorDetail, errorMessage).message}</p>
              {onRetry && getErrorStatus(errorDetail) !== 403 && (
                <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
                  {retrying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Reintentar
                </Button>
              )}
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
