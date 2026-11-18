import React, { useEffect, useRef, useState } from 'react';
import { useAuction } from '../context/AuctionContext';
import AcquisitionAnimation from '../components/AcquisitionAnimation';
import BlindBidAlert from '../components/BlindBidAlert';
import PowerCardIcon from '../components/PowerCardIcon';
import HouseFlagBackground from '../components/HouseFlagBackground';

const houseStyles = {
  gryffindor: { bg: '#5d1713', accent: '#f7d37d', glow: 'rgba(247,211,125,0.55)', bar: '#d83d2f' },
  slytherin:  { bg: '#173d2d', accent: '#9ddca0', glow: 'rgba(157,220,160,0.55)', bar: '#2d9a5d' },
  ravenclaw:  { bg: '#182b4d', accent: '#a9c8ff', glow: 'rgba(169,200,255,0.55)', bar: '#3f6dbd' },
  hufflepuff: { bg: '#544313', accent: '#f4d979', glow: 'rgba(244,217,121,0.55)', bar: '#d7a236' },
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
  const [animTarget, setAnimTarget] = useState(null);

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

  useEffect(() => {
    if (acquisition && houseRefs.current[acquisition.houseId]) {
      const rect = houseRefs.current[acquisition.houseId].getBoundingClientRect();
      setAnimTarget({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else if (!acquisition) {
      setAnimTarget(null);
    }
  }, [acquisition]);

  function clearAcquisition() {
    dispatch({ type: 'CLEAR_ACQUISITION' });
    setAnimTarget(null);
  }

  const acquisitionHouse = acquisition
    ? houses.find((h) => h.id === acquisition.houseId)
    : null;

  const totalSold = teams.filter((t) => t.status === 'assigned').length;
  const totalPool = teams.length || 44;

  return (
    <div className="dashboard-page">
      <BlindBidAlert
        alert={blindBidAlert}
        onClose={() => dispatch({ type: 'CLEAR_BLIND_BID_ALERT' })}
      />

      <header className="dashboard-header">
        <div>
          <p className="eyebrow">FAST NUCES Karachi · Coders Cup Draft</p>
          <h1>Live Projector Dashboard</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.32rem 0.85rem',
              borderRadius: 999,
              border: '1px solid rgba(244,214,109,0.28)',
              background: 'rgba(244,214,109,0.07)',
              fontSize: '0.76rem',
              color: 'var(--gold)',
              fontWeight: 600,
            }}
          >
            Drafted: {totalSold} / {totalPool} Teams
          </div>
          <div className="connection-pill">
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

      {/* ── Center Stage Hero Banner ── */}
      {currentTeam ? (
        <div
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
                      color: '#ff6b5b',
                      borderColor: 'rgba(231,76,60,0.6)',
                      background: 'rgba(231,76,60,0.14)',
                    }
                  : {}
              }
            >
              <span
                className="auction-live-dot"
                style={auction.isBlindBidActive ? { background: '#ff6b5b' } : {}}
              />
              {auction.isBlindBidActive ? '🔇 Blind Bid Protocol Active' : 'Center Stage · Live Lot'}
            </span>
            <span className="auction-hero-batch">
              {currentBatch?.name || ''}
            </span>
            {auction.isBlindBidRound && (
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '0.18rem 0.6rem',
                  borderRadius: 999,
                  background: 'rgba(231,76,60,0.14)',
                  border: '1px solid rgba(231,76,60,0.45)',
                  color: '#fca5a5',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                }}
              >
                ⚡ {auction.blindBidRuleLabel || `Blind Bid @ ${Number(auction.blindBidThreshold || 15000).toLocaleString()} pts`} · No Freeze Card
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
                <span>Sealed Bids Locked (&gt; {Number(auction.blindBidThreshold || 15000).toLocaleString()} pts)</span>
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
      ) : (
        <div
          className="auction-hero"
          style={{
            justifyContent: 'center',
            padding: '0.7rem 1.3rem',
            opacity: 0.85,
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            ⚡ Center Stage Ready — Awaiting Host to select the next qualifying team (Base Price: 5,000 pts · Step: 1,000 pts)
          </span>
        </div>
      )}

      {/* ── 4 House Panels / Real-time Leaderboard ── */}
      <div className="house-grid">
        {houses.map((house) => {
          const styles = houseStyles[house.id] || houseStyles.gryffindor;
          const isWinner = Boolean(activeHouse?.id === house.id && currentTeam && !auction.isBlindBidActive);
          const remaining = house.remainingPoints ?? pointLimit;
          const isNegative = remaining < 0;
          const pct = Math.max(0, Math.min(100, (remaining / pointLimit) * 100));
          const maxBid = Number(house.maxBid || 0);
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
              {/* House Flag Background Layer (Low opacity so foreground text pops) */}
              <HouseFlagBackground house={house} opacity={0.08} variant="card" />

              {house.frozen && <FreezeOverlay frozenByHouseName={house.frozenByHouseName} />}

              <div
                className="house-banner"
                style={{
                  position: 'relative',
                  zIndex: 2,
                  borderColor: house.frozen ? 'rgba(147,197,253,0.65)' : styles.accent,
                  textShadow: '0 2px 8px rgba(0,0,0,0.95)',
                }}
              >
                <span
                  className="house-crest"
                  style={{
                    color: house.frozen ? '#93c5fd' : styles.accent,
                    textShadow: `0 0 12px ${styles.accent}88, 0 2px 6px #000`,
                  }}
                >
                  {house.crest}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ color: '#ffffff', fontWeight: 800, letterSpacing: '0.06em' }}>
                    {house.name}
                  </span>
                  {house.captainTeamName && (
                    <span
                      style={{
                        fontSize: '0.64rem',
                        color: '#e5e0d5',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                      }}
                    >
                      Captain: {house.captainTeamName}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.72rem',
                    color: house.frozen ? '#bfdbfe' : '#ffffff',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 800,
                    background: 'rgba(0,0,0,0.45)',
                    padding: '0.18rem 0.45rem',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  {house.acquiredCount || 0}/{house.totalQuota || 11}
                </span>
              </div>

              {/* Purse & Live Max Bid Limit */}
              <div
                className="house-balance"
                style={{
                  position: 'relative',
                  zIndex: 2,
                  textShadow: '0 2px 6px rgba(0,0,0,0.95)',
                }}
              >
                <div className="house-balance-row">
                  <span style={{ color: '#e5e0d5', fontWeight: 600 }}>Remaining Purse</span>
                  <strong
                    style={{
                      color: isNegative
                        ? '#ff5e4d'
                        : house.frozen
                          ? '#bfdbfe'
                          : '#ffffff',
                      fontSize: '0.94rem',
                      fontWeight: 800,
                    }}
                  >
                    {remaining.toLocaleString()} / {pointLimit.toLocaleString()}
                  </strong>
                </div>
                <div className="house-balance-bar">
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
                <div
                  className="house-balance-row"
                  style={{
                    marginTop: '0.25rem',
                    padding: '0.32rem 0.55rem',
                    borderRadius: 6,
                    background: 'rgba(0, 0, 0, 0.52)',
                    border: '1px solid rgba(244,214,109,0.42)',
                  }}
                >
                  <span style={{ fontSize: '0.68rem', color: '#f5f2ea', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Max Active Bid
                  </span>
                  <strong style={{ fontSize: '0.88rem', color: '#ffe27a', fontWeight: 800 }}>
                    {maxBid.toLocaleString()} pts
                  </strong>
                </div>
              </div>

              {/* Slot Counters per Batch (26k: 0/4, 25k: 0/3, 24k: 0/3, 23k: 0/1) */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.32rem',
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
                        background: full ? 'rgba(20,83,45,0.65)' : 'rgba(0,0,0,0.52)',
                        border: `1px solid ${
                          full ? 'rgba(78,203,128,0.65)' : 'rgba(255,255,255,0.22)'
                        }`,
                        borderRadius: 6,
                        padding: '0.24rem 0.25rem',
                        textAlign: 'center',
                        textShadow: '0 1px 4px rgba(0,0,0,0.95)',
                      }}
                    >
                      <div style={{ fontSize: '0.62rem', color: '#e5e0d5', fontWeight: 700 }}>
                        {b.code || b.name.replace(' Batch', '')}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: full ? '#6ee7b7' : '#ffffff',
                        }}
                      >
                        {count}/{quota}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Power Card Inventory (Freeze Card Only) */}
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <PowerCardIcon
                  type="freeze"
                  used={Boolean(house.powerCards?.freeze?.used)}
                  size="xs"
                />
              </div>

              {/* Acquired Teams Roster */}
              <div
                className="house-acquired-list"
                style={{
                  position: 'relative',
                  zIndex: 2,
                  textShadow: '0 2px 6px rgba(0,0,0,0.95)',
                }}
              >
                {houseTxs.length === 0 ? (
                  <span className="empty-tag" style={{ color: '#d6d0c4', fontWeight: 600 }}>
                    No teams drafted yet
                  </span>
                ) : (
                  houseTxs.map((tx) => {
                    const team = teams.find((t) => t.id === tx.teamId);
                    if (!team) return null;
                    const batch = batches.find((b) => b.id === team.batchId);
                    return (
                      <div
                        key={tx.id}
                        className="house-acquired-row"
                        style={{
                          background: 'rgba(0, 0, 0, 0.42)',
                          padding: '0.28rem 0.45rem',
                          borderRadius: 6,
                          marginBottom: '0.2rem',
                        }}
                      >
                        <span className="house-acquired-name" style={{ color: '#ffffff', fontWeight: 700 }}>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              color: '#ffe27a',
                              marginRight: '0.35rem',
                              fontWeight: 700,
                            }}
                          >
                            [{batch?.code || ''}]
                          </span>
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
                            color: house.frozen ? '#bfdbfe' : '#ffe27a',
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

      {/* ── Compact 44-Team Batch Roster ── */}
      {teams.length > 0 && (
        <div className="team-roster">
          {batches.map((batch) => {
            const batchTeams = teams.filter((t) => t.batchId === batch.id);
            if (!batchTeams.length) return null;
            return (
              <div key={batch.id} className="roster-batch">
                <span className="roster-batch-title">
                  {batch.code || batch.name} ({batchTeams.filter((t) => t.status === 'assigned').length}/{batchTeams.length})
                </span>
                <div className="roster-team-grid">
                  {batchTeams.map((team) => {
                    const assignedHouse = team.assignedHouseId
                      ? houses.find((h) => h.id === team.assignedHouseId)
                      : null;
                    const isLive = auction.currentTeamId === team.id;
                    const tx = assignedHouse
                      ? transactions.find((t) => t.teamId === team.id && t.status === 'confirmed')
                      : null;
                    return (
                      <div
                        key={team.id}
                        className={`roster-team-pill ${team.status === 'assigned' ? 'assigned' : ''} ${
                          isLive ? 'live' : ''
                        }`}
                        style={
                          assignedHouse
                            ? {
                                borderColor: assignedHouse.color,
                                background: `${assignedHouse.color}55`,
                                opacity: 1,
                              }
                            : {}
                        }
                        title={
                          team.isBlindBidEligible
                            ? `${team.name} — ${team.blindBidRuleLabel}`
                            : team.name
                        }
                      >
                        <span className="roster-team-name">
                          {team.isBlindBidEligible && !assignedHouse && (
                            <span style={{ color: '#fca5a5', marginRight: '0.2rem' }}>⚡</span>
                          )}
                          {team.name}
                        </span>
                        {assignedHouse && (
                          <span className="roster-team-house" style={{ color: '#fff' }}>
                            {assignedHouse.crest}
                            {tx && (
                              <span
                                style={{
                                  marginLeft: '0.25em',
                                  fontSize: '0.65em',
                                  opacity: 0.85,
                                }}
                              >
                                {(tx.amount / 1000).toFixed(0)}k
                              </span>
                            )}
                          </span>
                        )}
                        {isLive && <span className="roster-live-dot" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Acquisition Animation Overlay ── */}
      {acquisition && animTarget && (
        <AcquisitionAnimation
          teamName={acquisition.teamName}
          houseName={acquisition.houseName}
          houseColor={acquisitionHouse?.color || '#f4d66d'}
          targetX={animTarget.x}
          targetY={animTarget.y}
          onDone={clearAcquisition}
        />
      )}
    </div>
  );
}
