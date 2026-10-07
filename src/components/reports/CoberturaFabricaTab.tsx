import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import informeJson from '@/data/informeFabrica2026.json';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { HeroBanner, SectionHeader } from '@/components/shared/StoryUI';
import { cn } from '@/lib/utils';

type Presencia = 'dentro' | 'proceso' | 'puerta' | 'fuera' | 'na';
type Cobertura = 'completo' | 'proceso' | 'parcial' | 'puerta' | 'fuera';
type FrenteId = 'gif' | 'analistas' | 'presentadoras';

interface FrenteCelda {
  raw: string;
  presencia: Presencia;
}

interface Programa {
  id: string;
  linea: string;
  nombre: string;
  area: string;
  nota: string;
  frentes: Partial<Record<FrenteId, FrenteCelda>>;
  cobertura: Cobertura;
}

interface Informe {
  fuente: string;
  programas: Programa[];
  openDental: {
    modulos: { id: string; nombre: string; etapas: { etapa: string; raw: string; presencia: Presencia }[] }[];
    cursosHtml: { nombre: string; equipo: string; raw: string; presencia: Presencia }[];
  };
  escuela: {
    fases: { nombre: string; raw: string; entregables: string; presencia: Presencia }[];
    etapas: { nombre: string; avance: number }[];
  };
  tendencias: {
    pausado: boolean;
    indicadores: { nombre: string; meta: string; avance: string; estado: string }[];
    semana: { dia: string; actividad: string; entregable: string; estado: string }[];
    inicio: string;
    fechasProgramadas: number;
    noEntregados: number;
    entregados: number;
    nota: string;
  };
  bienestar: {
    materiales: { tipo: string; total: number; listos: number; pendientes: number }[];
    apps: { nombre: string; videos: number; infografias: number; podcast: number; estadoVideos: string }[];
    proyectoTerminado: boolean;
    nota: string;
  };
  remasterizacion: {
    programas: { nombre: string; tipo: string; raw: string; presencia: Presencia }[];
    hitos: { fecha: string; actividad: string; alcance: string }[];
    proyectoTerminado: boolean;
    resumen: { total: number; editados: number; grabadosPorEditar: number; pendientesGrabacion: number };
  };
}

const informe = informeJson as Informe;

const CARD = 'rounded-2xl border border-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)]';

const FRENTES: { id: FrenteId; label: string }[] = [
  { id: 'gif', label: 'GIF' },
  { id: 'analistas', label: 'Analistas' },
  { id: 'presentadoras', label: 'Presentadoras' },
];

const LINEAS = [
  'Tania',
  'Producto',
  'Registro calificado',
  'Diplomados internos',
  'Correcciones',
  'Diplomado de salud',
] as const;

const LINEA_CORTA: Record<string, string> = {
  Tania: 'Tania',
  Producto: 'Producto',
  'Registro calificado': 'Registro',
  'Diplomados internos': 'Diplomados',
  Correcciones: 'Correcciones',
  'Diplomado de salud': 'Salud',
};

type EstadoPrograma = 'entregado' | 'sin_iniciar';

const ESTADOS: { id: EstadoPrograma; label: string; hint: string; fill: string; soft: string; ink: string }[] = [
  { id: 'entregado', label: 'Entregado', hint: 'Todos los frentes que aplican están terminados', fill: '#0CA35A', soft: '#E7F6EE', ink: '#067647' },
  { id: 'sin_iniciar', label: 'Pausa', hint: 'Ningún frente está terminado del todo. Si otra área ya cerró, el programa sigue en pausa', fill: '#FF6B4A', soft: '#FFF1ED', ink: '#C2412D' },
];

const PRESENCIA_STYLE: Record<Presencia, { fill: string; ink: string; label: string }> = {
  dentro: { fill: '#0CA35A', ink: '#067647', label: 'Entregado' },
  proceso: { fill: '#0DD9D0', ink: '#067A76', label: 'En proceso' },
  puerta: { fill: '#E8A317', ink: '#92600A', label: 'Plantilla lista' },
  fuera: { fill: '#FF6B4A', ink: '#C2412D', label: 'Pausa' },
  na: { fill: '#D5E3E1', ink: '#6B7F7C', label: 'No aplica' },
};

function lecturaFrente(presencia: Presencia) {
  if (presencia === 'dentro') return PRESENCIA_STYLE.dentro;
  if (presencia === 'na') return PRESENCIA_STYLE.na;
  return PRESENCIA_STYLE.fuera;
}

