import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiBaseUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { z } from 'zod';
import logo from '@/assets/LOGOS-07.png';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const googleError = searchParams.get('google_error');
  const { signIn, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiOrigin =
    (apiBaseUrl || '').replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:3001' : '');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Redirect if already logged in
  if (user) {
    navigate('/dashboard');
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Credenciales inválidas. Verifica tu email y contraseña.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor confirma tu email antes de iniciar sesión.');
      } else {
        setError(error.message);
      }
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div
      className="min-h-screen w-full relative flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: 'url(./bg_login.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md">
      <div className="mb-8 text-center">
        <img src={logo} alt="Fábrica de Contenido" className="h-[52px] md:h-16 w-auto object-contain mx-auto drop-shadow-lg" />
        <p className="text-white/80 mt-2 text-sm font-medium drop-shadow">Planner Fabrica - Gestión de contenido</p>
      </div>

      <Card className="w-full max-w-md backdrop-blur-sm bg-white/95 shadow-2xl border-white/20">
        <form onSubmit={handleLogin}>
          <CardHeader>
            <CardTitle>Bienvenido de vuelta</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para acceder a tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(error || googleError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error ||
                    (googleError === 'not_found'
                      ? 'Tu cuenta de Google no está registrada. Contacta al administrador.'
                      : googleError === 'disabled'
                        ? 'Tu cuenta está deshabilitada.'
                        : 'Error al iniciar sesión con Google.')}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="tu@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesión
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">o</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!apiOrigin}
              onClick={() => {
                window.location.href = `${apiOrigin}/api/auth/google`;
              }}
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                className="mr-2 h-4 w-4"
              />
              Continuar con Google
            </Button>
          </CardFooter>
        </form>
      </Card>

      <p className="mt-4 text-sm text-white/70">
        <Link to="/" className="hover:text-white underline">
          Volver al inicio
        </Link>
      </p>
      </div>
    </div>
  );
}
