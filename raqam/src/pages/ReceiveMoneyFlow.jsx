import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import './ReceiveMoneyFlow.css';

export default function ReceiveMoneyFlow() {
  const navigate = useNavigate();
  const studentCode = "4920";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=timebank://pay?code=${studentCode}&margin=0`;

  return (
    <div className="recv-flow">
      <header className="flow-header">
        <button className="back-btn" onClick={() => navigate('/wallet')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h2>Receive Money</h2>
        <div style={{width: 24}}></div>
      </header>

      <div className="recv-top-nav">
         <div className="recv-toggle">
            <button className="recv-toggle-btn" onClick={() => navigate('/scan')}>Scan</button>
            <button className="recv-toggle-btn active">My Code</button>
         </div>
      </div>

      <div className="recv-content">
         <div className="recv-card-wrapper">
            <div className="recv-glow"></div>
            <div className="recv-qr-card">
               <img src={qrUrl} alt="QR Code" className="recv-qr-image" />
               <div className="recv-user-avatar">F</div>
               <h3 className="recv-student-name">Farhan Saleem</h3>
               <p className="recv-student-code">Code: {studentCode}</p>
            </div>
         </div>
      </div>

      <div className="recv-bottom-action">
         <Button variant="primary" onClick={() => navigator.clipboard.writeText(studentCode)}>
            Copy Timebank Code
         </Button>
      </div>
    </div>
  );
}