function queFalta(programa: Programa): string {
  const pendientes = FRENTES.flatMap((frente) => {
    const celda = programa.frentes[frente.id];
    if (!celda || celda.presencia === 'na' || celda.presencia === 'dentro') return [];
    return [`${frente.label}: ${celda.raw}`];
  });
  return pendientes.length > 0 ? pendientes.join(' · ') : 'Todos los frentes están terminados';
}

function estadoPrograma(programa: Programa): EstadoPrograma {
  const frentes = Object.values(programa.frentes).filter((frente) => frente && frente.presencia !== 'na');
  if (frentes.length > 0 && frentes.every((frente) => frente.presencia === 'dentro')) return 'entregado';
  return 'sin_iniciar';
}

function estadoDe(id: EstadoPrograma) {
  return ESTADOS.find((estado) => estado.id === id) ?? ESTADOS[1];
}

type FiltroZona = 'todas' | 'entregado' | 'sin_iniciar';

function pasaFiltro(programa: Programa, linea: string, zona: FiltroZona, query: string) {
  if (linea !== 'todas' && programa.linea !== linea) return false;
  if (zona !== 'todas' && estadoPrograma(programa) !== zona) return false;
  if (query) {
    const blob = `${programa.nombre} ${programa.area} ${programa.nota}`.toLowerCase();
    if (!blob.includes(query)) return false;
  }
  return true;
}

export function CoberturaFabricaTab() {
  const programas = informe.programas;
  const cuentas = useMemo(() => {
    let entregados = 0;
    for (const programa of programas) {
      if (estadoPrograma(programa) === 'entregado') entregados += 1;
    }
    return { entregados, sinIniciar: programas.length - entregados, total: programas.length };
  }, [programas]);

  return (
    <div className="space-y-8">
      <HeroBanner
        eyebrow="Informe 2026 · qué está en fábrica"
        story={`De ${cuentas.total} programas, ${cuentas.entregados} están entregados: todos sus frentes quedaron terminados. Los otros ${cuentas.sinIniciar} están en pausa. Si un área ya cerró y otra no, el programa sigue en pausa.`}
        stats={[
          { value: String(cuentas.entregados), label: 'Entregados' },
          { value: String(cuentas.sinIniciar), label: 'En pausa' },
        ]}
      />

      <TotalesCobertura programas={programas} entregados={cuentas.entregados} pendientes={cuentas.sinIniciar} total={cuentas.total} />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className={cn(CARD, 'xl:col-span-3')}>
          <CardContent className="p-5">
            <SectionHeader tag="Flujo" title="De cada línea hacia donde está hoy" />
            <p className="mb-4 text-sm text-muted-foreground">
              El grosor de cada cinta es la cantidad de programas. Entregado exige que todos los frentes estén terminados. El resto queda pendiente, en pausa.
            </p>
            <FlujoCobertura programas={programas} />
          </CardContent>
        </Card>

        <Card className={cn(CARD, 'xl:col-span-2')}>
          <CardContent className="p-5">
            <SectionHeader tag="Por línea" title="Cobertura por línea de producción" />
            <p className="mb-4 text-sm text-muted-foreground">
              Un programa se registra como entregado cuando todos los frentes aplicables están terminados.
            </p>
            <PorLinea programas={programas} />
          </CardContent>
        </Card>
      </div>

      <MapaProgramas programas={programas} />

      <div className="grid gap-4 xl:grid-cols-2">
        <OpenDentalCard />
        <EscuelaCard />
        <TendenciasCard />
        <BienestarCard />
      </div>

      <RemasterCard />
    </div>
  );
}

