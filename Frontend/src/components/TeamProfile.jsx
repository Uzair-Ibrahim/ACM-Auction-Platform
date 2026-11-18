import React from 'react';

/**
 * Center-stage display: current team on the board.
 * PDF: "Center Stage: Displays the current Team Profile (Name, Batch, and Tier designation: Top vs Standard)."
 */
export default function TeamProfile({ team, currentHighestBid, currentHighestBidder, houses, isBlindBid }) {
  const topBidderHouse = houses?.find(h => h.id === currentHighestBidder);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 32px',
      textAlign: 'center',
    }}>
      {!team ? (
        <div style={{ color: '#555' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏆</div>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, color: '#444' }}>
            AWAITING NEXT TEAM
          </p>
          <p style={{ color: '#333', marginTop: 8, fontSize: 14 }}>Host: select a team to begin bidding</p>
        </div>
      ) : (
        <>
          {/* Tier badge */}
          <div style={{
            display: 'inline-block',
            background: team.tier === 1 ? '#ffd70022' : '#ffffff11',
            border: `1px solid ${team.tier === 1 ? '#ffd700' : '#888'}`,
            borderRadius: 20,
            padding: '4px 20px',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 12,
            color: team.tier === 1 ? '#ffd700' : '#aaa',
            letterSpacing: 3,
            marginBottom: 20,
          }}>
            {team.tier === 1 ? '★ TOP TEAM — TIER 1' : 'STANDARD TEAM — TIER 2'}
          </div>

          {/* Team name */}
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(28px, 5vw, 60px)',
            fontWeight: 900,
            color: '#fff',
            margin: '0 0 12px',
            textShadow: team.tier === 1 ? '0 0 30px #ffd70088' : '0 0 20px #ffffff44',
            lineHeight: 1.1,
          }}>
            {team.name}
          </h1>

          {/* Batch indicator */}
          <div style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 16,
            color: '#888',
            marginBottom: 32,
            letterSpacing: 2,
          }}>
            BATCH {team.batch} — TEAM #{team.id}
          </div>

          {/* Current bid display */}
          <div style={{
            background: isBlindBid ? '#1a0a0033' : '#ffffff0a',
            border: `2px solid ${isBlindBid ? '#e74c3c' : '#ffd70044'}`,
            borderRadius: 16,
            padding: '24px 48px',
            minWidth: 320,
          }}>
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              color: '#888',
              letterSpacing: 3,
              marginBottom: 8,
            }}>
              {isBlindBid ? '🔇 BLIND BID MODE' : 'CURRENT HIGHEST BID'}
            </div>
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 900,
              color: isBlindBid ? '#e74c3c' : '#ffd700',
              textShadow: `0 0 20px ${isBlindBid ? '#e74c3c' : '#ffd700'}88`,
            }}>
              {currentHighestBid > 0 ? `${currentHighestBid.toLocaleString()} pts` : 'OPEN'}
            </div>
            {topBidderHouse && !isBlindBid && (
              <div style={{ color: '#aaa', fontSize: 14, marginTop: 8, fontFamily: 'Inter, sans-serif' }}>
                by {topBidderHouse.name}
              </div>
            )}
            {isBlindBid && (
              <div style={{ color: '#e74c3c', fontSize: 13, marginTop: 8, fontFamily: 'Inter, sans-serif' }}>
                Submit sealed bids — must exceed 15,000 pts
              </div>
            )}
          </div>

          {/* Tier 1 warning */}
          {team.tier === 1 && !isBlindBid && currentHighestBid > 0 && (
            <div style={{
              marginTop: 16,
              color: '#ffd700',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
            }}>
              ⚡ Bid reaches 15,000 → Blind Bid Protocol triggers
            </div>
          )}
        </>
      )}
    </div>
  );
}
