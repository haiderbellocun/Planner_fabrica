import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings, Loader2, UserPlus, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useReportTeamCapacity } from '@/hooks/useReports';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAdminUsers, useCreateAdminUser, useToggleUserActive } from '@/hooks/useAdminUsers';

export default function SettingsPage() {
  const { isAdmin, isProjectLeader, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: capacity,
    isLoading: capacityLoading,
  } = useReportTeamCapacity();

  const [savingId, setSavingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const members = capacity?.members ?? [];

  // Gestión de usuarios (admin + project_leader)
  const canManageUsers = isAdmin || isProjectLeader;
  const { data: adminUsers = [], isLoading: adminUsersLoading } = useAdminUsers(canManageUsers && !authLoading);
  const createUserMutation = useCreateAdminUser();
  const toggleActiveMutation = useToggleUserActive();

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    cargo: '',
    password: '',
    role: 'user' as 'admin' | 'project_leader' | 'user',
  });

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

      <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] mb-8">
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

      {/* Gestión de usuarios */}
      <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestión de usuarios
          </CardTitle>
          <CardDescription>
            Crear nuevos usuarios y habilitar/deshabilitar cuentas sin borrarlas. Disponible para administradores y project_leaders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!canManageUsers && (
            <div className="py-4 text-sm text-muted-foreground">
              Solo administradores y project_leaders pueden gestionar usuarios.
            </div>
          )}

          {canManageUsers && (
            <>
              {/* Crear usuario */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Crear nuevo usuario
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Nombre completo *</label>
                    <Input
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      placeholder="Ej: Nombre Apellido"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Correo *</label>
                    <Input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="correo@cun.edu.co"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Cargo</label>
                    <Input
                      value={newUser.cargo}
                      onChange={(e) => setNewUser({ ...newUser, cargo: e.target.value })}
                      placeholder="Ej: Diseñador, Project Leader..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Contraseña inicial *</label>
                    <Input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Contraseña temporal"
                    />
                  </div>
                  {isAdmin && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Rol</label>
                      <select
                        value={newUser.role}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            role: e.target.value as 'admin' | 'project_leader' | 'user',
                          })
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="user">Usuario</option>
                        <option value="project_leader">Project Leader</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  className="mt-1"
                  onClick={async () => {
                    if (!newUser.full_name || !newUser.email || !newUser.password) {
                      toast.error('Nombre, correo y contraseña son requeridos.');
                      return;
                    }
                    try {
                      await createUserMutation.mutateAsync({
                        full_name: newUser.full_name,
                        email: newUser.email,
                        password: newUser.password,
                        cargo: newUser.cargo || null,
                        role: isAdmin ? newUser.role : 'user',
                      });
                      toast.success('Usuario creado correctamente.');
                      setNewUser({
                        full_name: '',
                        email: '',
                        cargo: '',
                        password: '',
                        role: 'user',
                      });
                    } catch (error: any) {
                      toast.error(error?.message || 'Error al crear usuario.');
                    }
                  }}
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending && (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  )}
                  Crear usuario
                </Button>
              </div>

              {/* Lista de usuarios */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">Usuarios existentes</h2>
                {adminUsersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando usuarios...
                  </div>
                ) : adminUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No hay usuarios registrados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 px-2 font-medium">Nombre</th>
                          <th className="text-left py-2 px-2 font-medium">Correo</th>
                          <th className="text-left py-2 px-2 font-medium">Rol</th>
                          <th className="text-left py-2 px-2 font-medium">Estado</th>
                          <th className="text-right py-2 px-2 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((u) => (
                          <tr key={u.id} className="border-b last:border-0">
                            <td className="py-2 px-2">{u.full_name}</td>
                            <td className="py-2 px-2 text-xs text-muted-foreground">{u.email}</td>
                            <td className="py-2 px-2 text-xs capitalize">{u.role}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  u.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                {u.is_active ? 'Activo' : 'Deshabilitado'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <Button
                                size="sm"
                                variant={u.is_active ? 'outline' : 'default'}
                                onClick={async () => {
                                  try {
                                    await toggleActiveMutation.mutateAsync({
                                      id: u.id,
                                      is_active: !u.is_active,
                                    });
                                    toast.success(
                                      u.is_active
                                        ? 'Usuario deshabilitado.'
                                        : 'Usuario habilitado.'
                                    );
                                  } catch (error: any) {
                                    toast.error(error?.message || 'Error al actualizar usuario.');
                                  }
                                }}
                              >
                                {u.is_active ? 'Deshabilitar' : 'Habilitar'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