function FlujoCobertura({ programas }: { programas: Programa[] }) {
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const width = 680;
    const height = 480;
    const x1 = 148;
    const x2 = 420;
    const nodeW = 12;
    const top = 16;
    const gap = 10;
    const usable = height - top * 2 - gap * (LINEAS.length - 1);

    const conteoLinea: Record<string, number> = {};
    const conteoZona: Record<string, number> = {};
    const pares = new Map<string, number>();
    for (const linea of LINEAS) conteoLinea[linea] = 0;
    for (const zona of ESTADOS) conteoZona[zona.id] = 0;
    for (const programa of programas) {
      const estado = estadoPrograma(programa);
      conteoLinea[programa.linea] = (conteoLinea[programa.linea] ?? 0) + 1;
      conteoZona[estado] += 1;
      const key = `${programa.linea}|${estado}`;
      pares.set(key, (pares.get(key) ?? 0) + 1);
    }
    const total = programas.length || 1;

    let cursor = top;
    const left = LINEAS.map((linea) => {
      const h = ((conteoLinea[linea] ?? 0) / total) * usable;
      const node = { id: linea, y: cursor, h, n: conteoLinea[linea] ?? 0 };
      cursor += h + gap;
      return node;
    });

    const zonasVisibles = ESTADOS.filter((z) => (conteoZona[z.id] ?? 0) > 0);
    const usableR = height - top * 2 - gap * (zonasVisibles.length - 1);
    cursor = top;
    const right = zonasVisibles.map((zona) => {
      const h = (conteoZona[zona.id] / total) * usableR;
      const node = { ...zona, y: cursor, h, n: conteoZona[zona.id] };
      cursor += h + gap;
      return node;
    });

    let etiquetaY = top;
    const rightConEtiqueta = right.map((nodo) => {
      const preferida = nodo.y + Math.max(nodo.h, 12) / 2;
      const y = Math.max(preferida, etiquetaY);
      etiquetaY = y + 26;
      return { ...nodo, etiquetaY: y };
    });

    const leftUsed: Record<string, number> = {};
    const rightUsed: Record<string, number> = {};
    const cintas: {
      key: string;
      d: string;
      fill: string;
      n: number;
      linea: string;
      zona: string;
    }[] = [];

    for (const origen of left) {
      for (const destino of right) {
        const n = pares.get(`${origen.id}|${destino.id}`) ?? 0;
        if (!n) continue;
        const h1 = origen.n ? (n / origen.n) * origen.h : 0;
        const h2 = destino.n ? (n / destino.n) * destino.h : 0;
        const y1 = origen.y + (leftUsed[origen.id] ?? 0);
        const y2 = destino.y + (rightUsed[destino.id] ?? 0);
        leftUsed[origen.id] = (leftUsed[origen.id] ?? 0) + h1;
        rightUsed[destino.id] = (rightUsed[destino.id] ?? 0) + h2;
        const c = (x2 - x1) * 0.45;
        const d = [
          `M ${x1 + nodeW} ${y1}`,
          `C ${x1 + nodeW + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`,
          `L ${x2} ${y2 + h2}`,
          `C ${x2 - c} ${y2 + h2}, ${x1 + nodeW + c} ${y1 + h1}, ${x1 + nodeW} ${y1 + h1}`,
          'Z',
        ].join(' ');
        cintas.push({
          key: `${origen.id}|${destino.id}`,
          d,
          fill: destino.fill,
          n,
          linea: LINEA_CORTA[origen.id] ?? origen.id,
          zona: destino.label,
        });
      }
    }

    const altura = Math.max(height, etiquetaY + 8);
    return { width, height: altura, x1, x2, nodeW, left, right: rightConEtiqueta, cintas };
  }, [programas]);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="h-auto w-full" role="img" aria-label="Flujo de programas por línea y estado en fábrica">
        {layout.cintas.map((cinta) => {
          const active = hover === null || hover === cinta.key;
          return (
            <path
              key={cinta.key}
              d={cinta.d}
              fill={cinta.fill}
              opacity={active ? 0.72 : 0.08}
              onMouseEnter={() => setHover(cinta.key)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${cinta.linea} → ${cinta.zona}: ${cinta.n} programas`}</title>
            </path>
          );
        })}
        {layout.left.map((nodo) => (
          <g key={nodo.id}>
            <rect x={layout.x1} y={nodo.y} width={layout.nodeW} height={Math.max(nodo.h, 1)} rx={4} fill="#067A76" />
            <text x={layout.x1 - 10} y={nodo.y + nodo.h / 2} textAnchor="end" dominantBaseline="middle" fill="#1F2A2A" fontSize="12" fontWeight="600">
              {LINEA_CORTA[nodo.id]}
            </text>
            <text x={layout.x1 - 10} y={nodo.y + nodo.h / 2 + 14} textAnchor="end" dominantBaseline="middle" fill="#6B7F7C" fontSize="10">
              {nodo.n}
            </text>
          </g>
        ))}
        {layout.right.map((nodo) => (
          <g key={nodo.id}>
            <rect x={layout.x2} y={nodo.y} width={layout.nodeW} height={Math.max(nodo.h, 1)} rx={4} fill={nodo.fill} />
            <text x={layout.x2 + layout.nodeW + 10} y={nodo.etiquetaY} dominantBaseline="middle" fill="#1F2A2A" fontSize="12" fontWeight="600">
              {nodo.label}
              <tspan fill="#6B7F7C" fontWeight="500">{`  ${nodo.n}`}</tspan>
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function TotalesCobertura({
  programas,
  entregados,
  pendientes,
  total,
}: {
  programas: Programa[];
  entregados: number;
  pendientes: number;
  total: number;
}) {
  const [panel, setPanel] = useState<EstadoPrograma | null>(null);
  const [lineaAbierta, setLineaAbierta] = useState<string | null>(LINEAS[0]);
  const pct = total ? (entregados / total) * 100 : 0;

  const filas = useMemo(
    () =>
      LINEAS.map((linea) => {
        const grupo = programas.filter((p) => p.linea === linea);
        const si = grupo.filter((p) => estadoPrograma(p) === 'entregado').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        const no = grupo.filter((p) => estadoPrograma(p) !== 'entregado').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        return { linea, corta: LINEA_CORTA[linea], si, no, total: grupo.length };
      }),
    [programas],
  );

  function elegir(estado: EstadoPrograma) {
    setPanel((actual) => (actual === estado ? null : estado));
  }

  return (
    <section className={cn(CARD, 'p-5')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cobertura</p>
          <h2 className="text-base font-semibold text-foreground">{total} programas</h2>
        </div>
        <p className="text-xs text-muted-foreground">Seleccione un estado para ver el detalle por línea.</p>
      </div>

      <div className="mt-4 grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button
          type="button"
          aria-expanded={panel === 'entregado'}
          onClick={() => elegir('entregado')}
          className={cn(
            'rounded-xl px-1 py-1 text-left transition',
            panel === 'entregado' ? 'text-[#067647]' : 'text-foreground hover:text-[#067647]',
          )}
        >
          <span className="block text-3xl font-semibold tabular-nums leading-none">{entregados}</span>
          <span className="mt-1 block text-xs font-medium">Entregados</span>
        </button>

        <div className="flex h-3 overflow-hidden rounded-full bg-[#FF6B4A]" aria-hidden>
          <div className="h-full rounded-full bg-[#0CA35A]" style={{ width: `${pct}%` }} />
        </div>

        <button
          type="button"
          aria-expanded={panel === 'sin_iniciar'}
          onClick={() => elegir('sin_iniciar')}
          className={cn(
            'rounded-xl px-1 py-1 text-right transition',
            panel === 'sin_iniciar' ? 'text-[#C2412D]' : 'text-foreground hover:text-[#C2412D]',
          )}
        >
          <span className="block text-3xl font-semibold tabular-nums leading-none">{pendientes}</span>
          <span className="mt-1 block text-xs font-medium">Pendientes</span>
        </button>
      </div>

      {panel ? (
        <div className="mt-5 border-t border-border pt-2">
          {filas.map((fila) => {
            const abierta = lineaAbierta === fila.linea;
            return (
              <div key={fila.linea} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  aria-expanded={abierta}
                  onClick={() => setLineaAbierta(abierta ? null : fila.linea)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition', abierta && 'rotate-180')} />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{fila.corta}</span>
                  <span className="text-xs tabular-nums text-[#067647]">{fila.si.length} entregados</span>
                  <span className="text-xs tabular-nums text-[#C2412D]">{fila.no.length} pendientes</span>
                </button>
                {abierta ? (
                  <div className="grid gap-3 pb-4 sm:grid-cols-2">
                    <ListaProgramas titulo="Entregados" programas={fila.si} activo={panel === 'entregado'} tono="si" />
                    <ListaProgramas titulo="Pendientes" programas={fila.no} activo={panel === 'sin_iniciar'} tono="no" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ListaProgramas({
  titulo,
  programas,
  activo,
  tono,
}: {
  titulo: string;
  programas: Programa[];
  activo: boolean;
  tono: 'si' | 'no';
}) {
  const color = tono === 'si' ? '#067647' : '#C2412D';
  return (
    <div className={cn('rounded-xl px-3 py-2', activo ? (tono === 'si' ? 'bg-[#E7F6EE]' : 'bg-[#FFF1ED]') : 'bg-muted/40')}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
        {titulo} · {programas.length}
      </p>
      {programas.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Sin programas en este estado.</p>
      ) : (
        <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
          {programas.map((programa) => (
            <li key={programa.id} className="text-xs leading-snug text-foreground">
              {programa.nombre}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PorLinea({ programas }: { programas: Programa[] }) {
  const filas = LINEAS.map((linea) => {
    const grupo = programas.filter((p) => p.linea === linea);
    const entregados = grupo.filter((p) => estadoPrograma(p) === 'entregado').length;
    const total = grupo.length;
    const pendientes = total - entregados;
    const pct = total ? (entregados / total) * 100 : 0;
    return { linea, corta: LINEA_CORTA[linea], entregados, pendientes, total, pct };
  });

  return (
    <ul className="space-y-4">
      {filas.map((fila) => (
        <li key={fila.linea}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">{fila.corta}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{fila.entregados} de {fila.total}</span>
          </div>
          <div className="flex h-7 overflow-hidden rounded-lg bg-[#FFF1ED]" aria-hidden>
            {fila.entregados > 0 ? (
              <div
                className="flex items-center justify-end px-2 text-[11px] font-semibold text-white"
                style={{ width: `${Math.max(fila.pct, fila.pct > 0 ? 8 : 0)}%`, background: '#0CA35A' }}
              >
                {fila.pct >= 18 ? fila.entregados : ''}
              </div>
            ) : null}
            {fila.pendientes > 0 ? (
              <div className="flex flex-1 items-center px-2 text-[11px] font-semibold text-[#C2412D]">
                {fila.pct <= 82 ? fila.pendientes : ''}
              </div>
            ) : null}
          </div>
          <div className="mt-1 flex justify-between text-[11px]">
            <span className="font-medium text-[#067647]">{fila.entregados} entregados</span>
            <span className="font-medium text-[#C2412D]">{fila.pendientes} pendientes</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MapaProgramas({ programas }: { programas: Programa[] }) {
  const [linea, setLinea] = useState<string>('todas');
  const [zona, setZona] = useState<FiltroZona>('todas');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const busqueda = query.trim().toLowerCase();

  const visibles = useMemo(
    () => programas.filter((p) => pasaFiltro(p, linea, zona, busqueda)),
    [programas, linea, zona, busqueda],
  );

  const seleccionado = programas.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const row = rowRefs.current[selectedId];
    const scroller = row?.closest('.overflow-auto');
    if (!row || !scroller) return;
    const rowRect = row.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    if (rowRect.top < box.top) scroller.scrollTop -= box.top - rowRect.top;
    else if (rowRect.bottom > box.bottom) scroller.scrollTop += rowRect.bottom - box.bottom;
  }, [selectedId, visibles]);

  const chips: { id: FiltroZona; label: string }[] = [
    { id: 'todas', label: 'Todos' },
    { id: 'entregado', label: 'Entregados' },
    { id: 'sin_iniciar', label: 'En pausa' },
  ];
  const consultaEspecifica = linea !== 'todas' || zona !== 'todas' || busqueda.length > 0;

  return (
    <Card className={CARD}>
      <CardContent className="space-y-5 p-5">
        <SectionHeader tag="Resumen" title="Cada punto es un programa" />
        <p className="text-sm text-muted-foreground">
          Verde está entregado. Coral está en pausa. Esta parte es la vista general. El texto del Excel, con lo que falta en cada frente, aparece al elegir una línea, un estado o un nombre.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLinea('todas')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              linea === 'todas' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            Todas las líneas
          </button>
          {LINEAS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLinea(id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                linea === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {LINEA_CORTA[id]}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {LINEAS.filter((id) => linea === 'todas' || linea === id).map((id) => {
            const puntos = visibles
              .filter((p) => p.linea === id)
              .slice()
              .sort((a, b) => (estadoPrograma(a) === 'entregado' ? 0 : 1) - (estadoPrograma(b) === 'entregado' ? 0 : 1) || a.nombre.localeCompare(b.nombre, 'es'));
            if (puntos.length === 0) return null;
            const entregadosLinea = puntos.filter((p) => estadoPrograma(p) === 'entregado').length;
            const pausaLinea = puntos.length - entregadosLinea;
            const grupos: Programa[][] = [];
            for (let i = 0; i < puntos.length; i += 10) grupos.push(puntos.slice(i, i + 10));
            return (
              <div key={id} className="rounded-xl border border-border bg-muted/20 px-4 py-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold">{LINEA_CORTA[id]}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-[#067647]">{entregadosLinea} entregados</span>
                    <span className="mx-2">·</span>
                    <span className="font-semibold text-[#C2412D]">{pausaLinea} en pausa</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {grupos.map((grupo, indice) => (
                    <div key={indice} className="flex gap-2">
                      {grupo.map((programa) => {
                        const estilo = estadoDe(estadoPrograma(programa));
                        const activo = selectedId === programa.id;
                        return (
                          <button
                            key={programa.id}
                            type="button"
                            title={`${programa.nombre} · ${estilo.label}`}
                            aria-label={`${programa.nombre}, ${estilo.label}`}
                            onClick={() => setSelectedId(programa.id)}
                            className={cn('h-4 w-4 shrink-0 rounded-full transition-transform hover:scale-125', activo && 'outline outline-2 outline-offset-2')}
                            style={{ background: estilo.fill, outlineColor: estilo.fill }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <SectionHeader tag="Detalle" title="Lo que falta según el Excel" />
          <p className="text-sm text-muted-foreground">
            Filtra por línea, por entregados o en pausa, o busca un programa. Ahí se lee el texto original de cada frente y qué queda pendiente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setZona(chip.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium',
                zona === chip.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              {chip.label}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar programa"
              className="pl-8"
              aria-label="Buscar programa"
            />
          </div>
        </div>

        {seleccionado && (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{seleccionado.linea}{seleccionado.area ? ` · ${seleccionado.area}` : ''}</p>
                <p className="text-base font-semibold">{seleccionado.nombre}</p>
              </div>
              <Badge style={{ background: estadoDe(estadoPrograma(seleccionado)).soft, color: estadoDe(estadoPrograma(seleccionado)).ink }} className="border-0">
                {estadoDe(estadoPrograma(seleccionado)).label}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {FRENTES.map((frente) => {
                const celda = seleccionado.frentes[frente.id];
                const estilo = celda ? lecturaFrente(celda.presencia) : null;
                return (
                  <div key={frente.id} className="rounded-lg bg-card px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{frente.label}</p>
                    <p className="text-sm font-medium" style={{ color: estilo?.ink ?? '#6B7F7C' }}>
                      {celda ? celda.raw : 'No se registra en esta línea'}
                    </p>
                    {celda && celda.presencia !== 'dentro' && celda.presencia !== 'na' && (
                      <p className="text-xs text-[#C2412D]">Falta este frente</p>
                    )}
                  </div>
                );
              })}
            </div>
            {seleccionado.nota && <p className="mt-3 text-sm text-muted-foreground">{seleccionado.nota}</p>}
          </div>
        )}

        {consultaEspecifica ? (
          <div className="max-h-[560px] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Programa</th>
                  {FRENTES.map((frente) => (
                    <th key={frente.id} className="px-3 py-3 font-medium">{frente.label}</th>
                  ))}
                  <th className="px-4 py-3 font-medium">Qué falta</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((programa) => {
                  const activo = selectedId === programa.id;
                  return (
                    <tr
                      key={programa.id}
                      ref={(node) => {
                        rowRefs.current[programa.id] = node;
                      }}
                      onClick={() => setSelectedId(programa.id)}
                      className={cn('cursor-pointer border-b border-border/60 align-top hover:bg-muted/40', activo && 'bg-muted/50')}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium leading-snug">{programa.nombre}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{LINEA_CORTA[programa.linea]}{programa.area ? ` · ${programa.area}` : ''}</p>
                      </td>
                      {FRENTES.map((frente) => (
                        <td key={frente.id} className="px-3 py-3">
                          <TextoFrente celda={programa.frentes[frente.id]} />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                        {queFalta(programa)}
                      </td>
                    </tr>
                  );
                })}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Ningún programa coincide con ese filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Elige una línea, Entregados, En pausa o escribe un nombre para ver el detalle del Excel.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TextoFrente({ celda }: { celda?: FrenteCelda }) {
  if (!celda) {
    return <span className="text-xs text-muted-foreground">No se registra</span>;
  }
  const estilo = lecturaFrente(celda.presencia);
  const falta = celda.presencia !== 'dentro' && celda.presencia !== 'na';
  return (
    <span className="text-xs font-medium leading-snug" style={{ color: estilo.ink }}>
      {celda.raw}
      {falta ? <span className="mt-1 block font-normal text-[#C2412D]">Falta</span> : null}
    </span>
  );
}

function OpenDentalCard() {
  const { modulos, cursosHtml } = informe.openDental;
  const etapas = modulos[0]?.etapas.map((e) => e.etapa) ?? [];
  return (
    <Card className={CARD}>
      <CardContent className="p-5">
        <SectionHeader tag="Open Dental" title="Hasta dónde llegó cada módulo" />
        <p className="mb-4 text-sm text-muted-foreground">
          La producción camina de izquierda a derecha. M1 y M2 están completos. Desde M3, edición y PDF se quedan afuera.
        </p>
        <div className="overflow-x-auto">
          <table className="w-max min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Módulo</th>
                {etapas.map((etapa) => (
                  <th key={etapa} className="whitespace-nowrap px-2 pb-2 text-center font-medium">{etapa}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulos.map((modulo) => (
                <tr key={modulo.id} className="border-t border-border/60">
                  <td className="py-1.5 pr-3">
                    <span className="font-semibold">{modulo.id}</span>
                    <span className="ml-2 text-muted-foreground">{modulo.nombre}</span>
                  </td>
                  {modulo.etapas.map((etapa) => {
                    const estilo = PRESENCIA_STYLE[etapa.presencia];
                    return (
                      <td key={etapa.etapa} className="py-1.5 text-center">
                        <span
                          className="mx-auto block h-4 w-4 rounded-full"
                          style={{ background: estilo.fill }}
                          title={`${modulo.id} · ${etapa.etapa}: ${etapa.raw}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Cursos HTML de analistas</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cursosHtml.map((curso) => (
            <span key={curso.nombre} className="rounded-full bg-[#E7F6EE] px-2.5 py-1 text-xs font-medium text-[#067647]" title={curso.raw}>
              {curso.nombre}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EscuelaCard() {
  const { fases, etapas } = informe.escuela;
  return (
    <Card className={CARD}>
      <CardContent className="p-5">
        <SectionHeader tag="Escuela de influencers" title="El recorrido ya pasó el módulo 1" />
        <ol className="mt-1 space-y-0">
          {fases.map((fase, index) => {
            const estilo = PRESENCIA_STYLE[fase.presencia];
            const ultima = index === fases.length - 1;
            return (
              <li key={fase.nombre} className="grid grid-cols-[16px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-3.5 w-3.5 rounded-full" style={{ background: estilo.fill }} />
                  {!ultima && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={cn('pb-3', ultima && 'pb-0')}>
                  <p className="text-sm font-semibold leading-tight">{fase.nombre}</p>
                  <p className="text-xs" style={{ color: estilo.ink }}>{fase.raw}</p>
                  <p className="text-xs text-muted-foreground">{fase.entregables}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {etapas.map((etapa) => {
            const llenos = Math.round(etapa.avance * 10);
            return (
              <div key={etapa.nombre}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium">{etapa.nombre.replace(/^Etapa \d+: /, '')}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{Math.round(etapa.avance * 100)}%</p>
                </div>
                <div className="flex gap-1.5" aria-label={`${etapa.nombre}: ${Math.round(etapa.avance * 100)} por ciento`}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: i < llenos ? '#0DD9D0' : '#E7EEED' }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TendenciasCard() {
  const data = informe.tendencias;
  const total = data.fechasProgramadas;
  const entregados = data.entregados;
  const puntos = Array.from({ length: total }, (_, i) => i < entregados);
  const radio = 78;
  const centro = 100;

  return (
    <Card className={CARD}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <SectionHeader tag="Tendencias" title="12 de 14 fechas salieron" className="mb-2" />
          {data.pausado && <Badge className="border-0 bg-[#FFF1ED] text-[#C2412D]">Pausado</Badge>}
        </div>
        <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
          <svg viewBox="0 0 200 200" className="mx-auto h-44 w-44" role="img" aria-label="12 fechas con video y 2 sin entrega">
            {puntos.map((entregado, i) => {
              const angulo = -Math.PI / 2 + (i / total) * Math.PI * 2;
              const x = centro + Math.cos(angulo) * radio;
              const y = centro + Math.sin(angulo) * radio;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={7}
                  fill={entregado ? '#0CA35A' : '#fff'}
                  stroke={entregado ? '#0CA35A' : '#FF6B4A'}
                  strokeWidth="2"
                >
                  <title>{entregado ? 'Video entregado' : 'Fecha sin entrega'}</title>
                </circle>
              );
            })}
            <text x={centro} y={centro - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1F2A2A">{entregados}</text>
            <text x={centro} y={centro + 14} textAnchor="middle" fontSize="11" fill="#6B7F7C">de {total}</text>
          </svg>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{data.nota} Inicio {data.inicio}.</p>
            <div className="grid grid-cols-2 gap-2">
              {data.semana.map((dia) => (
                <div key={dia.dia} className="rounded-xl bg-muted/40 px-3 py-2">
                  <p className="text-xs font-semibold">{dia.dia}</p>
                  <p className="text-xs text-muted-foreground">{dia.actividad}</p>
                </div>
              ))}
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {data.indicadores.map((ind) => (
                <li key={ind.nombre}>
                  <span className="font-medium text-foreground">{ind.avance}</span> · {ind.nombre.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BienestarCard() {
  const data = informe.bienestar;
  return (
    <Card className={CARD}>
      <CardContent className="p-5">
        <SectionHeader tag="Bienestar" title="Infografías y pódcast cerrados; videos sin completar" />
        <div className="space-y-4">
          {data.materiales.map((material) => (
            <div key={material.tipo}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <p className="text-sm font-semibold">{material.tipo}</p>
                <p className="text-xs text-muted-foreground">{material.listos} listos · {material.pendientes} pendientes</p>
              </div>
              <div className="flex flex-wrap gap-1" aria-label={`${material.tipo}: ${material.listos} de ${material.total} listos`}>
                {Array.from({ length: material.total }, (_, i) => (
                  <span
                    key={i}
                    className="h-3 w-3 rounded-[3px]"
                    style={{ background: i < material.listos ? '#0CA35A' : '#FFD2C8', boxShadow: i < material.listos ? undefined : 'inset 0 0 0 1px #FF6B4A' }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{data.nota}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.apps.map((app) => (
            <span key={app.nombre} className="rounded-full bg-[#E7F6EE] px-2.5 py-1 text-xs font-medium text-[#067647]" title={`${app.videos} videos · ${app.infografias} infografías · ${app.podcast} pódcast`}>
              {app.nombre}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RemasterCard() {
  const data = informe.remasterizacion;
  const hitos = [...data.hitos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const grupos = hitos.reduce<{ fecha: string; items: typeof hitos }[]>((acc, hito) => {
    const ultimo = acc[acc.length - 1];
    if (ultimo && ultimo.fecha === hito.fecha) ultimo.items.push(hito);
    else acc.push({ fecha: hito.fecha, items: [hito] });
    return acc;
  }, []);

  return (
    <Card className={CARD}>
      <CardContent className="p-5">
        <SectionHeader tag="Remasterización" title="Los 11 videos ya están dentro y cerrados" />
        <p className="mb-4 text-sm text-muted-foreground">
          {data.resumen.editados} editados, {data.resumen.pendientesGrabacion} pendientes de grabación. El paquete se entregó el 30 de septiembre.
        </p>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <ol className="space-y-0">
            {grupos.map((grupo, index) => {
              const fecha = new Date(`${grupo.fecha}T12:00:00`);
              const etiqueta = fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
              const ultimo = index === grupos.length - 1;
              return (
                <li key={grupo.fecha} className="grid grid-cols-[72px_16px_1fr] gap-3">
                  <p className="pt-0.5 text-right text-xs font-semibold text-muted-foreground">{etiqueta}</p>
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-3 w-3 rounded-full bg-[#0CA35A]" />
                    {!ultimo && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className={cn('space-y-1', ultimo ? 'pb-0' : 'pb-4')}>
                    {grupo.items.map((item) => (
                      <p key={`${item.actividad}-${item.alcance}`} className="text-sm">
                        <span className="font-medium">{item.actividad}.</span>{' '}
                        <span className="text-muted-foreground">{item.alcance}</span>
                      </p>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Programas remasterizados</p>
            <ul className="space-y-1.5">
              {data.programas.map((programa) => (
                <li key={programa.nombre} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0CA35A]" />
                  <span>{programa.nombre}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
