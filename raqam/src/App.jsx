import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import DesktopNav from './components/DesktopNav';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import WalletDashboard from './pages/WalletDashboard';
import PaymentsDashboard from './pages/PaymentsDashboard';
import SendMoneyFlow from './pages/SendMoneyFlow';
import ReceiveMoney from './pages/ReceiveMoney';
import ScanQR from './pages/ScanQR';

function App() {
  return (
    <BrowserRouter>
      <DesktopNav />
      <Routes>
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><AuthPage type="login" /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><AuthPage type="signup" /></PublicRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletDashboard /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><PaymentsDashboard /></ProtectedRoute>} />
        <Route path="/send" element={<ProtectedRoute><SendMoneyFlow /></ProtectedRoute>} />
        <Route path="/receive" element={<ProtectedRoute><ReceiveMoney /></ProtectedRoute>} />
        <Route path="/scan" element={<ProtectedRoute><ScanQR /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
