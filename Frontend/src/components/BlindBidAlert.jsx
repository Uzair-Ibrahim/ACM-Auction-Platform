import React from 'react';

/**
 * Full-screen flash overlay shown when the Blind Bid Threshold is crossed
 * (10,000 pts on any 23k team, or 15,000 pts on First-Team of 26k/25k/24k).
 */
export default function BlindBidAlert({ alert, onClose }) {
  if (!alert) return null;
  const threshold = Number(alert.threshold || 15000);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'flashIn 0.25s ease',
        cursor: 'pointer',
      }}
    >
      <style>{`
        @keyframes flashIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes bbPulse {
          0%, 100% { box-shadow: 0 0 80px rgba(231,76,60,0.6), 0 0 160px rgba(231,76,60,0.25); }
          50%      { box-shadow: 0 0 40px rgba(244,214,109,0.5), 0 0 100px rgba(231,76,60,0.2); }
        }
      `}</style>
      <div
        style={{
          border: '3px solid #e74c3c',
          borderRadius: 18,
          padding: '44px 60px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, #160404 0%, #090202 100%)',
          animation: 'bbPulse 1.3s infinite',
          maxWidth: 680,
          margin: '0 20px',
        }}
      >
        <div style={{ fontSize: 54, marginBottom: 14 }}>🔇</div>
        <div
          style={{
            fontSize: 12,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#f4d66d',
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          {alert.ruleLabel || 'SILENT SNIP TRIGGERED'}
        </div>
        <h1
          style={{
            fontFamily: 'Cinzel, serif',
            fontSize: 'clamp(26px, 4.2vw, 48px)',
            color: '#ff5e4d',
            letterSpacing: 3,
            margin: 0,
            textShadow: '0 0 24px rgba(231,76,60,0.8)',
          }}
        >
          BLIND BID PROTOCOL
        </h1>
        <h2
          style={{
            fontFamily: 'Cinzel, serif',
            fontSize: 'clamp(22px, 3.4vw, 38px)',
            color: '#f4d66d',
            letterSpacing: 4,
            margin: '6px 0 0',
            textShadow: '0 0 20px rgba(244,214,109,0.7)',
          }}
        >
          INITIATED
        </h2>
        <p
          style={{
            color: '#e5e0d5',
            marginTop: 22,
            fontSize: 17,
            lineHeight: 1.6,
          }}
        >
          Open bidding on <strong>{alert.teamName}</strong> is now halted.
          <br />
          Interested Houses must submit one final, secret sealed bid
          <br />
          <strong style={{ color: '#f4d66d' }}>
            strictly above {threshold.toLocaleString()} points
          </strong>{' '}
          (min {(threshold + 1000).toLocaleString()} pts).
        </p>
        <div style={{ marginTop: 18, fontSize: 12, color: '#9a9185', letterSpacing: '0.15em' }}>
          CLICK ANYWHERE TO CONTINUE
        </div>
      </div>
    </div>
  );
}
