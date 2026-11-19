import React, { useEffect, useRef, useState } from 'react';
import { useAuction } from '../context/AuctionContext';
import AcquisitionAnimation from '../components/AcquisitionAnimation';
import BlindBidAlert from '../components/BlindBidAlert';
import HouseFlagBackground from '../components/HouseFlagBackground';

const houseStyles = {
  gryffindor: {
    bg: '#5d1713',
    accent: '#f7d37d',
    ptsColor: '#f5b041',
    glow: 'rgba(247,211,125,0.55)',
    bar: '#d83d2f',
    logo: '/logos/logo_gryffindor.png',
  },
  slytherin: {
    bg: '#173d2d',
    accent: '#9ddca0',
    ptsColor: '#4ecb80',
    glow: 'rgba(157,220,160,0.55)',
    bar: '#2d9a5d',
    logo: '/logos/logo_slytherin.png',
  },
  ravenclaw: {
    bg: '#182b4d',
    accent: '#a9c8ff',
    ptsColor: '#7fb3ff',
    glow: 'rgba(169,200,255,0.55)',
    bar: '#3f6dbd',
    logo: '/logos/logo_ravenclaw.png',
  },
  hufflepuff: {
    bg: '#544313',
    accent: '#f4d979',
    ptsColor: '#f4d66d',
    glow: 'rgba(244,217,121,0.55)',
    bar: '#d7a236',
    logo: '/logos/logo_hufflepuff.png',
  },
};

const FREEZE_FLAKES = ['❄', '❅', '❆', '❄', '❅'];

