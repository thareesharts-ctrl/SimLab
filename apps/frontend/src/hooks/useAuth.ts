import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { normalizeRole } from '../lib/normalizeRole';

export function useAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, fetchMe } = useAuthStore();

  useEffect(() => {
    const verifySession = async () => {
      const currentUser = await fetchMe();
      if (!currentUser) {
        // Redirect to login if unauthenticated
        if (window.location.pathname !== '/login' && window.location.pathname !== '/landing') {
          navigate('/login', { replace: true });
        }
        return;
      }

      // Role-based redirection using normalizeRole to handle any casing variant
      const normalized = normalizeRole(currentUser.role);
      if (normalized === 'SUPER_ADMIN') {
        navigate('/admin', { replace: true });
      } else if (normalized === 'INSTRUCTOR') {
        navigate('/instructor', { replace: true });
      }
      // INDIVIDUAL and STUDENT both stay at /dashboard
    };

    verifySession();
  }, [fetchMe, navigate]);

  return { user, isAuthenticated };
}

export default useAuth;
