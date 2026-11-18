import React from 'react';

const HERALDIC_CRESTS = {
  gryffindor: {
    primary: '#b91c1c',
    secondary: '#7f1d1d',
    trim: '#f7d37d',
    motto: 'COURAGE · VALOR · CHIVALRY',
    emblemPath:
      // Rampant Lion & Crown heraldic silhouette
      'M32 10 L36 16 L42 12 L40 20 L24 20 L22 12 L28 16 Z M24 24 C24 24 40 24 42 30 C44 36 38 42 38 48 L44 54 L20 54 L26 48 C26 42 20 36 22 30 Z',
    animal: '🦁',
  },
  slytherin: {
    primary: '#15803d',
    secondary: '#14532d',
    trim: '#9ddca0',
    motto: 'AMBITION · CUNNING · PRIDE',
    emblemPath:
      // Coiled Serpent S-curve heraldic silhouette
      'M38 14 C24 14 20 24 32 30 C44 36 40 50 24 50 C20 50 18 46 22 44 C26 46 34 44 34 38 C34 32 18 28 20 18 C22 12 32 10 38 14 Z',
    animal: '🐍',
  },
  ravenclaw: {
    primary: '#1d4ed8',
    secondary: '#1e3a8a',
    trim: '#a9c8ff',
    motto: 'WIT · LEARNING · WISDOM',
    emblemPath:
      // Soaring Eagle Wings heraldic silhouette
      'M32 16 L38 26 L52 18 L44 34 L50 40 L32 36 L14 40 L20 34 L12 18 L26 26 Z M28 40 L36 40 L32 52 Z',
    animal: '🦅',
  },
  hufflepuff: {
    primary: '#ca8a04',
    secondary: '#713f12',
    trim: '#f4d979',
    motto: 'LOYALTY · PATIENCE · HONOR',
    emblemPath:
      // Heraldic Badger Shield & Stripes
      'M22 16 L28 12 L32 18 L36 12 L42 16 L44 32 C44 44 32 52 32 52 C32 52 20 44 20 32 Z',
    animal: '🦡',
  },
};

/**
 * Renders the House Flag Banner in the background of a House panel
 * (Projector Board & House Captain Dashboard).
 */
export default function HouseFlagBackground({ house, opacity = 0.26, variant = 'card' }) {
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
      {/* Ornate Medieval Hanging House Flag Banner SVG */}
      <svg
        viewBox="0 0 240 380"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          top: isHero ? '-4%' : '-2%',
          right: isHero ? '4%' : '50%',
          transform: isHero ? 'none' : 'translateX(50%)',
          width: isHero ? '260px' : '92%',
          height: '104%',
          opacity,
          filter: `drop-shadow(0 8px 24px ${cfg.primary}66)`,
        }}
      >
        <defs>
          <linearGradient id={`flag-grad-${house.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cfg.primary} stopOpacity="0.95" />
            <stop offset="65%" stopColor={cfg.secondary} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#05050a" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id={`trim-grad-${house.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={cfg.trim} stopOpacity="0.9" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="100%" stopColor={cfg.trim} stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Top Flag Crossbar & Finials */}
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

        {/* Swallowtail Hanging Flag Body */}
        <path
          d="M 28 16 L 212 16 L 212 310 L 120 265 L 28 310 Z"
          fill={`url(#flag-grad-${house.id})`}
          stroke={`url(#trim-grad-${house.id})`}
          strokeWidth="3"
        />

        {/* Inner Gold/Silver Filigree Border */}
        <path
          d="M 38 26 L 202 26 L 202 288 L 120 248 L 38 288 Z"
          fill="none"
          stroke={cfg.trim}
          strokeWidth="1.2"
          strokeDasharray="6 4"
          opacity="0.7"
        />

        {/* Vertical Chevrons / Stripes */}
        <line x1="75" y1="26" x2="75" y2="270" stroke={cfg.trim} strokeWidth="0.8" opacity="0.25" />
        <line x1="165" y1="26" x2="165" y2="270" stroke={cfg.trim} strokeWidth="0.8" opacity="0.25" />

        {/* Central Heraldic Escutcheon (Shield) */}
        <path
          d="M 120 58 L 172 76 L 172 142 C 172 182 120 208 120 208 C 120 208 68 182 68 142 L 68 76 Z"
          fill="rgba(7, 7, 14, 0.55)"
          stroke={`url(#trim-grad-${house.id})`}
          strokeWidth="3"
        />
        <path
          d="M 120 66 L 164 82 L 164 140 C 164 174 120 198 120 198 C 120 198 76 174 76 140 L 76 82 Z"
          fill="none"
          stroke={cfg.trim}
          strokeWidth="1"
          opacity="0.6"
        />

        {/* Shield Quartering Lines */}
        <line x1="120" y1="66" x2="120" y2="198" stroke={cfg.trim} strokeWidth="0.8" opacity="0.3" />
        <line x1="76" y1="130" x2="164" y2="130" stroke={cfg.trim} strokeWidth="0.8" opacity="0.3" />

        {/* Heraldic Crest Silhouette inside Shield */}
        <g transform="translate(78, 84) scale(1.32)">
          <path d={cfg.emblemPath} fill={cfg.trim} opacity="0.35" />
        </g>

        {/* Large Monogram Crest Letter */}
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

        {/* House Name Banner Scroll */}
        <rect
          x="52"
          y="218"
          width="136"
          height="22"
          rx="4"
          fill="rgba(7, 7, 14, 0.75)"
          stroke={cfg.trim}
          strokeWidth="1.5"
        />
        <text
          x="120"
          y="233"
          textAnchor="middle"
          fill={cfg.trim}
          fontFamily="Cinzel, serif"
          fontWeight="700"
          fontSize="11"
          letterSpacing="3"
        >
          {String(house.name || '').toUpperCase()}
        </text>
      </svg>

      {/* Subtle Bottom Vignette so foreground text stays 100% readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(7,7,14,0.18) 0%, rgba(7,7,14,0.45) 55%, rgba(7,7,14,0.82) 100%)',
        }}
      />
    </div>
  );
}
