import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel?: string;
  /** Recibe el nombre ya recortado; un nombre vacío no se envía (igual que con el prompt original). */
  onSubmit: (name: string) => void;
}

/** Formulario de un solo campo de texto: reemplaza a window.prompt(). */
export function NameDialog({ open, onOpenChange, title, label, initialValue = '', submitLabel = 'Guardar', onSubmit }: NameDialogProps) {
  const [value, setValue] = useState(initialValue);
  const id = useId();
  useEffect(() => { if (open) setValue(initialValue); }, [open, initialValue]);
  const trimmed = value.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!trimmed) return;
            onSubmit(trimmed);
            onOpenChange(false);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{label}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!trimmed}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
