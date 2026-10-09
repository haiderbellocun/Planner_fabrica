import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Para acciones destructivas: qué se eliminará y qué efectos tiene. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Mientras es true: no se puede confirmar de nuevo, cancelar ni cerrar con Esc. */
  busy?: boolean;
  /** Si la operación falló: se explica aquí y el botón pasa a «Reintentar» (el diálogo sigue abierto). */
  errorMessage?: string | null;
  onConfirm: () => void;
}

/**
 * Diálogo de confirmación accesible (AlertDialog de Radix: role="alertdialog", foco atrapado,
 * foco inicial en «Cancelar», Esc cierra). Reemplaza a window.confirm().
 */
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  destructive = false, busy = false, errorMessage = null, onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {errorMessage && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-strong">
            No se pudo completar la acción: {errorMessage} Puedes reintentar o cancelar.
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            aria-busy={busy}
            disabled={busy}
            className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
            onClick={(e) => {
              // Radix cierra el diálogo al pulsar la acción; se mantiene abierto hasta que termine.
              e.preventDefault();
              if (!busy) onConfirm();
            }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {errorMessage && !busy ? 'Reintentar' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface ConfirmRequest {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Acción original. Si devuelve una promesa, el diálogo queda bloqueado hasta que termine. */
  onConfirm: () => void | Promise<unknown>;
}

/**
 * Uso: const { confirmAction, confirmDialog } = useConfirmDialog();
 *      confirmAction({ title, description, destructive: true, onConfirm: () => borrar.mutateAsync(id) });
 *      ... y renderizar {confirmDialog} una vez en el componente.
 * Si la acción falla, el diálogo permanece abierto con el motivo y el botón pasa a «Reintentar»;
 * «Cancelar» lo cierra sin ejecutar nada. Los avisos de la propia mutación (toast) se conservan.
 */
export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const confirmAction = useCallback((r: ConfirmRequest) => { setError(null); setRequest(r); }, []);

  const run = async () => {
    if (!request || running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await request.onConfirm();
      setRequest(null);
    } catch (e) {
      // Se mantiene abierto con la explicación visible; confirmar de nuevo reintenta la misma acción.
      console.error('Acción confirmada falló:', e);
      setError(e instanceof Error && e.message ? e.message : 'Error desconocido.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const confirmDialog = (
    <ConfirmDialog
      open={request !== null}
      onOpenChange={(open) => { if (!open) { setRequest(null); setError(null); } }}
      title={request?.title ?? ''}
      description={request?.description}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      destructive={request?.destructive}
      busy={busy}
      errorMessage={error}
      onConfirm={run}
    />
  );

  return { confirmAction, confirmDialog };
}
