import React from 'react';
import HouseCard from './HouseCard';

/**
 * Right Panel Leaderboard — real-time updates for all 4 houses.
 * PDF: "Right Panel Leaderboard (Real-time updates): Remaining Purse,
 *       Slot Counter per Batch, Live Active Maximum Bid Limit, Power Card Inventory."
 */
export default function Leaderboard({ houses, currentHighestBidder }) {
  if (!houses || houses.length === 0) {
    return (
      <div style={{ padding: 24, color: '#444', fontFamily: 'Orbitron, sans-serif', fontSize: 13 }}>
        Loading houses…
      </div>
    );
  }

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      background: '#080808',
      borderLeft: '1px solid #1a1a1a',
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflowY: 'auto',
    }}>
      <div style={{
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 11,
        color: '#555',
        letterSpacing: 3,
        marginBottom: 6,
        textAlign: 'center',
      }}>
        LIVE LEADERBOARD
      </div>

      {houses.map(house => (
        <HouseCard
          key={house.id}
          house={house}
          isCurrentBidder={house.id === currentHighestBidder}
          isFrozen={house.frozenTurns > 0}
        />
      ))}

      {/* Teams sold progress */}
      <div style={{
        marginTop: 8,
        background: '#0d0d0d',
        border: '1px solid #1a1a1a',
        borderRadius: 8,
        padding: 12,
        textAlign: 'center',
      }}>
        <div style={{ color: '#555', fontSize: 10, letterSpacing: 2, fontFamily: 'Inter, sans-serif', marginBottom: 6 }}>
          TEAMS SOLD
        </div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, color: '#ffd700', fontWeight: 700 }}>
          {houses.reduce((acc, h) => acc + (h.teams?.length || 0), 0)}
          <span style={{ color: '#444', fontSize: 14 }}> / 36</span>
        </div>
      </div>
    </div>
  );
}
