import React, { useState } from 'react';

/**
 * Host-only: list of all 36 teams grouped by batch, showing sold/unsold status.
 * Clicking an unsold team puts it on stage.
 */
export default function TeamList({ teams, currentTeam, onSelectTeam }) {
  const [activeBatch, setActiveBatch] = useState(1);

  const batches = [1, 2, 3];
  const batchTeams = teams.filter(t => t.batch === activeBatch);

  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      background: '#0a0a0a',
      borderRight: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Batch tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a' }}>
        {batches.map(b => (
          <button
            key={b}
            onClick={() => setActiveBatch(b)}
            style={{
              flex: 1,
              background: activeBatch === b ? '#1a1a1a' : 'transparent',
              border: 'none',
              borderBottom: activeBatch === b ? '2px solid #ffd700' : '2px solid transparent',
              color: activeBatch === b ? '#ffd700' : '#555',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 11,
              padding: '10px 4px',
              cursor: 'pointer',
              letterSpacing: 1,
            }}
          >
            BATCH {b}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#555', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
          {batchTeams.filter(t => !t.soldTo).length} remaining
        </span>
        <span style={{ color: '#2ecc71', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
          {batchTeams.filter(t => t.soldTo).length} sold
        </span>
      </div>

      {/* Team list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {batchTeams.map(team => {
          const isCurrent = currentTeam?.id === team.id;
          const isSold = !!team.soldTo;
          return (
            <button
              key={team.id}
              onClick={() => !isSold && onSelectTeam(team.id)}
              disabled={isSold}
              style={{
                width: '100%',
                background: isCurrent ? '#1a1500' : isSold ? '#0d0d0d' : '#111',
                border: `1px solid ${isCurrent ? '#ffd700' : isSold ? '#1a1a1a' : '#222'}`,
                borderRadius: 8,
                padding: '8px 10px',
                marginBottom: 4,
                cursor: isSold ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  color: isSold ? '#444' : isCurrent ? '#ffd700' : '#ccc',
                }}>
                  {team.name}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {team.tier === 1 && (
                    <span style={{
                      fontSize: 9,
                      fontFamily: 'Orbitron, sans-serif',
                      color: isSold ? '#333' : '#ffd700',
                      background: isSold ? '#111' : '#ffd70011',
                      border: `1px solid ${isSold ? '#222' : '#ffd70033'}`,
                      borderRadius: 3,
                      padding: '1px 4px',
                    }}>T1</span>
                  )}
                  {isSold && (
                    <span style={{
                      fontSize: 9,
                      fontFamily: 'Orbitron, sans-serif',
                      color: '#2ecc71',
                      background: '#0a1a0a',
                      border: '1px solid #2ecc7133',
                      borderRadius: 3,
                      padding: '1px 4px',
                    }}>SOLD</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
