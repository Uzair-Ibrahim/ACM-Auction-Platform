import React from 'react';

const HOUSE_LOGO_PATHS = {
  gryffindor: '/logos/logo_gryffindor.png',
  slytherin: '/logos/logo_slytherin.png',
  ravenclaw: '/logos/logo_ravenclaw.png',
  hufflepuff: '/logos/logo_hufflepuff.png',
};

/**
 * Renders the extracted transparent House Crest & Ribbon Logo
 * cleanly in the background of each respective House panel.
 */
export default function HouseFlagBackground({ house, opacity = 0.22, variant = 'card' }) {
  if (!house) return null;
  const logoSrc = HOUSE_LOGO_PATHS[house.id] || HOUSE_LOGO_PATHS.gryffindor;
  const isPortal = variant === 'portal';

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: isPortal ? 'flex-end' : 'center',
        paddingRight: isPortal ? '1.5rem' : 0,
      }}
    >
      <img
        src={logoSrc}
        alt=""
        style={{
          width: isPortal ? '260px' : '84%',
          maxWidth: isPortal ? '280px' : '265px',
          height: 'auto',
          objectFit: 'contain',
          opacity: isPortal ? 0.16 : opacity,
          filter: 'drop-shadow(0 8px 22px rgba(0, 0, 0, 0.85)) saturate(1.1)',
          transform: isPortal ? 'none' : 'translateY(4%)',
          userSelect: 'none',
        }}
      />

      {/* Subtle dark contrast vignette so foreground text & numbers stay 100% sharp */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 54%, rgba(6,6,14,0.28) 0%, rgba(6,6,14,0.68) 85%)',
        }}
      />
    </div>
  );
}
