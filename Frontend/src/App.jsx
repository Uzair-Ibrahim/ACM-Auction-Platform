import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, NavLink } from 'react-router-dom';
import { AuctionProvider } from './context/AuctionContext';
import MagicBackground from './components/MagicBackground';
import Dashboard from './pages/Dashboard';
import HostPanel from './pages/HostPanel';
import CaptainPortal from './pages/CaptainPortal';
import api from './services/api';

function AppShell() {
  const [captainSession, setCaptainSession] = useState(() => api.getCaptainSession());
  const [adminSession, setAdminSession] = useState(() => api.getAdminSession());

  useEffect(() => {
    function syncAuth() {
      setCaptainSession(api.getCaptainSession());
      setAdminSession(api.getAdminSession());
    }
    window.addEventListener('coderscup-auth-change', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('coderscup-auth-change', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  const isCaptainLocked = Boolean(captainSession.token && captainSession.houseId);

  const linkStyle = ({ isActive }) => ({
    textDecoration: 'none',
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '0.38rem 0.75rem',
    borderRadius: 999,
    border: isActive
      ? '1px solid rgba(244,214,109,0.55)'
      : '1px solid rgba(255,255,255,0.1)',
    background: isActive ? 'rgba(244,214,109,0.13)' : 'rgba(255,255,255,0.03)',
    color: isActive ? 'var(--gold)' : 'var(--muted)',
    transition: 'all 0.2s',
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-header-emblem">⚡</span>
          <div className="app-header-text">
            <span className="app-header-eyebrow">FAST NUCES Karachi · Coders Cup</span>
            <span className="app-header-title">The Grand House Auction</span>
          </div>
        </div>

        {/* If a House Captain is logged in, ONLY show their Captain Account indicator (no Admin/Projector switch) */}
        {isCaptainLocked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.32rem 0.75rem',
                borderRadius: 999,
                border: '1px solid rgba(244,214,109,0.45)',
                background: 'rgba(244,214,109,0.1)',
                color: 'var(--gold)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              House Account: {captainSession.houseId}
            </span>
          </div>
        ) : (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <NavLink to="/dashboard" style={linkStyle}>
              Projector Board
            </NavLink>
            <NavLink to="/captain" style={linkStyle}>
              House Login
            </NavLink>
            <NavLink to="/admin" style={linkStyle}>
              {adminSession.key ? 'Host Console (Admin)' : 'Admin Login'}
            </NavLink>
          </nav>
        )}
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
