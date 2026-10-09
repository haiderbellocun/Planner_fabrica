import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Esqueletos con la forma aproximada del contenido real (misma rejilla, mismas alturas mínimas)
// para que al llegar los datos no haya saltos de diseño. Cada uno es role="status" con una
// etiqueta accesible; las animaciones se anulan con prefers-reduced-motion (index.css).
// Los spinners (<Loader2>) se conservan para acciones puntuales (guardar, enviar).

function Region({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Fila de fichas (misma altura que .stat-tile). */
export function StatTilesSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <Region label="Cargando indicadores" className={cn('grid grid-cols-2 sm:grid-cols-4 gap-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="stat-tile space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </Region>
  );
}

/** Tarjeta con título y un bloque de gráfico de altura fija. */
export function ChartCardSkeleton({ height = 240, className }: { height?: number; className?: string }) {
  return (
    <div className={cn('surface p-card space-y-4', className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

/** Tabla: cabecera + filas. */
export function TableSkeleton({ rows = 6, columns = 5, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <Region label="Cargando tabla" className={cn('surface overflow-hidden', className)}>
      <div className="grid gap-4 px-4 py-3 border-b border-border" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, c) => <Skeleton key={c} className="h-3 w-3/4" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-4 px-4 py-3.5 border-b border-border last:border-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, c) => <Skeleton key={c} className="h-4" style={{ width: `${60 + ((r + c) % 4) * 10}%` }} />)}
        </div>
      ))}
    </Region>
  );
}

/** Lista de tarjetas/filas (proyectos recientes, notificaciones…). */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <Region label="Cargando lista" className={cn('space-y-2', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </Region>
  );
}

/** Rejilla de tarjetas de proyecto. */
export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <Region label="Cargando proyectos" className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="surface p-card space-y-4 min-h-[168px]">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2 w-full rounded-full mt-6" />
        </div>
      ))}
    </Region>
  );
}

/** Pestaña de reportes: fichas + dos gráficos. */
export function ReportTabSkeleton() {
  return (
    <div className="space-y-6">
      <StatTilesSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}

/** Capacidad Operativa: cabecera de filtros, 5 fichas, gráfico y tabla. */
export function CapacitySkeleton() {
  return (
    <div className="space-y-7" role="status" aria-busy="true" aria-label="Cargando capacidad operativa">
      <span className="sr-only">Cargando capacidad operativa</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="stat-tile space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <ChartCardSkeleton height={260} />
      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}

/** Dashboard: saludo, fichas, lista y panel lateral. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-busy="true" aria-label="Cargando inicio">
      <span className="sr-only">Cargando inicio</span>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <StatTilesSkeleton count={4} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {Array.from({ length: 3 }, (_, i) => <div key={i} className="stat-tile space-y-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-14" /></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <div className="lg:col-span-2 surface p-card"><ListSkeleton rows={4} /></div>
        <div className="surface p-card"><ListSkeleton rows={3} /></div>
      </div>
    </div>
  );
}

/** Marcador del PageHeader (título + subtítulo) mientras carga la página. */
export function PageHeaderSkeleton() {
  return (
    <div className="page-header space-y-2" aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Página genérica: encabezado, fichas y lista (misma estructura que la mayoría de pantallas). */
export function PageSkeleton({ tiles = 4, rows = 5, className }: { tiles?: number; rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-busy="true" aria-label="Cargando página">
      <span className="sr-only">Cargando página</span>
      <PageHeaderSkeleton />
      {tiles > 0 && <StatTilesSkeleton count={tiles} />}
      <div className="surface p-card"><ListSkeleton rows={rows} /></div>
    </div>
  );
}

/** Calendario: cuadrícula de 7 columnas × 5 filas con el mismo ancho mínimo que la vista real. */
export function CalendarSkeleton() {
  return (
    <div className="flex-1 overflow-auto" role="status" aria-busy="true" aria-label="Cargando calendario">
      <span className="sr-only">Cargando calendario</span>
      <div className="grid grid-cols-7 gap-px min-w-[640px]">
        {Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="h-[100px] rounded-none" />)}
      </div>
    </div>
  );
}

/** Tablero Kanban: columnas con tarjetas (misma altura mínima que las columnas reales). */
export function KanbanSkeleton({ columns = 4, cards = 3 }: { columns?: number; cards?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto" role="status" aria-busy="true" aria-label="Cargando tablero">
      <span className="sr-only">Cargando tablero</span>
      {Array.from({ length: columns }, (_, c) => (
        <div key={c} className="kanban-column w-72 shrink-0 space-y-3">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="surface p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Detalle de proyecto: migas, encabezado, pestañas y contenido. */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Cargando proyecto">
      <span className="sr-only">Cargando proyecto</span>
      <Skeleton className="h-4 w-48" />
      <PageHeaderSkeleton />
      <StatTilesSkeleton count={4} />
      <Skeleton className="h-10 w-full max-w-md rounded-full" />
      <KanbanSkeleton columns={3} cards={2} />
    </div>
  );
}

/** Formulario/calculadora: dos tarjetas con campos. */
export function FormSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Cargando formulario">
      <span className="sr-only">Cargando formulario</span>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="surface p-card space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
