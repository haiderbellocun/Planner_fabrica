import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Users } from 'lucide-react';
import { PageHeader } from './PageHeader';

const r = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

describe('PageHeader', () => {
  it('un solo h1 con título, subtítulo y acciones', () => {
    r(<PageHeader title="Proyectos" description="Gestiona todos tus proyectos" actions={<button>Nuevo</button>} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Proyectos');
    expect(screen.getByText('Gestiona todos tus proyectos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument();
  });
  it('sin acciones (false/undefined) no deja contenedor vacío', () => {
    const { container } = r(<PageHeader title="Reportes" actions={false} />);
    expect(container.firstElementChild!.children).toHaveLength(1);
  });
  it('el icono es decorativo (aria-hidden) y no cuenta como nombre', () => {
    r(<PageHeader icon={Users} title="Equipos" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Equipos');
  });
  it('migas: enlaces para los niveles previos y la página actual sin enlace', () => {
    r(<PageHeader title="Plan" breadcrumbs={[{ label: 'Equipos', to: '/equipos' }, { label: 'Diseño' }]} />);
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(nav).getByRole('link', { name: 'Equipos' })).toHaveAttribute('href', '/equipos');
    expect(within(nav).getByText('Diseño')).toHaveAttribute('aria-current', 'page');
  });
  it('un título muy largo no rompe el contenedor (se parte en líneas)', () => {
    const long = 'Programa de Maestría en Gestión de la Innovación y la Transformación Digital de Organizaciones Educativas';
    r(<PageHeader title={long} />);
    expect(screen.getByRole('heading', { level: 1 }).querySelector('span')!.className).toContain('break-words');
  });
});
