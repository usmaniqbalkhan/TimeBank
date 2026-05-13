import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import './AuthPage.css';

export default function AuthPage({ type }) {
  const { authLoading, configured, login, signup } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      if (type === 'signup') {
        await signup({
          name: form.name,
          email: form.email,
          password: form.password,
        });
      } else {
        await login(form.email, form.password);
      }

      navigate('/wallet');
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  return (
    <div className="auth-mobile-wrapper page-container">
      <header className="auth-topbar">
        <Link to="/" className="auth-back">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </Link>
      </header>

      <div className="auth-mobile-content">
        <div className="auth-header">
          <div className="logo-mark">R</div>
          <h2>{type === 'login' ? 'Welcome back' : 'Create your wallet'}</h2>
          <p>
            {type === 'login'
              ? 'Use your email and password to access your Raqam wallet.'
              : 'Sign up with your name and email. Your unique 4-digit wallet code is generated automatically.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!configured ? (
            <div className="auth-alert auth-alert-error">
              Supabase keys are missing. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
            </div>
          ) : null}

          {error ? <div className="auth-alert auth-alert-error">{error}</div> : null}

          {type === 'signup' ? (
            <div className="input-group">
              <label>Full Name</label>
              <input type="text" name="name" placeholder="John Doe" value={form.name} onChange={handleChange} required />
            </div>
          ) : null}

          <div className="input-group">
            <label>Email Address</label>
            <input type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input type="password" name="password" placeholder="Minimum 6 characters" value={form.password} onChange={handleChange} minLength="6" required />
          </div>

          <div className="auth-submit-area">
            <Button variant="primary" type="submit" disabled={authLoading || !configured}>
              {authLoading ? 'Authenticating...' : (type === 'login' ? 'Log in' : 'Create Account')}
            </Button>
          </div>

          <p className="auth-switch-copy">
            {type === 'login' ? "Don't have a wallet yet?" : 'Already have an account?'}{' '}
            <Link to={type === 'login' ? '/signup' : '/login'}>
              {type === 'login' ? 'Create one' : 'Log in'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
