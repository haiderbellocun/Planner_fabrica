import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function GoogleAuthSuccess() {
  const [searchParams] = useSearchParams();
  const { signInWithToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      signInWithToken(token);
    } else {
      window.location.assign(`${window.location.origin}/#/auth`);
    }
  }, [searchParams, signInWithToken]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
