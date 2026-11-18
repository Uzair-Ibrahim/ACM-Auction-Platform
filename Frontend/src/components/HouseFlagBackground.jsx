import React from 'react';

const HERALDIC_CRESTS = {
  gryffindor: {
    primary: '#b91c1c',
    secondary: '#7f1d1d',
    trim: '#f7d37d',
    emblemPath:
      'M32 10 L36 16 L42 12 L40 20 L24 20 L22 12 L28 16 Z M24 24 C24 24 40 24 42 30 C44 36 38 42 38 48 L44 54 L20 54 L26 48 C26 42 20 36 22 30 Z',
  },
  slytherin: {
    primary: '#15803d',
    secondary: '#14532d',
    trim: '#9ddca0',
    emblemPath:
      'M38 14 C24 14 20 24 32 30 C44 36 40 50 24 50 C20 50 18 46 22 44 C26 46 34 44 34 38 C34 32 18 28 20 18 C22 12 32 10 38 14 Z',
  },
  ravenclaw: {
    primary: '#1d4ed8',
    secondary: '#1e3a8a',
    trim: '#a9c8ff',
    emblemPath:
      'M32 16 L38 26 L52 18 L44 34 L50 40 L32 36 L14 40 L20 34 L12 18 L26 26 Z M28 40 L36 40 L32 52 Z',
  },
  hufflepuff: {
    primary: '#ca8a04',
    secondary: '#713f12',
    trim: '#f4d979',
    emblemPath:
      'M22 16 L28 12 L32 18 L36 12 L42 16 L44 32 C44 44 32 52 32 52 C32 52 20 44 20 32 Z',
  },
};

/**
 * Subtle watermark House Flag Banner in the background of a House panel.
 * Kept intentionally low-opacity with a dark contrast scrim so foreground text is 100% crisp.
 */
export default function HouseFlagBackground({ house, opacity = 0.09, variant = 'card' }) {
  if (!house) return null;
  const cfg = HERALDIC_CRESTS[house.id] || HERALDIC_CRESTS.gryffindor;
  const isHero = variant === 'portal';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        borderRadius: 'inherit',
      }}
    >
      <svg
        viewBox="0 0 240 380"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          top: isHero ? '-4%' : '-2%',
          right: isHero ? '4%' : '50%',
          transform: isHero ? 'none' : 'translateX(50%)',
          width: isHero ? '250px' : '88%',
          height: '102%',
          opacity,
        }}
      >
        <defs>
          <linearGradient id={`flag-grad-${house.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cfg.primary} stopOpacity="0.9" />
            <stop offset="65%" stopColor={cfg.secondary} stopOpacity="0.75" />
            <stop offset="100%" stopColor="#05050a" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={`trim-grad-${house.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={cfg.trim} stopOpacity="0.85" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="100%" stopColor={cfg.trim} stopOpacity="0.8" />
          </linearGradient>
        </defs>

        <line
          x1="16"
          y1="14"
          x2="224"
          y2="14"
          stroke={`url(#trim-grad-${house.id})`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="16" cy="14" r="5" fill={cfg.trim} />
        <circle cx="224" cy="14" r="5" fill={cfg.trim} />

        <path
          d="M 28 16 L 212 16 L 212 310 L 120 265 L 28 310 Z"
          fill={`url(#flag-grad-${house.id})`}
          stroke={`url(#trim-grad-${house.id})`}
          strokeWidth="3"
        />

        <path
          d="M 38 26 L 202 26 L 202 288 L 120 248 L 38 288 Z"
          fill="none"
          stroke={cfg.trim}
          strokeWidth="1.2"
          strokeDasharray="6 4"
          opacity="0.6"
        />

        <path
          d="M 120 58 L 172 76 L 172 142 C 172 182 120 208 120 208 C 120 208 68 182 68 142 L 68 76 Z"
          fill="rgba(7, 7, 14, 0.65)"
          stroke={`url(#trim-grad-${house.id})`}
          strokeWidth="3"
        />

        <g transform="translate(78, 84) scale(1.32)">
          <path d={cfg.emblemPath} fill={cfg.trim} opacity="0.3" />
        </g>

        <text
          x="120"
          y="152"
          textAnchor="middle"
          fill={cfg.trim}
          fontFamily="Cinzel, serif"
          fontWeight="800"
          fontSize="54"
          letterSpacing="2"
        >
          {house.crest || house.name?.[0] || 'H'}
        </text>
      </svg>

      {/* Dark contrast scrim so foreground numbers and text pop clearly */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(6,6,14,0.45) 0%, rgba(6,6,14,0.68) 50%, rgba(6,6,14,0.88) 100%)',
        }}
      />
    </div>
  );
}
