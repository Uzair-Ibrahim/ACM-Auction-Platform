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

  // Track Center Stage Bidding Hero position while a team is being bid on
  useEffect(() => {
    if (currentTeam && heroRef.current) {
      const rect = heroRef.current.getBoundingClientRect();
      lastHeroCoordsRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  }, [currentTeam, auction.currentBid]);

  // When a team is sold, calculate swap-out trajectory from Center Stage Hero to the winning House card
  useEffect(() => {
    if (acquisition && houseRefs.current[acquisition.houseId]) {
      const targetRect = houseRefs.current[acquisition.houseId].getBoundingClientRect();
      const startX = lastHeroCoordsRef.current?.x ?? window.innerWidth / 2;
      const startY =
        lastHeroCoordsRef.current?.y ?? Math.min(195, Math.max(140, window.innerHeight * 0.22));
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

      {/* ── Center Stage Hero Banner (ONLY visible while a team is actively being bid on) ── */}
      {currentTeam && (
        <div
          ref={heroRef}
          className="auction-hero"
          style={
            auction.isBlindBidActive
              ? {
                  borderColor: 'rgba(231,76,60,0.75)',
                  background:
                    'linear-gradient(135deg, rgba(231,76,60,0.18) 0%, rgba(12,12,22,0.96) 60%)',
                  boxShadow: '0 0 28px rgba(231,76,60,0.25)',
                }
              : {}
          }
        >
          <div className="auction-hero-top">
            <span
              className="auction-live-badge"
              style={
                auction.isBlindBidActive
                  ? {
                      borderRadius: 8,
                      color: '#ff6b5b',
                      borderColor: 'rgba(231,76,60,0.6)',
                      background: 'rgba(231,76,60,0.14)',
                    }
                  : { borderRadius: 8 }
              }
            >
              <span
                className="auction-live-dot"
                style={auction.isBlindBidActive ? { background: '#ff6b5b' } : {}}
              />
              {auction.isBlindBidActive ? '🔇 Blind Bid Protocol Active' : 'Current Bidding Team'}
            </span>
            <span className="auction-hero-batch">{currentBatch?.name || ''}</span>
            {auction.isBlindBidRound && (
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '0.18rem 0.6rem',
                  borderRadius: 6,
                  background: 'rgba(231,76,60,0.14)',
                  border: '1px solid rgba(231,76,60,0.45)',
                  color: '#fca5a5',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                }}
              >
                ⚡{' '}
                {auction.blindBidRuleLabel ||
                  `Blind Bid @ ${Number(auction.blindBidThreshold || 15000).toLocaleString()} pts`}{' '}
                · No Freeze Card
              </span>
            )}
          </div>

          <h2 className="auction-hero-name">{currentTeam.name}</h2>

          <div className="auction-hero-stats">
            <div className="auction-hero-stat">
              <span>{auction.isBlindBidActive ? 'Trigger Reached' : 'Current Highest Bid'}</span>
              <strong style={auction.isBlindBidActive ? { color: '#ff6b5b' } : {}}>
                {auction.currentBid > 0
                  ? `${Number(auction.currentBid).toLocaleString()} pts`
                  : `Base: ${Number(settings?.basePrice || 5000).toLocaleString()} pts`}
              </strong>
            </div>

            {activeHouse && !auction.isBlindBidActive && (
              <div
                className="auction-hero-stat auction-hero-house-stat"
                style={{ '--hc': houseStyles[activeHouse.id]?.accent || '#f4d66d' }}
              >
                <span>Leading House</span>
                <strong>{activeHouse.name}</strong>
              </div>
            )}

            {auction.isBlindBidActive && (
              <div
                className="auction-hero-stat"
                style={{ borderColor: 'rgba(231,76,60,0.5)' }}
              >
                <span>
                  Sealed Bids Locked (&gt; {Number(auction.blindBidThreshold || 15000).toLocaleString()} pts)
                </span>
                <strong style={{ color: '#f4d66d', fontSize: '0.9rem' }}>
                  {houses
                    .filter((h) => auction.blindBids?.[h.id]?.submitted)
                    .map((h) => h.name)
                    .join(' · ') || 'Awaiting sealed bids…'}
                </strong>
              </div>
            )}

            {frozenHouse && (
              <div
                className="auction-hero-stat"
                style={{
                  borderColor: 'rgba(96,165,250,0.55)',
                  background: 'rgba(30,58,138,0.22)',
                }}
              >
                <span style={{ color: '#93c5fd' }}>❄ Active Stage Freeze</span>
                <strong style={{ color: '#bfdbfe', fontSize: '0.92rem' }}>
                  {frozenHouse.name} (by {frozenByHouse?.name || 'Rival'})
                </strong>
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
