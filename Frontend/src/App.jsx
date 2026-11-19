import React from 'react';
import { BrowserRouter, Navigate, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AuctionProvider } from './context/AuctionContext';
import MagicBackground from './components/MagicBackground';
import Dashboard from './pages/Dashboard';
import HostPanel from './pages/HostPanel';
import CaptainPortal from './pages/CaptainPortal';

function AppShell() {
  const location = useLocation();
  const path = location.pathname;

  const isAdminPage = path.startsWith('/admin');
  const isCaptainPage = path.startsWith('/captain');

  const capsuleStyle = ({ isActive }) => ({
    textDecoration: 'none',
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '0.38rem 0.85rem',
    borderRadius: 999,
    border: isActive
      ? '1px solid rgba(244,214,109,0.55)'
      : '1px solid rgba(255,255,255,0.14)',
    background: isActive ? 'rgba(244,214,109,0.14)' : 'rgba(255,255,255,0.04)',
    color: isActive ? 'var(--gold)' : 'var(--text)',
    transition: 'all 0.2s',
  });

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

        {isAdminPage ? (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <NavLink to="/dashboard" style={capsuleStyle}>
              Projector
            </NavLink>
            <NavLink to="/captain" style={capsuleStyle}>
              Houses
            </NavLink>
          </nav>
        ) : isCaptainPage ? (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <NavLink to="/dashboard" style={capsuleStyle}>
              Projector
            </NavLink>
          </nav>
        ) : (
          <div className="app-header-runes" aria-hidden="true">
            <span className="app-rune">•</span>
            <span className="app-rune">•</span>
            <span className="app-rune">•</span>
          </div>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/captain" element={<CaptainPortal />} />
        <Route path="/admin" element={<HostPanel />} />
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
