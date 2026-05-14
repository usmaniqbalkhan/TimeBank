import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TBLogo, I } from '../lib/icons';
import { getInitials } from '../lib/formatters';

export default function DesktopNav() {
  const { session, profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const NavLink = ({ to, label }) => (
    <Link to={to} className={'tb-dnav__link' + (path === to ? ' on' : '')}>
      {label}
    </Link>
  );

  return (
    <header className="tb-dnav">
      <Link to={session ? '/wallet' : '/'} className="tb-dnav__brand">
        <TBLogo size={32} />
        <span>Timebank</span>
      </Link>

      {session ? (
        <nav className="tb-dnav__links">
          <NavLink to="/wallet" label="Wallet" />
          <NavLink to="/send" label="Send" />
          <NavLink to="/receive" label="Receive" />
          <NavLink to="/scan" label="Scan" />
          <button
            type="button"
            className="tb-dnav__link"
            onClick={() => logout().then(() => navigate('/'))}
            title="Sign out"
          >
            Sign out
          </button>
          <div className="tb-dnav__avatar" title={profile?.name}>
            {getInitials(profile?.name) || 'TB'}
          </div>
        </nav>
      ) : (
        <nav className="tb-dnav__links">
          <Link to="/login" className="tb-dnav__link">Sign in</Link>
          <Link to="/signup">
            <button
              type="button"
              className="tb-btn tb-btn--violet"
              style={{ width: 'auto', height: 42, padding: '0 18px', fontSize: 14 }}
            >
              Get started {I.arrowRight({ width: 14, height: 14 })}
            </button>
          </Link>
        </nav>
      )}
    </header>
  );
}
