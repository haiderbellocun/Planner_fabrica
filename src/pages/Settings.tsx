import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="page-container max-w-3xl">
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-description">
          Administra la configuración de tu cuenta y preferencias
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración General
          </CardTitle>
          <CardDescription>
            Próximamente podrás configurar tus preferencias aquí
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>La configuración estará disponible próximamente.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
