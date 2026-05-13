import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function PublicRoute({ children }) {
  const { authReady, session } = useAuth();

  if (!authReady) {
    return (
      <div className="route-gate">
        <div className="route-gate-card">
          <p className="route-gate-label">Loading...</p>
        </div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/wallet" replace />;
  }

  return children;
}