function FreezeOverlay({ frozenByHouseName }) {
  return (
    <div className="freeze-overlay">
      {FREEZE_FLAKES.map((flake, i) => (
        <span
          key={i}
          className="freeze-flake"
          style={{
            '--fx': `${12 + i * 18}%`,
            '--fdelay': `${i * 0.55}s`,
            '--fdur': `${2.4 + (i % 3) * 0.6}s`,
          }}
        >
          {flake}
        </span>
      ))}
      <div className="freeze-center">
        <span className="freeze-icon-spin">❄</span>
        <span className="freeze-label">FROZEN</span>
        {frozenByHouseName && (
          <span
            style={{
              fontSize: '0.62rem',
              color: '#bfdbfe',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textAlign: 'center',
              padding: '0 0.5rem',
            }}
          >
            By {frozenByHouseName} · Until 3rd house bids
          </span>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { state, dispatch } = useAuction();
  const {
    settings,
    houses,
    batches,
    teams,
    transactions,
    auction,
    connected,
    acquisition,
    blindBidAlert,
    notice,
  } = state;

  const pointLimit = settings?.housePointLimit || 150000;

  const houseRefs = useRef({});
  const heroRef = useRef(null);
  const lastHeroCoordsRef = useRef(null);
  const [animCoords, setAnimCoords] = useState(null);

  const activeHouse = houses.find((h) => h.id === auction.selectedHouseId) || null;
  const currentTeam =
    teams.find((t) => t.id === auction.currentTeamId) || auction.currentTeam || null;
  const currentBatch = currentTeam
    ? batches.find((b) => b.id === currentTeam.batchId) || null
    : null;
  const frozenHouse = auction.frozenHouseId
    ? houses.find((h) => h.id === auction.frozenHouseId) || null
    : null;
  const frozenByHouse = auction.frozenByHouseId
    ? houses.find((h) => h.id === auction.frozenByHouseId) || null
    : null;

  // Track Center Stage Bidding Card position (center of screen)
  useEffect(() => {
    if (currentTeam && heroRef.current) {
      const rect = heroRef.current.getBoundingClientRect();
      lastHeroCoordsRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  }, [currentTeam, auction.currentBid]);

  // When a team is sold, calculate swap-out trajectory from Center Stage to the winning House card
  useEffect(() => {
    if (acquisition && houseRefs.current[acquisition.houseId]) {
      const targetRect = houseRefs.current[acquisition.houseId].getBoundingClientRect();
      const startX = lastHeroCoordsRef.current?.x ?? window.innerWidth / 2;
      const startY = lastHeroCoordsRef.current?.y ?? window.innerHeight / 2;
      setAnimCoords({
        startX,
        startY,
        targetX: targetRect.left + targetRect.width / 2,
        targetY: targetRect.top + targetRect.height / 2,
      });
    } else if (!acquisition) {
      setAnimCoords(null);
    }
  }, [acquisition]);

  function clearAcquisition() {
    dispatch({ type: 'CLEAR_ACQUISITION' });
    setAnimCoords(null);
  }

  const acquisitionHouse = acquisition
    ? houses.find((h) => h.id === acquisition.houseId)
    : null;

  return (
    <div className="dashboard-page">
      <BlindBidAlert
        alert={blindBidAlert}
        onClose={() => dispatch({ type: 'CLEAR_BLIND_BID_ALERT' })}
      />

      <header className="dashboard-header">
        <div>
          <p className="eyebrow">THE GRAND AUCTION 2026</p>
          <h1>OFFICIAL HOUSE DRAFT BOARD</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.42rem 0.9rem',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.03)',
              fontSize: '0.76rem',
              color: 'var(--muted)',
            }}
          >
            Target: <strong style={{ color: 'var(--text)' }}>12 Teams</strong> (1 Core + 11 Drafted) / House
          </div>
          <div className="connection-pill" style={{ borderRadius: 8 }}>
            <span className={`dot ${connected ? 'online' : 'offline'}`} />
            {connected ? 'Live' : 'Reconnecting'}
          </div>
        </div>
      </header>

      {notice && (
        <div
          onClick={() => dispatch({ type: 'CLEAR_NOTICE' })}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 10,
            border:
              notice.type === 'freeze'
                ? '1px solid rgba(96,165,250,0.55)'
                : '1px solid rgba(244,214,109,0.4)',
            background:
              notice.type === 'freeze'
                ? 'rgba(30,64,175,0.25)'
                : 'rgba(244,214,109,0.1)',
            color: notice.type === 'freeze' ? '#bfdbfe' : 'var(--gold)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>
            <strong>{notice.title}:</strong> {notice.text}
          </span>
          <span>✕</span>
        </div>
      )}

      {/* ── Centered Live Bidding Modal Overlay (background 4-house board stays visible behind) ── */}
      {currentTeam && !acquisition && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(4, 4, 12, 0.72)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            pointerEvents: 'none',
            animation: 'heroAppear 0.3s ease',
          }}
        >
          <div
            ref={heroRef}
            style={{
              width: 'min(540px, 100%)',
              borderRadius: 16,
              padding: '2rem 2.1rem 1.75rem',
              textAlign: 'center',
              background: auction.isBlindBidActive
                ? 'linear-gradient(160deg, rgba(36, 10, 12, 0.97) 0%, rgba(12, 6, 10, 0.98) 100%)'
                : 'linear-gradient(160deg, rgba(16, 16, 30, 0.97) 0%, rgba(9, 9, 18, 0.98) 100%)',
              border: auction.isBlindBidActive
                ? '1.5px solid rgba(231, 76, 60, 0.85)'
                : '1.5px solid rgba(244, 214, 109, 0.8)',
              boxShadow: auction.isBlindBidActive
                ? '0 0 46px rgba(231, 76, 60, 0.45), 0 0 90px rgba(231, 76, 60, 0.18)'
                : '0 0 46px rgba(244, 214, 109, 0.36), 0 0 95px rgba(244, 214, 109, 0.14)',
            }}
          >
            {/* Top Status Capsules */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.55rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.28rem 0.85rem',
                  borderRadius: 999,
                  background: auction.isBlindBidActive
                    ? 'linear-gradient(135deg, #e74c3c, #c0392b)'
                    : 'linear-gradient(135deg, #27ae60, #2ecc71)',
                  boxShadow: auction.isBlindBidActive
                    ? '0 0 16px rgba(231, 76, 60, 0.45)'
                    : '0 0 16px rgba(46, 204, 113, 0.45)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ffffff',
                  }}
                />
                {auction.isBlindBidActive ? 'BLIND BID PROTOCOL' : 'LIVE AUCTION'}
              </span>

              {currentBatch && (
                <span
                  style={{
                    padding: '0.28rem 0.8rem',
                    borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#d6d0c4',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  {currentBatch.name}
                </span>
              )}
            </div>

            {/* Active Team Name */}
            <h2
              style={{
                margin: '0.9rem 0 1rem',
                fontFamily: 'Cinzel, serif',
                fontWeight: 800,
                fontSize: 'clamp(1.65rem, 3.2vw, 2.55rem)',
                letterSpacing: '0.05em',
                color: '#ffffff',
                textShadow: '0 0 18px rgba(255, 255, 255, 0.22)',
                lineHeight: 1.12,
              }}
            >
              {currentTeam.name}
            </h2>

            {/* Recessed Highest Bid Box */}
            <div
              style={{
                borderRadius: 12,
                background: 'rgba(4, 4, 10, 0.65)',
                border: auction.isBlindBidActive
                  ? '1px solid rgba(231, 76, 60, 0.35)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0.95rem 1.25rem',
                marginBottom: '0.9rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.64rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#9a9185',
                  marginBottom: '0.3rem',
                  fontWeight: 600,
                }}
              >
                {auction.isBlindBidActive ? 'BLIND BID TRIGGER REACHED' : 'CURRENT HIGHEST BID'}
              </div>
              <div
                style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 800,
                  color: auction.isBlindBidActive ? '#ff6b5b' : 'var(--gold)',
                  textShadow: auction.isBlindBidActive
                    ? '0 0 22px rgba(231, 76, 60, 0.5)'
                    : '0 0 22px rgba(244, 214, 109, 0.45)',
                  lineHeight: 1,
                }}
              >
                {Number(auction.currentBid || 0).toLocaleString()}
                <span
                  style={{
                    fontSize: '0.38em',
                    color: '#c4bfb6',
                    marginLeft: '0.45rem',
                    letterSpacing: '0.14em',
                    fontWeight: 600,
                  }}
                >
                  PTS
                </span>
              </div>
            </div>

            {/* Leading House / Opening Paddle / Blind Bids Status */}
            {auction.isBlindBidActive ? (
              <div style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 600 }}>
                Sealed Bids Locked (&gt; {Number(auction.blindBidThreshold || 15000).toLocaleString()} pts):{' '}
                <strong style={{ color: '#f4d66d' }}>
                  {houses
                    .filter((h) => auction.blindBids?.[h.id]?.submitted)
                    .map((h) => h.name)
                    .join(' · ') || 'Awaiting sealed bids…'}
                </strong>
              </div>
            ) : activeHouse && auction.currentBid > 0 ? (
              <div style={{ fontSize: '0.86rem', color: '#e5e0d5' }}>
                Leading House:{' '}
                <strong
                  style={{
                    color: houseStyles[activeHouse.id]?.accent || '#f4d66d',
                    fontFamily: 'Cinzel, serif',
                    letterSpacing: '0.04em',
                  }}
                >
                  {activeHouse.name}
                </strong>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#9a9185' }}>
                Waiting for opening paddle (Base: {Number(settings?.basePrice || 5000).toLocaleString()} pts)...
              </div>
            )}

            {auction.isBlindBidRound && !auction.isBlindBidActive && (
              <div
                style={{
                  marginTop: '0.55rem',
                  fontSize: '0.7rem',
                  color: '#fca5a5',
                  letterSpacing: '0.06em',
                }}
              >
                ⚡{' '}
                {auction.blindBidRuleLabel ||
                  `Blind Bid @ ${Number(auction.blindBidThreshold || 15000).toLocaleString()} pts`}{' '}
                · Freeze Card Disabled
              </div>
            )}

            {frozenHouse && (
              <div
                style={{
                  marginTop: '0.55rem',
                  fontSize: '0.74rem',
                  color: '#93c5fd',
                  fontWeight: 600,
                }}
              >
                ❄ Active Freeze: {frozenHouse.name} (by {frozenByHouse?.name || 'Rival'})
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4 House Panels / Real-time Official Draft Board ── */}
      <div className="house-grid">
        {houses.map((house) => {
          const styles = houseStyles[house.id] || houseStyles.gryffindor;
          const isLeadingThisLot = Boolean(
            activeHouse?.id === house.id && currentTeam && !auction.isBlindBidActive
          );
          const isJustSoldTarget = Boolean(acquisition && acquisition.houseId === house.id);
          const isWinner = isLeadingThisLot || isJustSoldTarget;

          const remaining = house.remainingPoints ?? pointLimit;
          const isNegative = remaining < 0;
          const pct = Math.max(0, Math.min(100, (remaining / pointLimit) * 100));
          const maxBid = Number(house.maxBid || 0);
          const draftedCount = Number(house.acquiredCount || 0);
          const totalDraftQuota = Number(house.totalQuota || 11);
          const rosterTotal = draftedCount + 1; // 1 Core Captain + 11 Drafted = 12 Teams
          const needsBids = Math.max(0, totalDraftQuota - draftedCount);
          const freezeUsed = Boolean(house.powerCards?.freeze?.used);

          const houseTxs = transactions.filter(
            (tx) => tx.houseId === house.id && tx.status === 'confirmed'
          );

          return (
            <div
              key={house.id}
              ref={(el) => {
                houseRefs.current[house.id] = el;
              }}
              className={`house-panel ${isWinner ? 'winner' : ''} ${house.frozen ? 'frozen' : ''}`}
              style={{
                position: 'relative',
                background: `linear-gradient(175deg, ${styles.bg} 0%, rgba(8,8,18,0.95) 100%)`,
                boxShadow: house.frozen
                  ? '0 0 32px rgba(147,197,253,0.28), inset 0 0 16px rgba(60,130,220,0.12)'
                  : isWinner
                    ? `0 0 36px ${styles.glow}`
                    : 'none',
                overflow: 'hidden',
              }}
            >
              {/* Extracted House Crest Logo Background Layer (unchanged background) */}
              <HouseFlagBackground house={house} opacity={0.22} variant="card" />

              {house.frozen && <FreezeOverlay frozenByHouseName={house.frozenByHouseName} />}

              {/* 1. Top House Banner with Crest, House Name & Freeze Status Badge */}
              <div
                className="house-banner"
                style={{
                  position: 'relative',
                  zIndex: 2,
                  borderColor: house.frozen
                    ? 'rgba(147,197,253,0.65)'
                    : 'rgba(244,214,109,0.38)',
                  background: 'rgba(10, 14, 24, 0.55)',
                  marginBottom: '0.4rem',
                  textShadow: '0 2px 8px rgba(0,0,0,0.95)',
                }}
              >
                <span
                  className="house-crest"
                  style={{
                    border: `1.5px solid ${house.frozen ? '#93c5fd' : styles.accent}`,
                    background: 'rgba(0,0,0,0.55)',
                    overflow: 'hidden',
                    padding: 2,
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={styles.logo}
                    alt={house.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </span>

                <span
                  style={{
                    color: '#ffffff',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {house.name}
                </span>

                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.58rem',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '0.24rem 0.52rem',
                    borderRadius: 6,
                    background: house.frozen
                      ? 'rgba(30, 64, 175, 0.5)'
                      : freezeUsed
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(30, 58, 138, 0.38)',
                    border: house.frozen
                      ? '1px solid rgba(147, 197, 253, 0.65)'
                      : freezeUsed
                        ? '1px solid rgba(255, 255, 255, 0.14)'
                        : '1px solid rgba(96, 165, 250, 0.35)',
                    color: house.frozen
                      ? '#bfdbfe'
                      : freezeUsed
                        ? '#9a9185'
                        : '#93c5fd',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {house.frozen ? 'FROZEN ❄' : freezeUsed ? 'FREEZE USED' : 'FREEZE READY'}
                </span>
              </div>

              {/* 2. Purse Remaining + Progress Bar + Max Legal Bid + Roster/Needs Row */}
              <div
                className="house-balance"
                style={{
                  position: 'relative',
                  zIndex: 2,
                  marginBottom: '0.35rem',
                  textShadow: '0 2px 6px rgba(0,0,0,0.95)',
                }}
              >
                <div className="house-balance-row" style={{ marginBottom: '0.35rem' }}>
                  <span style={{ color: '#c4bfb6', fontWeight: 500 }}>Purse Remaining</span>
                  <strong
                    style={{
                      color: isNegative
                        ? '#ff5e4d'
                        : house.frozen
                          ? '#bfdbfe'
                          : styles.ptsColor,
                      fontSize: '1.05rem',
                      fontWeight: 800,
                    }}
                  >
                    {remaining.toLocaleString()} pts
                  </strong>
                </div>

                <div className="house-balance-bar" style={{ height: 6, marginBottom: '0.55rem' }}>
                  <div
                    className="house-balance-fill"
                    style={{
                      width: `${pct}%`,
                      background: isNegative
                        ? '#ff5e4d'
                        : house.frozen
                          ? '#93c5fd'
                          : styles.bar,
                    }}
                  />
                </div>

                {/* Max Legal Bid Box */}
                <div
                  className="house-balance-row"
                  style={{
                    marginBottom: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 8,
                    background: 'rgba(6, 10, 20, 0.58)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.74rem', color: '#c4bfb6', fontWeight: 500 }}>
                    Max Legal Bid:
                  </span>
                  <strong style={{ fontSize: '0.92rem', color: '#4ecb80', fontWeight: 800 }}>
                    {maxBid.toLocaleString()} pts
                  </strong>
                </div>

                {/* Roster & Needs Summary Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.72rem',
                    padding: '0.05rem 0.1rem',
                  }}
                >
                  <span style={{ color: '#c4bfb6' }}>
                    Roster:{' '}
                    <strong style={{ color: '#ffffff', fontWeight: 800 }}>
                      {rosterTotal} / 12
                    </strong>{' '}
                    <span style={{ color: 'var(--gold)', fontSize: '0.68rem' }}>
                      ({draftedCount}/{totalDraftQuota} bids)
                    </span>
                  </span>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                    Needs: {needsBids} {needsBids === 1 ? 'bid' : 'bids'}
                  </span>
                </div>
              </div>

              {/* 3. 4 Batch Quota Boxes (26k: 0/4, 25k: 0/3, 24k: 0/3, 23k: 0/1) */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.35rem',
                  marginBottom: '0.35rem',
                }}
              >
                {batches.map((b) => {
                  const count = house.slots?.[b.id] || 0;
                  const quota = b.quota || 0;
                  const full = count >= quota;
                  return (
                    <div
                      key={b.id}
                      style={{
                        background: 'rgba(6, 10, 20, 0.58)',
                        border: `1px solid ${
                          full ? 'rgba(78,203,128,0.45)' : 'rgba(255,255,255,0.07)'
                        }`,
                        borderRadius: 6,
                        padding: '0.3rem 0.25rem',
                        textAlign: 'center',
                        textShadow: '0 1px 4px rgba(0,0,0,0.95)',
                      }}
                    >
                      <div style={{ fontSize: '0.62rem', color: '#9a9185', fontWeight: 600 }}>
                        {b.code || b.name.replace(' Batch', '')}
                      </div>
                      <div
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          color: full ? '#4ecb80' : '#ffffff',
                        }}
                      >
                        {count}/{quota}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 4. Divider + Acquired Teams Roster */}
              <div
                className="house-acquired-list"
                style={{
                  position: 'relative',
                  zIndex: 2,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: '0.45rem',
                  textShadow: '0 2px 6px rgba(0,0,0,0.95)',
                }}
              >
                {houseTxs.length === 0 ? (
                  <span
                    className="empty-tag"
                    style={{
                      color: '#9a9185',
                      fontWeight: 500,
                      textAlign: 'center',
                      marginTop: '0.65rem',
                    }}
                  >
                    No teams acquired yet
                  </span>
                ) : (
                  houseTxs.map((tx) => {
                    const team = teams.find((t) => t.id === tx.teamId);
                    if (!team) return null;
                    const isNewlySold = Boolean(acquisition && acquisition.txId === tx.id);
                    return (
                      <div
                        key={tx.id}
                        className="house-acquired-row"
                        style={{
                          background: isNewlySold
                            ? 'rgba(78, 203, 128, 0.18)'
                            : 'transparent',
                          border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: isNewlySold ? 6 : 0,
                          padding: '0.38rem 0.25rem',
                          transition: 'background 0.4s ease',
                        }}
                      >
                        <span
                          className="house-acquired-name"
                          style={{ color: '#ffffff', fontWeight: 700 }}
                        >
                          {team.name}
                          {tx.viaBlindBid && (
                            <span
                              style={{
                                marginLeft: '0.35rem',
                                fontSize: '0.58rem',
                                color: '#fca5a5',
                                border: '1px solid rgba(231,76,60,0.55)',
                                borderRadius: 4,
                                padding: '0.05rem 0.3rem',
                                background: 'rgba(0,0,0,0.45)',
                              }}
                            >
                              BLIND
                            </span>
                          )}
                        </span>
                        <span
                          className="house-acquired-pts"
                          style={{
                            color: house.frozen ? '#bfdbfe' : 'var(--gold)',
                            fontWeight: 800,
                          }}
                        >
                          {Number(tx.amount).toLocaleString()} pts
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sold Team Swap-Out Animation Overlay (flies from Center Stage to Winning House) ── */}
      {acquisition && animCoords && (
        <AcquisitionAnimation
          teamName={acquisition.teamName}
          houseName={acquisition.houseName}
          houseColor={acquisitionHouse?.color || '#f4d66d'}
          amount={acquisition.amount}
          startX={animCoords.startX}
          startY={animCoords.startY}
          targetX={animCoords.targetX}
          targetY={animCoords.targetY}
          onDone={clearAcquisition}
        />
      )}
    </div>
  );
}
