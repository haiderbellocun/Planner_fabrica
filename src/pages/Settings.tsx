import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useReportTeamCapacity } from '@/hooks/useReports';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: capacity,
    isLoading: capacityLoading,
  } = useReportTeamCapacity();

  const [savingId, setSavingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const members = capacity?.members ?? [];

  const handleChange = (id: string, value: string) => {
    setValues(prev => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSave = async (id: string) => {
    const member = members.find(m => m.id === id);
    if (!member) return;

    const raw =
      values[id] !== undefined
        ? values[id]
        : String(member.weekly_hours_capacity ?? capacity?.schedule.weekly_hours ?? 40.25);

    if (raw === '') {
      toast.error('La capacidad semanal no puede estar vacía.');
      return;
    }

    const value = Number(raw);
    if (Number.isNaN(value) || value < 0) {
      toast.error('Ingresa un número válido mayor o igual a 0.');
      return;
    }

    try {
      setSavingId(id);
      await api.patch<void>(`/api/profiles/${id}/capacity`, {
        weekly_hours_capacity: value,
      });
      toast.success('Capacidad actualizada correctamente.');

      // Refrescar reporte de capacidad del equipo
      await queryClient.invalidateQueries({ queryKey: ['report-team-capacity'] });
    } catch (error: any) {
      toast.error(error?.message || 'Error al guardar la capacidad.');
    } finally {
      setSavingId(null);
    }
  };

  const isLoading = authLoading || capacityLoading;

  return (
    <div className="page-container max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-description">
          Panel de administración de capacidad semanal del equipo
        </p>
      </div>

      <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Capacidad semanal por colaborador
          </CardTitle>
          <CardDescription>
            Ajusta las horas semanales de trabajo de cada miembro del equipo. Solo administradores
            pueden editar estos valores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando datos de capacidad...</span>
            </div>
          )}

          {!isLoading && !isAdmin && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Solo administradores pueden editar capacidad.
            </div>
          )}

          {!isLoading && isAdmin && members.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No hay datos de capacidad de equipo disponibles.
            </div>
          )}

          {!isLoading && isAdmin && members.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Nombre</th>
                    <th className="text-left py-2 px-2 font-medium">Cargo</th>
                    <th className="text-left py-2 px-2 font-medium">Capacidad semanal (h)</th>
                    <th className="text-right py-2 px-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => {
                    const defaultValue = String(
                      member.weekly_hours_capacity
                        ?? capacity?.schedule.weekly_hours
                        ?? 40.25,
                    );
                    const rawValue = values[member.id] ?? defaultValue;
                    const parsed = rawValue === '' ? NaN : Number(rawValue);
                    const isInvalid = rawValue === '' || Number.isNaN(parsed) || parsed < 0;

                    return (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="py-2 px-2">
                          <div className="font-medium">{member.full_name}</div>
                        </td>
                        <td className="py-2 px-2">
                          <span className="text-xs text-muted-foreground">
                            {member.cargo || 'Sin cargo'}
                          </span>
                        </td>
                        <td className="py-2 px-2 w-40">
                          <Input
                            type="number"
                            min={0}
                            step={0.25}
                            value={rawValue}
                            onChange={e => handleChange(member.id, e.target.value)}
                            className="h-9"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            size="sm"
                            disabled={isInvalid || savingId === member.id}
                            onClick={() => handleSave(member.id)}
                          >
                            {savingId === member.id && (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            )}
                            Guardar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
