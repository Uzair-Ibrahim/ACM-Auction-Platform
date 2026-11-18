import React from 'react';

export default function Modal({ isOpen, title, message, type = 'error', onClose }) {
  if (!isOpen) return null;

  const colors = {
    error:   { border: '#e74c3c', bg: '#1a0a0a', icon: '⚠' },
    success: { border: '#2ecc71', bg: '#0a1a0a', icon: '✓' },
    info:    { border: '#3498db', bg: '#0a0f1a', icon: 'ℹ' },
  };
  const c = colors[type] || colors.error;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        borderRadius: 12,
        padding: '32px 40px',
        maxWidth: 480,
        width: '90%',
        textAlign: 'center',
        boxShadow: `0 0 40px ${c.border}44`,
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{c.icon}</div>
        {title && (
          <h2 style={{ color: c.border, fontFamily: 'Orbitron, sans-serif', marginBottom: 12 }}>
            {title}
          </h2>
        )}
        <p style={{ color: '#ccc', fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
          {message}
        </p>
        <button
          onClick={onClose}
          style={{
            background: c.border,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 32px',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'Orbitron, sans-serif',
          }}
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}
