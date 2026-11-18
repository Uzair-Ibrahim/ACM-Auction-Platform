import React from 'react';
import PowerCardIcon from './PowerCardIcon';

const TOTAL_PURSE = 100000;
const HOUSE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

/**
 * Right-panel leaderboard card for a single house.
 * PDF: "Remaining Purse, Slot Counter per Batch, Live Active Maximum Bid Limit,
 *       Power Card Inventory (Icons that grey out when marked 'USED')."
 */
export default function HouseCard({ house, isCurrentBidder, isFrozen }) {
  const colorIdx = (house.id - 1) % HOUSE_COLORS.length;
  const houseColor = HOUSE_COLORS[colorIdx];
  const pursePercent = Math.max(0, (house.purse / TOTAL_PURSE) * 100);
  const teamsAcquired = house.teams?.length || 0;

  return (
    <div style={{
      background: '#0d0d0d',
      border: `1.5px solid ${isCurrentBidder ? houseColor : isFrozen ? '#3498db55' : '#222'}`,
      borderRadius: 12,
      padding: '14px 16px',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      boxShadow: isCurrentBidder ? `0 0 20px ${houseColor}44` : isFrozen ? '0 0 10px #3498db33' : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Frozen overlay */}
      {isFrozen && (
        <div style={{
          position: 'absolute', top: 6, right: 10,
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 10,
          color: '#3498db',
          background: '#3498db22',
          border: '1px solid #3498db',
          borderRadius: 4,
          padding: '2px 6px',
          letterSpacing: 1,
        }}>
          ❄ FROZEN {house.frozenTurns > 0 ? `(${house.frozenTurns})` : ''}
        </div>
      )}

      {/* House name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: houseColor,
          boxShadow: `0 0 8px ${houseColor}`,
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          color: isCurrentBidder ? houseColor : '#fff',
        }}>
          {house.name}
        </span>
        {isCurrentBidder && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontFamily: 'Orbitron, sans-serif',
            color: houseColor,
            background: `${houseColor}22`,
            border: `1px solid ${houseColor}`,
            borderRadius: 4,
            padding: '2px 6px',
          }}>
            LEADING
          </span>
        )}
      </div>

      {/* Purse bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#888', fontSize: 10, fontFamily: 'Inter, sans-serif', letterSpacing: 1 }}>
            PURSE
          </span>
          <span style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 13,
            color: house.purse < 20000 ? '#e74c3c' : house.purse < 40000 ? '#f39c12' : '#2ecc71',
            fontWeight: 700,
          }}>
            {house.purse.toLocaleString()} / {TOTAL_PURSE.toLocaleString()}
          </span>
        </div>
        <div style={{ background: '#222', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pursePercent}%`,
            background: house.purse < 20000 ? '#e74c3c' : house.purse < 40000 ? '#f39c12' : houseColor,
            borderRadius: 4,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Max bid limit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: '#888', fontSize: 10, fontFamily: 'Inter, sans-serif', letterSpacing: 1 }}>
          MAX BID
        </span>
        <span style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 13,
          color: '#ffd700',
          fontWeight: 700,
        }}>
          {(house.maxBid || 0).toLocaleString()} pts
        </span>
      </div>

      {/* Slot counters per batch */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[1, 2, 3].map(batch => (
          <div key={batch} style={{
            flex: 1,
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 6,
            padding: '5px 4px',
            textAlign: 'center',
          }}>
            <div style={{ color: '#555', fontSize: 9, fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>
              B{batch}
            </div>
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 12,
              color: (house.slots?.[batch] || 0) >= 3 ? '#2ecc71' : '#fff',
              fontWeight: 700,
            }}>
              {house.slots?.[batch] || 0}/3
            </div>
          </div>
        ))}
      </div>

      {/* Power cards */}
      <div style={{ display: 'flex', gap: 6 }}>
        <PowerCardIcon type="freeze" used={house.powerCards?.freeze?.used} size="sm" />
        <PowerCardIcon type="rtm"    used={house.powerCards?.rtm?.used}    size="sm" />
      </div>

      {/* Teams count */}
      <div style={{ marginTop: 8, color: '#555', fontSize: 10, fontFamily: 'Inter, sans-serif', textAlign: 'right' }}>
        {teamsAcquired}/9 teams
      </div>
    </div>
  );
}
