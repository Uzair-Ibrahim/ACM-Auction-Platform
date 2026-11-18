import { useEffect, useState } from 'react';

const SPARKLE_COUNT = 8;

export default function AcquisitionAnimation({
  teamName,
  houseName,
  houseColor,
  amount,
  startX,
  startY,
  targetX,
  targetY,
  onDone,
}) {
  const [phase, setPhase] = useState('hidden');

  const sx = startX ?? window.innerWidth / 2;
  const sy = startY ?? Math.min(200, window.innerHeight * 0.24);
  const tx = targetX ?? window.innerWidth / 2;
  const ty = targetY ?? window.innerHeight / 2;

  const dx = tx - sx;
  const dy = ty - sy;

  const hcGlow = `${houseColor}88`;
  const hcDim = `${houseColor}44`;

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPhase('appear');
    });
    const timers = [
      setTimeout(() => setPhase('hold'), 650),
      setTimeout(() => setPhase('fly'), 1250),
      setTimeout(() => setPhase('burst'), 2050),
      setTimeout(() => {
        setPhase('gone');
        onDone?.();
      }, 2850),
    ];
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div className={`acq-overlay acq-${phase}`}>
      <div className="acq-backdrop" />

      <div
        className="acq-card"
        style={{
          left: `${sx}px`,
          top: `${sy}px`,
          '--hc': houseColor,
          '--hc-glow': hcGlow,
          '--hc-dim': hcDim,
          '--dx': `${dx}px`,
          '--dy': `${dy}px`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.22rem 0.65rem',
            borderRadius: 6,
            background: 'rgba(78, 203, 128, 0.16)',
            border: '1px solid rgba(78, 203, 128, 0.5)',
            color: '#4ecb80',
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: '0.55rem',
          }}
        >
          🔨 SOLD · DRAFTED
        </div>
        <div className="acq-team-name">{teamName}</div>
        {amount ? (
          <div
            style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: '#ffffff',
              marginBottom: '0.35rem',
              letterSpacing: '0.04em',
            }}
          >
            {Number(amount).toLocaleString()} pts
          </div>
        ) : null}
        <div className="acq-divider" style={{ background: houseColor }} />
        <div className="acq-house-label" style={{ color: houseColor }}>
          → {houseName}
        </div>

        {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
          <div key={i} className="acq-sparkle" style={{ '--si': i, background: houseColor }} />
        ))}
      </div>

      {phase === 'burst' && (
        <div
          className="acq-burst"
          style={{ '--hc': houseColor, left: tx, top: ty }}
        />
      )}
    </div>
  );
}
