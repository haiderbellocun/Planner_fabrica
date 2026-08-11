import { useEffect, useState } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useCreateTeam, useUpdateTeam, useSetTeamMembers } from '@/hooks/useTeams';
import type { Team } from '@/types/database';
import type { ProjectMember } from '@/types/database';
import type { Profile } from '@/types/database';

interface CreateTeamDialogProps {
  projectId: string;
  team?: Team | null;
  members: (ProjectMember & { profile: Profile })[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6'];

export function CreateTeamDialog({ projectId, team, members, open, onOpenChange }: CreateTeamDialogProps) {
  const createTeam = useCreateTeam(projectId);
  const updateTeam = useUpdateTeam(projectId);
  const setTeamMembers = useSetTeamMembers(projectId);

  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (team) {
      setName(team.name);
      setColor(team.color || PRESET_COLORS[0]);
      setSelectedProfileIds(team.members.map((m) => m.profile_id));
      return;
    }

    setName('');
    setColor(PRESET_COLORS[0]);
    setSelectedProfileIds([]);
  }, [open, team]);

  const isPending = createTeam.isPending || updateTeam.isPending || setTeamMembers.isPending;

  const toggleProfile = (profileId: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = { name: name.trim(), color };

    try {
      const savedTeam = team
        ? await updateTeam.mutateAsync({ teamId: team.id, data: payload })
        : await createTeam.mutateAsync(payload);

      await setTeamMembers.mutateAsync({ teamId: savedTeam.id, profileIds: selectedProfileIds });
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
            <DialogTitle>{team ? 'Editar equipo' : 'Nuevo equipo'}</DialogTitle>
            <DialogDescription>
              {team ? 'Actualiza el nombre, color y miembros del equipo.' : 'Crea un equipo para agrupar personas del proyecto.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Nombre *</Label>
              <Input
                id="team-name"
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
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este proyecto no tiene miembros para agregar.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {members.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        checked={selectedProfileIds.includes(m.profile.id)}
                        onCheckedChange={() => toggleProfile(m.profile.id)}
                      />
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarImage src={m.profile.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] font-semibold bg-primary/20 text-primary">
                          {m.profile.full_name?.charAt(0) ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.profile.full_name ?? m.profile.email}</span>
                    </label>
                  ))}
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
              {team ? 'Guardar cambios' : 'Crear equipo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
