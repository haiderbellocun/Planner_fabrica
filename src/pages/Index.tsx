import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Clock, Users, ArrowRight } from 'lucide-react';
import logo from '@/assets/LOGOS-07.png';

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden pb-48 md:pb-64">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 w-full">
        <div className="w-full mx-auto max-w-7xl px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Fábrica de Contenido" className="h-9 md:h-11 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard">
                <Button className="shadow-md shadow-primary/20">
                  Ir al Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button className="shadow-md shadow-primary/20">Iniciar Sesión</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-4 w-full">
        <div className="w-full mx-auto max-w-7xl px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Nueva versión 2.0 disponible
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Gestión de proyectos{' '}
            <span className="text-primary">ejecutiva y profesional</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 w-full mx-auto max-w-2xl">
            Organiza tus proyectos, rastrea tareas con tableros Kanban,
            y registra automáticamente el tiempo por estado. Todo en una plataforma elegante y potente.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 w-full bg-gradient-to-b from-background to-card">
        <div className="w-full mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Características <span className="text-primary">ejecutivas</span>
            </h2>
            <p className="text-muted-foreground text-lg w-full mx-auto max-w-2xl">
              Todo lo que necesitas para gestionar proyectos de forma profesional
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 w-full mx-auto max-w-6xl">
            <div className="group bg-card p-8 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-primary/30 hover:shadow-xl transition-all">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <LayoutGrid className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Tablero Kanban</h3>
              <p className="text-muted-foreground leading-relaxed">
                Visualiza y mueve tareas entre estados con drag & drop.
                Gestión visual intuitiva para máxima productividad.
              </p>
            </div>
            <div className="group bg-card p-8 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-primary/30 hover:shadow-xl transition-all">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Tiempo Automático</h3>
              <p className="text-muted-foreground leading-relaxed">
                Registro automático de tiempo por cada cambio de estado.
                Métricas precisas sin esfuerzo manual.
              </p>
            </div>
            <div className="group bg-card p-8 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-primary/30 hover:shadow-xl transition-all">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Colaboración en Equipo</h3>
              <p className="text-muted-foreground leading-relaxed">
                Invita a tu equipo y gestiona permisos por proyecto.
                Trabajo colaborativo sin fricciones.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
