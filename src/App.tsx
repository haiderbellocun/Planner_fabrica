import { shouldRetryQuery } from "@/lib/apiError";
import { QueryCacheGuard } from "@/components/QueryCacheGuard";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, type ReactNode } from "react";
import { PageSkeleton } from "@/components/shared/Skeletons";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GoogleAuthSuccess from "./pages/GoogleAuthSuccess";
import NotFound from "./pages/NotFound";

// Páginas con carga diferida: cada ruta se descarga al visitarla (el código de gráficos, Excel, Kanban, etc.
// ya no viaja en la carga inicial). Index, Auth y NotFound se mantienen en el paquete inicial.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const MyTasks = lazy(() => import("./pages/MyTasks"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Reports = lazy(() => import("./pages/Reports"));
const ProjectCalculator = lazy(() => import("./pages/ProjectCalculator"));
const Settings = lazy(() => import("./pages/Settings"));
const Flows = lazy(() => import("./pages/Flows"));
const ProximosProgramas = lazy(() => import("./pages/ProximosProgramas"));
const Entregas = lazy(() => import("./pages/Entregas"));
const SolicitudesMarketing = lazy(() => import("./pages/SolicitudesMarketing"));
const Equipos = lazy(() => import("./pages/Equipos"));
const EquipoPlan = lazy(() => import("./pages/EquipoPlan"));
const Calendar = lazy(() => import("./pages/Calendar"));

// Reintentos: los predeterminados (3) salvo errores 4xx, que fallan de inmediato (ver lib/apiError.ts).
// Marco de las páginas autenticadas: el sidebar y el encabezado se muestran de inmediato y el
// contenido de la ruta entra con un esqueleto mientras se descarga su código.
const Shell = ({ children }: { children: ReactNode }) => (
  <AppLayout>
    <Suspense fallback={<div className="page-container"><PageSkeleton /></div>}>{children}</Suspense>
  </AppLayout>
);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery } } });

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <QueryCacheGuard />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HashRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/google/success" element={<GoogleAuthSuccess />} />
            <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
            <Route path="/profile" element={<Shell><Profile /></Shell>} />
            <Route path="/projects" element={<Shell><Projects /></Shell>} />
            <Route path="/projects/:projectId" element={<Shell><ProjectDetail /></Shell>} />
            <Route path="/my-tasks" element={<Shell><MyTasks /></Shell>} />
            <Route path="/notifications" element={<Shell><Notifications /></Shell>} />
            <Route path="/reports" element={<Shell><Reports /></Shell>} />
            <Route path="/calculator" element={<Shell><ProjectCalculator /></Shell>} />
            <Route path="/flows" element={<Shell><Flows /></Shell>} />
            <Route path="/proximos-programas" element={<Shell><ProximosProgramas /></Shell>} />
            <Route path="/entregas" element={<Shell><Entregas /></Shell>} />
            <Route path="/solicitudes-marketing" element={<Shell><SolicitudesMarketing /></Shell>} />
            <Route path="/equipos" element={<Shell><Equipos /></Shell>} />
            <Route path="/equipos/:equipoId/plan" element={<Shell><EquipoPlan /></Shell>} />
            <Route path="/calendar" element={<Shell><Calendar /></Shell>} />
            <Route path="/settings" element={<Shell><Settings /></Shell>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
