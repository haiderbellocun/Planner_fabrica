import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ErrorState, RefetchError, UpdatingIndicator } from '@/components/shared/StoryUI';

type QueryLike<T> = Pick<UseQueryResult<T>, 'data' | 'isPending' | 'isError' | 'error' | 'refetch' | 'isFetching'> &
  Partial<Pick<UseQueryResult<T>, 'isPlaceholderData'>>;

interface QueryGateProps<T> {
  query: QueryLike<T>;
  /** Esqueleto con la forma del contenido (carga inicial, sin datos). */
  loading: ReactNode;
  /** Qué no se pudo cargar: «No se pudieron cargar las entregas.» */
  errorMessage: string;
  /** Si devuelve true se muestra `empty` (registros inexistentes). Los filtros sin resultados los resuelve cada vista. */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
  className?: string;
}

/**
 * Los seis estados de una consulta, en un solo lugar:
 *  1. carga inicial (sin datos)            → `loading`
 *  2. datos disponibles                    → `children(data)`
 *  3. error sin datos                      → ErrorState (con motivo, permisos y «Reintentar»)
 *  4. error con datos anteriores en caché  → los datos + aviso RefetchError (no los oculta)
 *  5. lista realmente vacía                → `empty`
 *  6. filtros sin resultados               → lo resuelve la vista dentro de `children` (NoResultsState)
 * Una actualización en segundo plano con datos muestra un indicador discreto; si los datos son de
 * una consulta anterior (placeholder), se atenúan y se marcan aria-busy para no confundirlos con los nuevos.
 */
export function QueryGate<T>({ query, loading, errorMessage, isEmpty, empty, children, className }: QueryGateProps<T>) {
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = query;
  const hasData = data !== undefined && data !== null;

  if (!hasData) {
    if (isError) return <ErrorState message={errorMessage} error={error} onRetry={() => { void refetch(); }} retrying={isFetching} />;
    if (isPending) return <>{loading}</>;
    return <>{empty ?? null}</>;
  }

  return (
    <div className={className} aria-busy={isPlaceholderData || undefined}>
      {isError && <RefetchError error={error} onRetry={() => { void refetch(); }} retrying={isFetching} />}
      {isFetching && !isError && <div className="mb-2 min-h-4"><UpdatingIndicator active /></div>}
      <div className={cn('transition-opacity duration-ui', isPlaceholderData && 'opacity-60')}>
        {isEmpty?.(data) ? (empty ?? null) : children(data)}
      </div>
    </div>
  );
}
