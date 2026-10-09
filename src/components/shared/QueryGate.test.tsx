import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { QueryGate } from './QueryGate';
import { ApiRequestError, describeError, shouldRetryQuery } from '@/lib/apiError';
import { ErrorState } from './StoryUI';

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const wrap = (qc: QueryClient, el: JSX.Element) => render(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);

function Probe({ fn, id = 'k', empty = false }: { fn: () => Promise<string[]>; id?: string; empty?: boolean }) {
  const q = useQuery({ queryKey: ['probe', id], queryFn: fn });
  return (
    <QueryGate
      query={q}
      loading={<div role="status">cargando…</div>}
      errorMessage="No se pudieron cargar los datos."
      isEmpty={empty ? (d) => d.length === 0 : undefined}
      empty={<p>Sin registros</p>}
    >
      {(d) => <ul>{d.map((x) => <li key={x}>{x}</li>)}</ul>}
    </QueryGate>
  );
}

describe('apiError', () => {
  it('describeError conserva el motivo y distingue permisos, sesión, red y servidor', () => {
    expect(describeError(new ApiRequestError('Solo administradores', 403))).toEqual({ title: 'Sin permiso', message: 'Solo administradores' });
    expect(describeError(new ApiRequestError('Invalid token', 401)).title).toBe('Sesión no válida');
    expect(describeError(new ApiRequestError('boom', 500), 'No se pudo cargar.').message).toContain('servidor');
    expect(describeError(new TypeError('Failed to fetch'), 'No se pudo cargar.').message).toContain('conexión');
    expect(describeError(new ApiRequestError('', 403)).message).toMatch(/permiso/);
  });
  it('política de reintentos: 3 intentos salvo errores 4xx, que fallan de inmediato', () => {
    expect(shouldRetryQuery(0, new ApiRequestError('x', 500))).toBe(true);
    expect(shouldRetryQuery(2, new TypeError('red'))).toBe(true);
    expect(shouldRetryQuery(3, new ApiRequestError('x', 500))).toBe(false);
    for (const s of [400, 401, 403, 404]) expect(shouldRetryQuery(0, new ApiRequestError('x', s))).toBe(false);
  });
});

describe('QueryGate: los seis estados', () => {
  it('1-2. carga inicial y luego datos', async () => {
    wrap(client(), <Probe fn={async () => ['Ana']} />);
    expect(screen.getByRole('status')).toHaveTextContent('cargando');
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('3 y reintento exitoso: error sin datos → alerta con motivo; Reintentar recupera', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new ApiRequestError('Servidor caído', 500)).mockResolvedValueOnce(['Luis']);
    wrap(client(), <Probe fn={fn} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar los datos.');
    expect(alert).toHaveTextContent('Servidor caído');
    expect(screen.queryByText('Sin registros')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Luis')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('errores de permisos: 403 explica el permiso y NO ofrece Reintentar; 401 explica la sesión', async () => {
    const a = wrap(client(), <Probe fn={() => Promise.reject(new ApiRequestError('Solo administradores pueden ver esto', 403))} id="a" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sin permiso');
    expect(alert).toHaveTextContent('Solo administradores pueden ver esto');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    a.unmount();
    wrap(client(), <Probe fn={() => Promise.reject(new ApiRequestError('Invalid token', 401))} id="b" />);
    expect(await screen.findByText('Sesión no válida')).toBeInTheDocument();
  });

  it('4. error con información anterior en caché: se conservan los datos y se avisa sin ocultarlos', async () => {
    const qc = client();
    qc.setQueryData(['probe', 'k'], ['Dato previo']);
    const fn = vi.fn().mockRejectedValue(new ApiRequestError('Sin conexión con el servidor', 503));
    function Stale() {
      const q = useQuery({ queryKey: ['probe', 'k'], queryFn: fn, staleTime: 0 });
      return <QueryGate query={q} loading={<div>cargando</div>} errorMessage="x">{(d) => <p>{d[0]}</p>}</QueryGate>;
    }
    wrap(qc, <Stale />);
    expect(await screen.findByText(/Se muestran los datos anteriores/)).toBeInTheDocument();
    expect(screen.getByText('Dato previo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // aviso no bloqueante (status)
  });

  it('5. lista realmente vacía → mensaje de vacío (distinto de error y de carga)', async () => {
    wrap(client(), <Probe fn={async () => []} empty />);
    expect(await screen.findByText('Sin registros')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('datos anteriores mientras cambia el filtro: se atenúan y marcan aria-busy, y luego se reemplazan', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    function Filtered() {
      const [f, setF] = useState('a');
      const q = useQuery({
        queryKey: ['f', f],
        queryFn: async () => { if (f === 'b') await gate; return [`resultado ${f}`]; },
        placeholderData: keepPreviousData,
      });
      return (
        <>
          <button onClick={() => setF('b')}>cambiar</button>
          <QueryGate query={q} loading={<div>cargando</div>} errorMessage="x">{(d) => <p>{d[0]}</p>}</QueryGate>
        </>
      );
    }
    const { container } = wrap(client(), <Filtered />);
    expect(await screen.findByText('resultado a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('cambiar'));
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(screen.getByText('resultado a')).toBeInTheDocument(); // sin parpadeo a esqueleto
    expect(container.querySelector('.opacity-60')).not.toBeNull();
    await act(async () => { release(); });
    expect(await screen.findByText('resultado b')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('consultas concurrentes: una falla y la otra carga; cada bloque muestra su propio estado', async () => {
    const qc = client();
    wrap(qc, <><Probe fn={async () => ['A ok']} id="uno" /><Probe fn={() => Promise.reject(new ApiRequestError('fallo B', 500))} id="dos" /></>);
    expect(await screen.findByText('A ok')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('fallo B');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

describe('ErrorState', () => {
  it('sin error original usa solo el mensaje; con 404 no añade título', () => {
    const { rerender } = render(<ErrorState message="No se pudo." />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo.');
    rerender(<ErrorState message="No se pudo." error={new ApiRequestError('No encontrado', 404)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No encontrado');
  });
});
