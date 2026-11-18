import React, { useState } from 'react';
import api from '../services/api';
import Modal from './Modal';

/**
 * Host input form for submitting paddle bids.
 * Also handles Freeze Card, RTM invocation, and Blind Bid entry.
 */
export default function BidForm({ houses, auction }) {
  const [selectedHouse, setSelectedHouse] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [blindHouse, setBlindHouse] = useState('');
  const [blindAmount, setBlindAmount] = useState('');
  const [freezeHouse, setFreezeHouse] = useState('');
  const [freezeTarget, setFreezeTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // { type, title, message }

  if (!auction.isActive || !auction.currentTeam) {
    return (
      <div style={{ color: '#444', textAlign: 'center', padding: 32, fontFamily: 'Inter, sans-serif' }}>
        No team on stage. Select a team from the list.
      </div>
    );
  }

  const { currentTeam, isBlindBid, currentHighestBid } = auction;
  const minBid = Math.max(5000, currentHighestBid + 1);

  async function handleBid(e) {
    e.preventDefault();
    if (!selectedHouse || !bidAmount) return;
    setLoading(true);
    try {
      const res = await api.placeBid(Number(selectedHouse), Number(bidAmount));
      setBidAmount('');
      if (res.data.blindBidTriggered) {
        setModal({ type: 'info', title: 'Blind Bid Triggered', message: 'BLIND BID PROTOCOL INITIATED — Bid reached 15,000 pts.' });
      }
    } catch (err) {
      setModal({ type: 'error', title: 'Bid Rejected', message: err.response?.data?.error || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleBlindBid(e) {
    e.preventDefault();
    if (!blindHouse || !blindAmount) return;
    setLoading(true);
    try {
      await api.placeBlindBid(Number(blindHouse), Number(blindAmount));
      setBlindAmount('');
      setModal({ type: 'success', title: 'Blind Bid Recorded', message: `Blind bid of ${Number(blindAmount).toLocaleString()} pts recorded.` });
    } catch (err) {
      setModal({ type: 'error', title: 'Blind Bid Rejected', message: err.response?.data?.error || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmSold() {
    setLoading(true);
    try {
      await api.confirmSold();
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.response?.data?.error || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmBlindBid(houseId) {
    setLoading(true);
    try {
      await api.confirmBlindBid(houseId);
    } catch (err) {
      setModal({ type: 'error', title: 'Error', message: err.response?.data?.error || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRTM(houseId) {
    setLoading(true);
    try {
      await api.invokeRTM(houseId);
    } catch (err) {
      setModal({ type: 'error', title: 'RTM Rejected', message: err.response?.data?.error || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleFreeze(e) {
    e.preventDefault();
    if (!freezeHouse || !freezeTarget) return;
    setLoading(true);
    try {
      await api.invokeFreeze(Number(freezeHouse), Number(freezeTarget));
      setModal({ type: 'success', title: 'Freeze Applied', message: `Freeze card activated. Target house is frozen for 2 turns.` });
    } catch (err) {
      setModal({ type: 'error', title: 'Freeze Rejected', message: err.response?.data?.error || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  const selectStyle = {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#ccc',
    padding: '8px 10px',
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    flex: 1,
    outline: 'none',
  };
  const inputStyle = { ...selectStyle };
  const btnPrimary = {
    background: '#ffd700',
    color: '#000',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 12,
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    letterSpacing: 1,
  };
  const btnDanger = { ...btnPrimary, background: '#e74c3c', color: '#fff' };
  const btnSuccess = { ...btnPrimary, background: '#2ecc71', color: '#000' };
  const sectionTitle = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 11,
    color: '#555',
    letterSpacing: 2,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1px solid #1a1a1a',
  };

  return (
    <div style={{ padding: '0 20px 20px', overflowY: 'auto', flex: 1 }}>
      <Modal
        isOpen={!!modal}
        type={modal?.type}
        title={modal?.title}
        message={modal?.message}
        onClose={() => setModal(null)}
      />

      {/* ── Open Bidding Section ───────────────────────────────────── */}
      {!isBlindBid && (
        <section style={{ marginBottom: 24 }}>
          <div style={sectionTitle}>PADDLE BID ENTRY</div>
          <form onSubmit={handleBid} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={selectedHouse} onChange={e => setSelectedHouse(e.target.value)} style={selectStyle}>
              <option value="">— Select House —</option>
              {houses.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} · Max: {(h.maxBid||0).toLocaleString()} pts
                  {h.frozenTurns > 0 ? ' ❄ FROZEN' : ''}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={minBid}
              step={500}
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
              placeholder={`Bid amount (min ${minBid.toLocaleString()})`}
              style={inputStyle}
            />
            <button type="submit" style={btnPrimary} disabled={loading}>
              SUBMIT BID
            </button>
          </form>
        </section>
      )}

      {/* ── Blind Bid Section ─────────────────────────────────────── */}
      {isBlindBid && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ ...sectionTitle, color: '#e74c3c' }}>🔇 BLIND BID ENTRY</div>
          <form onSubmit={handleBlindBid} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={blindHouse} onChange={e => setBlindHouse(e.target.value)} style={selectStyle}>
              <option value="">— Select House —</option>
              {houses.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} · Max: {(h.maxBid||0).toLocaleString()} pts
                  {auction.blindBids?.[h.id] ? ' ✓ BID SUBMITTED' : ''}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={15001}
              step={500}
              value={blindAmount}
              onChange={e => setBlindAmount(e.target.value)}
              placeholder="Sealed bid (must exceed 15,000)"
              style={{ ...inputStyle, border: '1px solid #e74c3c55' }}
            />
            <button type="submit" style={btnDanger} disabled={loading}>
              RECORD BLIND BID
            </button>
          </form>

          {/* Confirm Blind Bid Win */}
          <div style={{ marginTop: 16 }}>
            <div style={{ ...sectionTitle, marginTop: 8 }}>REVEAL WINNER</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {houses.filter(h => auction.blindBids?.[h.id]).map(h => (
                <button
                  key={h.id}
                  onClick={() => handleConfirmBlindBid(h.id)}
                  disabled={loading}
                  style={{ ...btnSuccess, textAlign: 'left', fontSize: 11 }}
                >
                  ✓ CONFIRM: {h.name} — {auction.blindBids[h.id]?.toLocaleString()} pts
                </button>
              ))}
              {!Object.keys(auction.blindBids || {}).length && (
                <p style={{ color: '#444', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
                  No blind bids recorded yet.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Confirm Sold ─────────────────────────────────────────── */}
      {!isBlindBid && auction.currentHighestBidder !== null && (
        <section style={{ marginBottom: 24 }}>
          <div style={sectionTitle}>CLOSE BIDDING</div>
          <button onClick={handleConfirmSold} style={btnSuccess} disabled={loading}>
            🔨 CONFIRM SOLD
          </button>
        </section>
      )}

      {/* ── Power Cards (Standard teams only) ────────────────────── */}
      {currentTeam.tier === 2 && (
        <>
          {/* RTM Buttons — one per house */}
          <section style={{ marginBottom: 24 }}>
            <div style={sectionTitle}>RTM — RIGHT TO MATCH</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {houses.map(h => (
                <button
                  key={h.id}
                  onClick={() => handleRTM(h.id)}
                  disabled={loading || h.powerCards?.rtm?.used || h.id === auction.currentHighestBidder}
                  style={{
                    ...btnPrimary,
                    background: h.powerCards?.rtm?.used ? '#222' : '#f39c12',
                    color: h.powerCards?.rtm?.used ? '#444' : '#000',
                    opacity: (h.powerCards?.rtm?.used || h.id === auction.currentHighestBidder) ? 0.4 : 1,
                    fontSize: 11,
                    textAlign: 'left',
                  }}
                >
                  ⚡ RTM: {h.name}
                  {h.powerCards?.rtm?.used ? ' (USED)' : ''}
                  {h.id === auction.currentHighestBidder ? ' (LEADING — CANNOT RTM)' : ''}
                </button>
              ))}
            </div>
          </section>

          {/* Freeze Card */}
          <section style={{ marginBottom: 24 }}>
            <div style={sectionTitle}>❄ FREEZE CARD</div>
            <form onSubmit={handleFreeze} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select value={freezeHouse} onChange={e => setFreezeHouse(e.target.value)} style={selectStyle}>
                <option value="">— House playing Freeze —</option>
                {houses.filter(h => !h.powerCards?.freeze?.used).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <select value={freezeTarget} onChange={e => setFreezeTarget(e.target.value)} style={selectStyle}>
                <option value="">— Target House to freeze —</option>
                {houses.filter(h => String(h.id) !== String(freezeHouse)).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <button type="submit" style={{ ...btnPrimary, background: '#3498db', color: '#fff' }} disabled={loading}>
                ACTIVATE FREEZE
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
