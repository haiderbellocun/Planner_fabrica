import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useEquipos, useUpdateEquipo, useSetEquipoMembers } from '@/hooks/useEquipos';
import { useProfiles } from '@/hooks/useProfiles';
import type { Equipo } from '@/types/database';

interface EditEquipoDialogProps {
  equipo: Equipo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6'];

export function EditEquipoDialog({ equipo, open, onOpenChange }: EditEquipoDialogProps) {
  const updateEquipo = useUpdateEquipo();
  const setEquipoMembers = useSetEquipoMembers();
  const { data: profiles = [] } = useProfiles();
  const { data: equipos = [] } = useEquipos();

  const otherEquipoByProfileId = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of equipos) {
      if (e.id === equipo?.id) continue;
      for (const m of e.members) map.set(m.profile_id, e.name);
    }
    return map;
  }, [equipos, equipo]);

  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !equipo) return;
    setName(equipo.name);
    setColor(equipo.color || PRESET_COLORS[0]);
    setSelectedProfileIds(equipo.members.map((m) => m.profile_id));
  }, [open, equipo]);

  const isPending = updateEquipo.isPending || setEquipoMembers.isPending;

  const toggleProfile = (profileId: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipo || !name.trim()) return;

    try {
      await updateEquipo.mutateAsync({ id: equipo.id, data: { name: name.trim(), color } });
      await setEquipoMembers.mutateAsync({ id: equipo.id, profileIds: selectedProfileIds });
      onOpenChange(false);
    } catch {
      // los toasts de error ya los maneja cada mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar equipo</DialogTitle>
            <DialogDescription>
              Actualiza el nombre, color y miembros del equipo. Cada persona solo puede estar en un equipo a la vez;
              si la seleccionas aquí, se quitará automáticamente del equipo al que pertenecía.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="equipo-name">Nombre *</Label>
              <Input
                id="equipo-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Equipo Backend"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: preset,
                      borderColor: color === preset ? '#111827' : 'transparent',
                    }}
                    aria-label={`Seleccionar color ${preset}`}
                    title={preset}
                  />
                ))}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-8 p-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Miembros</Label>
              {profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay usuarios disponibles para agregar.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {profiles.map((p) => {
                    const otherEquipo = otherEquipoByProfileId.get(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <Checkbox
                          checked={selectedProfileIds.includes(p.id)}
                          onCheckedChange={() => toggleProfile(p.id)}
                        />
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary overflow-hidden flex-shrink-0">
                          {p.avatar_url
                            ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                            : (p.full_name?.charAt(0) ?? '?')}
                        </div>
                        <span className="truncate flex-1">{p.full_name ?? p.email}</span>
                        {otherEquipo && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            en {otherEquipo}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
