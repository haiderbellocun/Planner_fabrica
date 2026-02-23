import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTemas, useDeleteTema } from '@/hooks/useTemas';
import { useMaterialTypes } from '@/hooks/useMateriales';
import { CreateEditAsignaturaDialog } from '@/components/asignaturas/CreateEditAsignaturaDialog';
import { CreateEditTemaDialog } from '@/components/temas/CreateEditTemaDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react';

interface Asignatura {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
}

interface Programa {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  asignaturas?: Asignatura[];
}

interface ProgramaCardProps {
  programa: Programa;
  onEdit: () => void;
  onDelete: () => void;
}

function AsignaturaItem({ asignatura, programaId }: { asignatura: Asignatura; programaId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editTemaOpen, setEditTemaOpen] = useState(false);
  const [editAsignaturaOpen, setEditAsignaturaOpen] = useState(false);
  const [selectedTema, setSelectedTema] = useState<any>(null);

  const queryClient = useQueryClient();
  const { data: temas = [] } = useTemas(asignatura.id);
  const deleteTema = useDeleteTema(asignatura.id);

  const handleDeleteAsignatura = async () => {
    if (
      confirm(
        `¿Estás seguro de eliminar la asignatura "${asignatura.name}"? Esto eliminará todos sus temas y materiales.`
      )
    ) {
      try {
        await api.delete(`/api/asignaturas/${asignatura.id}`);
        queryClient.invalidateQueries({ queryKey: ['programa', programaId] });
        queryClient.invalidateQueries({ queryKey: ['programas'] });
        toast.success('Asignatura eliminada');
      } catch (error: any) {
        toast.error('Error al eliminar: ' + error.message);
      }
    }
  };

  const handleEditTema = (tema: any) => {
    setSelectedTema(tema);
    setEditTemaOpen(true);
  };

  const handleDeleteTema = (temaId: string, temaTitle: string) => {
    if (confirm(`¿Estás seguro de eliminar el tema "${temaTitle}"?`)) {
      deleteTema.mutate(temaId);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{asignatura.name}</span>
              {asignatura.code && (
                <Badge variant="outline" className="text-xs">
                  {asignatura.code}
                </Badge>
              )}
            </div>
            {asignatura.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {asignatura.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {temas.length} temas
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setEditAsignaturaOpen(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleDeleteAsignatura}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>

        <CollapsibleContent className="pl-8 mt-2 space-y-2">
          {temas.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No hay temas configurados
            </p>
          ) : (
            temas.map((tema) => (
              <div
                key={tema.id}
                className="p-2 rounded-md border bg-muted/30 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-medium">{tema.title}</span>
                    {tema.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tema.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {tema.materiales_count || 0} materiales
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleEditTema(tema)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDeleteTema(tema.id, tema.title)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setSelectedTema(null);
              setEditTemaOpen(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Agregar Tema
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <CreateEditTemaDialog
        asignaturaId={asignatura.id}
        tema={selectedTema}
        open={editTemaOpen}
        onOpenChange={(open) => {
          setEditTemaOpen(open);
          if (!open) setSelectedTema(null);
        }}
      />

      <CreateEditAsignaturaDialog
        programaId={programaId}
        asignatura={asignatura}
        open={editAsignaturaOpen}
        onOpenChange={setEditAsignaturaOpen}
      />
    </>
  );
}

export function ProgramaCardComplete({
  programa,
  onEdit,
  onDelete,
}: ProgramaCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [asignaturaDialogOpen, setAsignaturaDialogOpen] = useState(false);

  const asignaturas = programa.asignaturas || [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </Button>
                <CardTitle className="text-lg">
                  {programa.name}
                  {programa.code && (
                    <Badge variant="outline" className="ml-2">
                      {programa.code}
                    </Badge>
                  )}
                  {programa.tipo_programa && (
                    <Badge variant="secondary" className="ml-2 capitalize">
                      {programa.tipo_programa}
                    </Badge>
                  )}
                </CardTitle>
              </div>
              {programa.description && (
                <CardDescription className="mt-1 ml-7">
                  {programa.description}
                </CardDescription>
              )}
            </div>

            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <Collapsible open={isOpen}>
          <CollapsibleContent>
            <CardContent className="space-y-2">
              {asignaturas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay asignaturas en este programa
                </p>
              ) : (
                asignaturas.map((asignatura) => (
                  <AsignaturaItem
                    key={asignatura.id}
                    asignatura={asignatura}
                    programaId={programa.id}
                  />
                ))
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => setAsignaturaDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Asignatura
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <CreateEditAsignaturaDialog
        programaId={programa.id}
        asignatura={null}
        open={asignaturaDialogOpen}
        onOpenChange={setAsignaturaDialogOpen}
      />
    </>
  );
}
