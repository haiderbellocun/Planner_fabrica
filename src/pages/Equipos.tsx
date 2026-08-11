import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Pencil, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEquipos } from '@/hooks/useEquipos';
import { EditEquipoDialog } from '@/components/equipos/EditEquipoDialog';
import { StatTile } from '@/components/shared/StoryUI';
import type { Equipo } from '@/types/database';

export default function Equipos() {
  const navigate = useNavigate();
  const { data: equipos = [], isLoading } = useEquipos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState<Equipo | null>(null);

  const handleEdit = (equipo: Equipo) => {
    setSelectedEquipo(equipo);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Equipos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona los 5 equipos de trabajo: nombre, color y miembros.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Cargando equipos...</CardContent>
        </Card>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatTile label="Equipos formados" value={`${equipos.length}/5`} />
          <StatTile label="Personas asignadas" value={equipos.reduce((s, e) => s + e.members.length, 0)} />
          <StatTile
            label="Sin miembros"
            value={equipos.filter(e => e.members.length === 0).length}
            pill={equipos.some(e => e.members.length === 0) ? { tone: 'warning', label: 'Pendiente' } : { tone: 'good', label: 'Completo' }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {equipos.map((equipo) => (
            <Card key={equipo.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div style={{ borderLeft: `4px solid ${equipo.color}` }} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium truncate">{equipo.name}</h3>
                    <div className="flex items-center shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => navigate(`/equipos/${equipo.id}/plan`)}
                        title="Ver plan semanal"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(equipo)}
                        title="Editar equipo"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {equipo.members.length > 0 ? (
                    <div className="flex items-center -space-x-2">
                      {equipo.members.slice(0, 6).map((m) => (
                        <div
                          key={m.id}
                          className="h-7 w-7 rounded-full ring-2 ring-white bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary overflow-hidden"
                          title={m.full_name ?? ''}
                        >
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                            : (m.full_name?.charAt(0) ?? '?')}
                        </div>
                      ))}
                      {equipo.members.length > 6 && (
                        <div className="h-7 w-7 rounded-full ring-2 ring-white bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                          +{equipo.members.length - 6}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin miembros asignados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}

      <EditEquipoDialog
        equipo={selectedEquipo}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedEquipo(null);
        }}
      />
    </div>
  );
}
