import { useNavigate } from 'react-router-dom';
import './ScanQRFlow.css';

export default function ScanQRFlow() {
  const navigate = useNavigate();

  return (
    <div className="scan-page">
      <header className="scan-header">
        <button className="scan-back-btn" onClick={() => navigate('/wallet')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h2>Scan to Pay</h2>
        <div style={{width: 40}}></div>
      </header>

      <div className="scan-camera-container">
         <div className="scan-target-box">
            <div className="scan-corner scan-tl"></div>
            <div className="scan-corner scan-tr"></div>
            <div className="scan-corner scan-bl"></div>
            <div className="scan-corner scan-br"></div>
            <div className="scan-laser-line"></div>
         </div>
      </div>

      <p className="scan-overlay-text">Align QR code within the frame</p>

      <div className="scan-bottom-nav">
         <div className="scan-toggle">
            <button className="scan-toggle-btn active">Scan</button>
            <button className="scan-toggle-btn" onClick={() => navigate('/receive')}>My Code</button>
         </div>
      </div>
    </div>
  );
}
