import React from 'react';

/**
 * Displays a single power card icon ('freeze' or 'rtm').
 * Greys out when `used` is true.
 */
export default function PowerCardIcon({ type, used, size = 'sm', showLabel = true }) {
  const cards = {
    freeze: {
      icon: '❄',
      label: 'Freeze',
      color: '#60a5fa',
      desc: 'Silences a rival House until another House bids',
    },
    rtm: {
      icon: '⚡',
      label: 'RTM',
      color: '#f4d66d',
      desc: 'Right to Match — Absolute steal at final floor price',
    },
  };
  const card = cards[type];
  if (!card) return null;

  const sizes = {
    xs: { icon: 13, label: 10, pad: '3px 8px' },
    sm: { icon: 15, label: 11, pad: '5px 10px' },
    md: { icon: 20, label: 12, pad: '8px 14px' },
  };
  const s = sizes[size] || sizes.sm;

  return (
    <div
      title={used ? `${card.label} Card — USED` : `${card.label} Card: ${card.desc}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: used ? 'rgba(255,255,255,0.03)' : `${card.color}1c`,
        border: `1px solid ${used ? 'rgba(255,255,255,0.12)' : `${card.color}88`}`,
        borderRadius: 6,
        padding: s.pad,
        opacity: used ? 0.42 : 1,
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
            color: used ? '#777' : card.color,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {used ? `${card.label} · USED` : card.label}
        </span>
      )}
    </div>
  );
}
