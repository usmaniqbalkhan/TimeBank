import { Link } from 'react-router-dom';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import './LandingPage.css';

export default function LandingPage() {
  const { configured } = useAuth();

  return (
    <div className="landing-mobile">
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>
      
      <main className="landing-content">
        <div className="brand-header">
           <div className="logo-icon">R</div>
           <span>Raqam</span>
        </div>

        <h1 className="landing-title">Your money,<br/>at student speed.</h1>
        <p className="landing-subtitle">The frictionless digital wallet designed exclusively for campus life.</p>
        
        <div className="features-stack">
           <div className="feature-card">
              <div className="feature-icon bg-red">⚡</div>
              <h3>Instant QR Payments</h3>
              <p>Scan and pay at campus cafes instantly without typing account details.</p>
           </div>
           
           <div className="features-row">
              <div className="feature-card small-card">
                 <div className="feature-icon bg-red">#</div>
                 <h3>Raqam Codes</h3>
                 <p>Send via 4-digits.</p>
              </div>
              <div className="feature-card small-card">
                 <div className="feature-icon bg-green">💰</div>
                 <h3>Zero Fees</h3>
                 <p>100% free always.</p>
              </div>
           </div>
        </div>
      </main>
      
      <div className="sticky-auth-footer">
         {!configured ? (
           <p className="setup-note">Add your Supabase keys in `.env` before signing in.</p>
         ) : null}

         <Link to="/signup" className="full-width-link">
            <Button variant="primary">Create Student Wallet</Button>
         </Link>

         <Link to="/login" className="full-width-link mt-8">
            <Button variant="tertiary">Log in</Button>
         </Link>
      </div>
    </div>
  );
}
