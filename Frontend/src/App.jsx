import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuctionProvider } from './context/AuctionContext';
import MagicBackground from './components/MagicBackground';
import Dashboard from './pages/Dashboard';
import HostPanel from './pages/HostPanel';
import CaptainPortal from './pages/CaptainPortal';
import api from './services/api';

function AppShell() {
  const [captainSession, setCaptainSession] = useState(() => api.getCaptainSession());

  useEffect(() => {
    function syncAuth() {
      setCaptainSession(api.getCaptainSession());
    }
    window.addEventListener('coderscup-auth-change', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('coderscup-auth-change', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  const isCaptainLocked = Boolean(captainSession.token && captainSession.houseId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-header-emblem">⚡</span>
          <div className="app-header-text">
            <span className="app-header-eyebrow">HOGWARTS HOUSE</span>
            <span className="app-header-title">THE GRAND AUCTION</span>
          </div>
        </div>

        <div className="app-header-runes" aria-hidden="true">
          <span className="app-rune">•</span>
          <span className="app-rune">•</span>
          <span className="app-rune">•</span>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={<Navigate to={isCaptainLocked ? '/captain' : '/dashboard'} replace />}
        />
        <Route
          path="/dashboard"
          element={isCaptainLocked ? <Navigate to="/captain" replace /> : <Dashboard />}
        />
        <Route path="/captain" element={<CaptainPortal />} />
        <Route
          path="/admin"
          element={isCaptainLocked ? <Navigate to="/captain" replace /> : <HostPanel />}
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MagicBackground />
      <AuctionProvider>
        <AppShell />
      </AuctionProvider>
    </BrowserRouter>
  );
}
