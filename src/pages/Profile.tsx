import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Profile() {
  const { profile, user } = useAuth();

  const name = profile?.full_name || user?.full_name || 'Sin nombre';
  const email = user?.email || profile?.email || '';
  const roleLabel =
    user?.role === 'admin'
      ? 'Administrador'
      : user?.role === 'project_leader'
        ? 'Project Leader'
        : 'Usuario';

  const initials = (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Mi perfil</h1>
        <p className="page-description">
          Datos básicos de tu cuenta en la plataforma.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Datos básicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user?.avatar_url || profile?.avatar_url || ''} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase">
                Correo institucional
              </p>
              <p>{email || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
