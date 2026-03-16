import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MyProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  cargo: string | null;
  avatar_changed_at: string | null;
  email: string;
  role: string;
}

export default function Profile() {
  const { profile, user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get<MyProfile>('/api/profile/me'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return api.postForm<{ avatar_url: string }>('/api/profile/avatar', formData);
    },
    onSuccess: (data) => {
      toast.success('Foto de perfil actualizada');
      setPreview(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      if (updateProfile) {
        updateProfile({ avatar_url: data.avatar_url });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Error al subir la foto';
      toast.error(message);
    },
  });

  const name =
    myProfile?.full_name || profile?.full_name || user?.full_name || 'Sin nombre';
  const email = myProfile?.email || user?.email || profile?.email || '';

  const roleSource = myProfile?.role || user?.role;
  const roleLabel =
    roleSource === 'admin'
      ? 'Administrador'
      : roleSource === 'project_leader'
        ? 'Project Leader'
        : 'Usuario';

  const initials = (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarUrl =
    preview ||
    myProfile?.avatar_url ||
    user?.avatar_url ||
    profile?.avatar_url ||
    '';

  const alreadyUploaded = Boolean(myProfile?.avatar_changed_at);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error('La imagen no puede superar 3MB');
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleConfirm = () => {
    if (selectedFile && !uploadMutation.isPending) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
            <div className="relative group shrink-0">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-sm">{initials}</AvatarFallback>
              </Avatar>

              {!alreadyUploaded && !preview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Subir foto de perfil"
                >
                  <Camera className="h-5 w-5 text-white" />
                </button>
              )}

              {alreadyUploaded && (
                <div
                  className="absolute -bottom-1 -right-1 bg-slate-700 rounded-full p-1"
                  title="Ya subiste tu foto. Solo se permite una vez."
                >
                  <Lock className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>

              {!alreadyUploaded && !preview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 text-xs text-indigo-600 hover:underline"
                >
                  Subir foto de perfil (solo una vez)
                </button>
              )}

              {alreadyUploaded && (
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Foto ya definida
                </p>
              )}
            </div>
          </div>

          {preview && (
            <div className="rounded-xl border border-border p-3 bg-muted/30 space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Vista previa</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={preview} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <p className="text-xs text-muted-foreground">
                  ¿Esta es tu foto? Una vez confirmada no podrás cambiarla.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? 'Subiendo...' : 'Confirmar foto'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={uploadMutation.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t pt-4">
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
