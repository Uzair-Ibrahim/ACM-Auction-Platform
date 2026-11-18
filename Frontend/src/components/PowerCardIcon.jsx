import React from 'react';

/**
 * Displays the Freeze Card icon ('freeze').
 * Greys out when `used` is true.
 */
export default function PowerCardIcon({ type = 'freeze', used, size = 'sm', showLabel = true }) {
  if (type !== 'freeze') return null;

  const card = {
    icon: '❄',
    label: 'Freeze Card',
    color: '#60a5fa',
    desc: 'Silences a rival House until another House bids (Quick Draw)',
  };

  const sizes = {
    xs: { icon: 13, label: 10, pad: '3px 8px' },
    sm: { icon: 15, label: 11, pad: '5px 10px' },
    md: { icon: 20, label: 12, pad: '8px 14px' },
  };
  const s = sizes[size] || sizes.sm;

  return (
    <div
      title={used ? `${card.label} — USED` : `${card.label}: ${card.desc}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: used ? 'rgba(255,255,255,0.04)' : `${card.color}22`,
        border: `1px solid ${used ? 'rgba(255,255,255,0.14)' : `${card.color}99`}`,
        borderRadius: 6,
        padding: s.pad,
        opacity: used ? 0.45 : 1,
        filter: used ? 'grayscale(1)' : 'none',
        transition: 'opacity 0.25s, filter 0.25s',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: s.icon, lineHeight: 1 }}>{card.icon}</span>
      {showLabel && (
        <span
          style={{
            fontSize: s.label,
            color: used ? '#888' : '#bfdbfe',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          }}
        >
          {used ? `${card.label} · USED` : card.label}
        </span>
      )}
    </div>
  );
}
