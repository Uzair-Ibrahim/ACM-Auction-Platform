import { useEffect, useState } from 'react';

const SPARKLE_COUNT = 8;

export default function AcquisitionAnimation({ teamName, houseName, houseColor, targetX, targetY, onDone }) {
  const [phase, setPhase] = useState('hidden');

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const dx = (targetX ?? cx) - cx;
  const dy = (targetY ?? cy) - cy;

  const hcGlow = `${houseColor}88`;
  const hcDim  = `${houseColor}44`;

  useEffect(() => {
    // rAF ensures browser paints the initial hidden state before animating
    const raf = requestAnimationFrame(() => {
      setPhase('appear');
    });
    const timers = [
      setTimeout(() => setPhase('hold'),  700),
      setTimeout(() => setPhase('fly'),   1200),
      setTimeout(() => setPhase('burst'), 2000),
      setTimeout(() => { setPhase('gone'); onDone?.(); }, 2800),
    ];
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div className={`acq-overlay acq-${phase}`}>
      <div className="acq-backdrop" />

      <div
        className="acq-card"
        style={{
          '--hc': houseColor,
          '--hc-glow': hcGlow,
          '--hc-dim': hcDim,
          '--dx': `${dx}px`,
          '--dy': `${dy}px`,
        }}
      >
        <div className="acq-rune">⚡</div>
        <div className="acq-team-name">{teamName}</div>
        <div className="acq-divider" style={{ background: houseColor }} />
        <div className="acq-house-label" style={{ color: houseColor }}>{houseName}</div>

        {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
          <div key={i} className="acq-sparkle" style={{ '--si': i, background: houseColor }} />
        ))}
      </div>

      {phase === 'burst' && (
        <div
          className="acq-burst"
          style={{ '--hc': houseColor, left: targetX ?? cx, top: targetY ?? cy }}
        />
      )}
    </div>
  );
}
