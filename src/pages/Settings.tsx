import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings, Loader2, UserPlus, Shield, Search, Eye, EyeOff, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useAuth } from '@/contexts/AuthContext';
import { useReportTeamCapacity, type CapacityMember } from '@/hooks/useReports';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAdminUsers, useCreateAdminUser, useToggleUserActive, type AdminUser } from '@/hooks/useAdminUsers';
import { BADGE_TONES } from '@/lib/badgeColors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_META: Record<AdminUser['role'], { label: string; tone: string }> = {
  admin: { label: 'Administrador', tone: BADGE_TONES.special },
  project_leader: { label: 'Líder de proyecto', tone: BADGE_TONES.info },
  user: { label: 'Colaborador', tone: BADGE_TONES.neutral },
};

const RISK_TONES: Record<CapacityMember['risk_color'], string> = {
  red: BADGE_TONES.danger,
  amber: BADGE_TONES.warning,
  sky: BADGE_TONES.info,
  emerald: BADGE_TONES.success,
};

function getInitials(name: string | null | undefined) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function SettingsPage() {
  const { isAdmin, isProjectLeader, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: capacity,
    isLoading: capacityLoading,
  } = useReportTeamCapacity();

  const [savingId, setSavingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [capacitySearch, setCapacitySearch] = useState('');

  const members = capacity?.members ?? [];
  const defaultCapacityFor = (member: CapacityMember) =>
    String(member.weekly_hours_capacity ?? capacity?.schedule.weekly_hours ?? 40.25);
  const filteredMembers = members.filter((m) => {
    const q = capacitySearch.trim().toLowerCase();
    if (!q) return true;
    return m.full_name.toLowerCase().includes(q) || (m.cargo ?? '').toLowerCase().includes(q);
  });

  // Gestión de usuarios (admin + project_leader)
  const canManageUsers = isAdmin || isProjectLeader;
  const { data: adminUsers = [], isLoading: adminUsersLoading } = useAdminUsers(canManageUsers && !authLoading);
  const createUserMutation = useCreateAdminUser();
  const toggleActiveMutation = useToggleUserActive();
  const [userSearch, setUserSearch] = useState('');
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const filteredUsers = adminUsers.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.cargo ?? '').toLowerCase().includes(q)
    );
  });

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    cargo: '',
    password: '',
    role: 'user' as 'admin' | 'project_leader' | 'user',
  });
  const [cargoCustom, setCargoCustom] = useState(false);

  const emailValid = newUser.email.trim().length > 0 && EMAIL_RE.test(newUser.email.trim());
  const canCreateUser =
    newUser.full_name.trim().length > 0 && emailValid && newUser.password.length >= 4;

  const handleChange = (id: string, value: string) => {
    setValues(prev => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSave = async (member: CapacityMember) => {
    const id = member.id;
    const raw = values[id] !== undefined ? values[id] : defaultCapacityFor(member);

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
      toast.success(`Capacidad de ${member.full_name} actualizada.`);

      // Refrescar reporte de capacidad del equipo
      await queryClient.invalidateQueries({ queryKey: ['report-team-capacity'] });
    } catch (error: any) {
      toast.error(error?.message || 'Error al guardar la capacidad.');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateUser = async () => {
    if (!canCreateUser) return;
    try {
      await createUserMutation.mutateAsync({
        full_name: newUser.full_name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        cargo: newUser.cargo || null,
        role: isAdmin ? newUser.role : 'user',
      });
      toast.success(`Usuario ${newUser.full_name.trim()} creado correctamente.`);
      setNewUser({ full_name: '', email: '', cargo: '', password: '', role: 'user' });
      setCargoCustom(false);
      setShowPassword(false);
    } catch (error: any) {
      toast.error(error?.message || 'Error al crear usuario.');
    }
  };

  const handleToggleActive = async (user: AdminUser, nextActive: boolean) => {
    try {
      await toggleActiveMutation.mutateAsync({ id: user.id, is_active: nextActive });
      toast.success(nextActive ? `${user.full_name} habilitado.` : `${user.full_name} deshabilitado.`);
    } catch (error: any) {
      toast.error(error?.message || 'Error al actualizar usuario.');
    } finally {
      setDeactivating(null);
    }
  };

  const isLoading = authLoading || capacityLoading;
  const cargoOptions = [...new Set(adminUsers.map((u) => u.cargo).filter(Boolean) as string[])].sort();

  return (
    <div className="page-container max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-description">
          Capacidad semanal del equipo y gestión de usuarios
        </p>
      </div>

      <Card className="rounded-2xl border border-black/5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] mb-8">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Capacidad semanal por colaborador
              </CardTitle>
              <CardDescription className="mt-1">
                Ajusta las horas semanales de trabajo de cada miembro del equipo. Solo administradores
                pueden editar estos valores.
              </CardDescription>
            </div>
            {!isLoading && isAdmin && members.length > 0 && (
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={capacitySearch}
                  onChange={(e) => setCapacitySearch(e.target.value)}
                  placeholder="Buscar por nombre o cargo..."
                  className="pl-8 h-9"
                  aria-label="Buscar colaborador"
                />
              </div>
            )}
          </div>
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

          {!isLoading && isAdmin && members.length > 0 && filteredMembers.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Ningún colaborador coincide con "{capacitySearch}".
            </div>
          )}

          {!isLoading && isAdmin && filteredMembers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Colaborador</th>
                    <th className="text-left py-2 px-2 font-medium">Carga actual</th>
                    <th className="text-left py-2 px-2 font-medium">Capacidad semanal (h)</th>
                    <th className="text-right py-2 px-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(member => {
                    const defaultValue = defaultCapacityFor(member);
                    const rawValue = values[member.id] ?? defaultValue;
                    const parsed = rawValue === '' ? NaN : Number(rawValue);
                    const isInvalid = rawValue === '' || Number.isNaN(parsed) || parsed < 0;
                    const isDirty = values[member.id] !== undefined && values[member.id] !== defaultValue;
                    const isSaving = savingId === member.id;

                    return (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary-deep">
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{member.full_name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {member.cargo || 'Sin cargo'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <Badge className={`text-xs font-medium border-0 ${RISK_TONES[member.risk_color]}`}>
                            {member.risk_label}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 w-44">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              step={0.25}
                              value={rawValue}
                              onChange={e => handleChange(member.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && isDirty && !isInvalid) handleSave(member);
                              }}
                              className={`h-9 ${isDirty && !isInvalid ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
                              aria-label={`Capacidad semanal de ${member.full_name}`}
                            />
                            {isDirty && !isInvalid && (
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Cambios sin guardar" />
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            size="sm"
                            disabled={isInvalid || !isDirty || isSaving}
                            onClick={() => handleSave(member)}
                          >
                            {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
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
            Crear nuevos usuarios y habilitar/deshabilitar cuentas sin borrarlas. Un usuario deshabilitado
            no puede iniciar sesión ni recibir tareas nuevas. Disponible para administradores y líderes de proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!canManageUsers && (
            <div className="py-4 text-sm text-muted-foreground">
              Solo administradores y líderes de proyecto pueden gestionar usuarios.
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
                      className={newUser.email.length > 0 && !emailValid ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {newUser.email.length > 0 && !emailValid && (
                      <p className="text-xs text-destructive">Ingresa un correo válido.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Cargo</label>
                    {cargoCustom ? (
                      <div className="flex gap-1.5">
                        <Input
                          value={newUser.cargo}
                          onChange={(e) => setNewUser({ ...newUser, cargo: e.target.value })}
                          placeholder="Escribe el cargo..."
                          autoComplete="off"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 flex-shrink-0"
                          onClick={() => { setCargoCustom(false); setNewUser({ ...newUser, cargo: '' }); }}
                          aria-label="Cancelar cargo personalizado"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={newUser.cargo || '__none__'}
                        onValueChange={(v) => {
                          if (v === '__otro__') {
                            setCargoCustom(true);
                            setNewUser({ ...newUser, cargo: '' });
                          } else {
                            setNewUser({ ...newUser, cargo: v === '__none__' ? '' : v });
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Sin cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin cargo</SelectItem>
                          {cargoOptions.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                          <SelectItem value="__otro__">+ Otro cargo...</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Contraseña inicial *</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Mínimo 4 caracteres"
                        className="pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Rol</label>
                      <Select
                        value={newUser.role}
                        onValueChange={(v) => setNewUser({ ...newUser, role: v as 'admin' | 'project_leader' | 'user' })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Colaborador</SelectItem>
                          <SelectItem value="project_leader">Líder de proyecto</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  className="mt-1"
                  onClick={handleCreateUser}
                  disabled={!canCreateUser || createUserMutation.isPending}
                >
                  {createUserMutation.isPending && (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  )}
                  Crear usuario
                </Button>
              </div>

              {/* Lista de usuarios */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Usuarios existentes</h2>
                  {adminUsers.length > 0 && (
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Buscar por nombre, correo o cargo..."
                        className="pl-8 h-9"
                        aria-label="Buscar usuario"
                      />
                    </div>
                  )}
                </div>
                {adminUsersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando usuarios...
                  </div>
                ) : adminUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No hay usuarios registrados.
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Ningún usuario coincide con "{userSearch}".
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
                        {filteredUsers.map((u) => {
                          const roleMeta = ROLE_META[u.role];
                          return (
                            <tr key={u.id} className="border-b last:border-0">
                              <td className="py-2 px-2">
                                <div className="font-medium">{u.full_name}</div>
                                {u.cargo && <div className="text-xs text-muted-foreground">{u.cargo}</div>}
                              </td>
                              <td className="py-2 px-2 text-xs text-muted-foreground">{u.email}</td>
                              <td className="py-2 px-2">
                                <Badge className={`text-xs font-medium border-0 ${roleMeta.tone}`}>
                                  {roleMeta.label}
                                </Badge>
                              </td>
                              <td className="py-2 px-2">
                                <Badge className={`text-xs font-medium border-0 ${u.is_active ? BADGE_TONES.success : BADGE_TONES.neutral}`}>
                                  {u.is_active ? 'Activo' : 'Deshabilitado'}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right">
                                {isAdmin ? (
                                  <Button
                                    size="sm"
                                    variant={u.is_active ? 'outline' : 'default'}
                                    disabled={toggleActiveMutation.isPending}
                                    onClick={() => {
                                      if (u.is_active) {
                                        setDeactivating(u);
                                      } else {
                                        handleToggleActive(u, true);
                                      }
                                    }}
                                  >
                                    {u.is_active ? 'Deshabilitar' : 'Habilitar'}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deactivating} onOpenChange={(open) => { if (!open) setDeactivating(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshabilitar a {deactivating?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              No podrá iniciar sesión ni se le podrán asignar tareas nuevas hasta que lo vuelvas a habilitar.
              Sus tareas actuales no se modifican ni se reasignan automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deactivating && handleToggleActive(deactivating, false)}>
              Deshabilitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
