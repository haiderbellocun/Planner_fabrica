import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitBranch } from 'lucide-react';
import appFlowImg from '@/assets/flujo-app.png';
import dbFlowImg from '@/assets/flujo-bd.png';
import { useState } from 'react';

export default function Flows() {
  const { isAdmin } = useAuth();
  const [selected, setSelected] = useState<'app' | 'db'>('app');
  const [zoom, setZoom] = useState(1.5);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <GitBranch className="h-6 w-6" />
          Flujo
        </h1>
        <p className="page-description">
          Visualiza el flujo de la aplicación o de la base de datos.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Selecciona el flujo</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selected === 'app' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelected('app')}
              >
                Flujo de la aplicación
              </Button>
              <Button
                type="button"
                variant={selected === 'db' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelected('db')}
              >
                Flujo de la base de datos
              </Button>
            </div>
            <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
              <span className="mr-1">Zoom:</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                -
              </Button>
              <span className="w-10 text-center font-medium">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setZoom(1)}
              >
                100%
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[85vh] overflow-auto border rounded-lg flex justify-center bg-muted/30">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                display: 'inline-block',
              }}
            >
              {selected === 'app' ? (
                <img
                  src={appFlowImg}
                  alt="Flujo de la aplicación"
                  className="max-h-[85vh] w-auto h-auto object-contain"
                />
              ) : (
                <img
                  src={dbFlowImg}
                  alt="Flujo de la base de datos"
                  className="max-h-[85vh] w-auto h-auto object-contain"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

