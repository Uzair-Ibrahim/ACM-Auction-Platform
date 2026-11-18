import React, { useEffect, useMemo, useRef, useState } from 'react';
import api, { extractErrorMessage } from '../services/api';
import { useAuction } from '../context/AuctionContext';
import Modal from '../components/Modal';
import BlindBidAlert from '../components/BlindBidAlert';
import AcquisitionAnimation from '../components/AcquisitionAnimation';
import PowerCardIcon from '../components/PowerCardIcon';
import HouseFlagBackground from '../components/HouseFlagBackground';

export default function CaptainPortal() {
  const { state, dispatch, refreshState } = useAuction();
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
  } = state;

  const stageCardRef = useRef(null);
  const houseCardRef = useRef(null);

  const pointLimit = settings?.housePointLimit || 150000;
  const basePrice = settings?.basePrice || 5000;
  const bidIncrement = settings?.bidIncrement || 1000;

  const [session, setSession] = useState(() => api.getCaptainSession());
  const [loginUsername, setLoginUsername] = useState('gryffindor');
  const [loginPassword, setLoginPassword] = useState('');
  const [customBid, setCustomBid] = useState('');
  const [blindBidAmount, setBlindBidAmount] = useState('');
  const [mySubmittedBlindBid, setMySubmittedBlindBid] = useState(null);
  const [freezeTargetId, setFreezeTargetId] = useState('');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);

  const myHouse = useMemo(
    () => houses.find((h) => h.id === session.houseId) || null,
    [houses, session.houseId]
  );

  const currentTeam = useMemo(
    () => teams.find((t) => t.id === auction.currentTeamId) || auction.currentTeam || null,
    [teams, auction.currentTeamId, auction.currentTeam]
  );

  const currentBatch = useMemo(
    () => (currentTeam ? batches.find((b) => b.id === currentTeam.batchId) || null : null),
    [batches, currentTeam]
  );

  const leadingHouse = useMemo(
    () => houses.find((h) => h.id === auction.selectedHouseId) || null,
    [houses, auction.selectedHouseId]
  );

  useEffect(() => {
    if (!currentTeam) {
      setCustomBid('');
      setMySubmittedBlindBid(null);
      return;
    }
    const nextMin = auction.currentBid > 0 ? auction.currentBid + bidIncrement : basePrice;
    setCustomBid(String(nextMin));
  }, [auction.currentTeamId, auction.currentBid, basePrice, bidIncrement, currentTeam]);

  useEffect(() => {
    if (session.token && auction.isBlindBidActive) {
      api.captain
        .getMe()
        .then(({ data }) => {
          if (data?.myBlindBid) {
            setMySubmittedBlindBid(data.myBlindBid.amount);
          }
        })
        .catch(() => {});
    } else if (!auction.isBlindBidActive) {
      setMySubmittedBlindBid(null);
    }
  }, [session.token, auction.isBlindBidActive, auction.currentTeamId]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.captain.login(loginUsername.trim(), loginPassword.trim());
      api.setCaptainSession(data.token, data.houseId, data.username);
      setSession({ token: data.token, houseId: data.houseId, username: data.username });
      setLoginPassword('');
      await refreshState();
    } catch (err) {
      setModal({
        type: 'error',
        title: 'House Login Failed',
        message: extractErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    api.setCaptainSession('', '', '');
    setSession({ token: '', houseId: '', username: '' });
  }

  async function handleBid(amountToBid) {
    if (!myHouse || !currentTeam) return;
    const amount = Number(amountToBid);

    if (amount > Number(myHouse.maxBid || 0)) {
      setModal({
        type: 'error',
        title: 'Reserve Law Violation',
        message: `Error: House lacks sufficient reserve points. (Your Max Active Bid Limit is ${Number(myHouse.maxBid || 0).toLocaleString()} pts)`,
      });
      return;
    }

    setLoading(true);
    try {
      await api.captain.placeBid(amount);
      await refreshState();
    } catch (err) {
      if (err.response?.status === 403) {
        handleLogout();
      }
      setModal({
        type: 'error',
        title: 'Bid Rejected',
        message: extractErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleBlindBidSubmit(e) {
    e.preventDefault();
    if (!myHouse || !currentTeam || !blindBidAmount) return;
    const amount = Number(blindBidAmount);

    if (amount > Number(myHouse.maxBid || 0)) {
      setModal({
        type: 'error',
        title: 'Reserve Law Violation',
        message: `Error: House lacks sufficient reserve points. (Your Max Bid Limit is ${Number(myHouse.maxBid || 0).toLocaleString()} pts)`,
      });
      return;
    }

    setLoading(true);
    try {
      await api.captain.submitBlindBid(amount);
      setMySubmittedBlindBid(amount);
      setBlindBidAmount('');
      await refreshState();
      setModal({
        type: 'success',
        title: '🔇 Sealed Blind Bid Locked',
        message: `Your secret bid of ${amount.toLocaleString()} pts for ${currentTeam.name} has been locked with the Host.`,
      });
    } catch (err) {
      setModal({
        type: 'error',
        title: 'Blind Bid Rejected',
        message: extractErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSlapFreeze(e) {
    e.preventDefault();
    if (!freezeTargetId) return;
    const targetHouse = houses.find((h) => h.id === freezeTargetId);
    if (
      !window.confirm(
        `❄ Slap your one-time Freeze Card on ${targetHouse?.name || 'rival house'}? They will be silenced until a different house places a bid!`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      await api.captain.invokeFreeze(freezeTargetId);
      setFreezeTargetId('');
      await refreshState();
      setModal({
        type: 'info',
        title: '❄ Freeze Card Activated!',
        message: `${targetHouse?.name} is now frozen and blocked from bidding until another house bids!`,
      });
    } catch (err) {
      setModal({
        type: 'error',
        title: 'Freeze Rejected',
        message: extractErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Dedicated House Captain Login Screen ──
  if (!session.token || !session.houseId) {
    return (
      <div className="admin-shell" style={{ maxWidth: 480, margin: '2.5rem auto' }}>
        <Modal
          isOpen={Boolean(modal)}
          type={modal?.type}
          title={modal?.title}
          message={modal?.message}
          onClose={() => setModal(null)}
        />
        <section className="admin-card">
          <p className="eyebrow">FAST NUCES Karachi · Coders Cup</p>
          <h1 style={{ fontFamily: 'Cinzel, serif', margin: '0.2rem 0 0.5rem' }}>
            House Captain Sign In
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1.2rem' }}>
            Sign in with your assigned House Captain credentials issued by the Host / TechOps team.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <label>
              House Account
              <select
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              >
                {houses.length > 0 ? (
                  houses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="gryffindor">Gryffindor</option>
                    <option value="slytherin">Slytherin</option>
                    <option value="ravenclaw">Ravenclaw</option>
                    <option value="hufflepuff">Hufflepuff</option>
                  </>
                )}
              </select>
            </label>

            <label>
              House Password
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your secret House password"
                autoComplete="current-password"
                autoFocus
              />
            </label>

            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Authenticating…' : 'Sign In to House Bidding Terminal'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  if (!myHouse) {
    return (
      <div className="admin-shell" style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <section className="admin-card">
          <p className="eyebrow">Connecting to Live Floor…</p>
          <h2 style={{ fontFamily: 'Cinzel, serif' }}>Loading House Terminal…</h2>
        </section>
      </div>
    );
  }

  // ── Live Reserve Law & Next-Team Max Bid Math ──
  const currentPurse = Number(myHouse.remainingPoints ?? pointLimit);
  const remainingSlots = Number(myHouse.remainingOverallSlots ?? 11);
  const currentMaxBid = Number(myHouse.maxBid || 0);
  const currentReservePoints =
    remainingSlots > 0 ? Math.max(0, (remainingSlots - 1) * basePrice) : 0;

  const minNextBid = auction.currentBid > 0 ? auction.currentBid + bidIncrement : basePrice;
  const isLeading = auction.selectedHouseId === myHouse.id && auction.currentBid > 0;
  const isFrozen = Boolean(myHouse.frozen);
  const currentBatchCount = currentTeam ? myHouse.slots?.[currentTeam.batchId] || 0 : 0;
  const currentBatchQuota = currentBatch?.quota || 0;
  const isBatchQuotaFull = currentTeam ? currentBatchCount >= currentBatchQuota : false;
  const isOverallQuotaFull = remainingSlots <= 0;

  // Dynamic Next-Team Max Bid simulation based on the active/typed bid on stage
  const simulatedWinPrice = auction.isBlindBidActive
    ? Number(blindBidAmount || mySubmittedBlindBid || (auction.blindBidThreshold || 15000) + bidIncrement)
    : isLeading
      ? Number(auction.currentBid)
      : Number(customBid || minNextBid);

  const validSimPrice =
    Number.isFinite(simulatedWinPrice) && simulatedWinPrice >= basePrice
      ? simulatedWinPrice
      : basePrice;

  const purseAfterWinningCurrent = currentPurse - validSimPrice;
  const slotsAfterWinningCurrent = Math.max(0, remainingSlots - 1);
  const reserveForNextTeam =
    slotsAfterWinningCurrent > 0
      ? Math.max(0, (slotsAfterWinningCurrent - 1) * basePrice)
      : 0;
  const nextTeamMaxBidIfWin =
    slotsAfterWinningCurrent > 0
      ? Math.max(0, purseAfterWinningCurrent - reserveForNextTeam)
      : 0;

  const canPlaceStandardBid =
    Boolean(currentTeam) &&
    !auction.isBlindBidActive &&
    !isFrozen &&
    !isLeading &&
    !isBatchQuotaFull &&
    !isOverallQuotaFull &&
    minNextBid <= currentMaxBid;

  const myTransactions = transactions.filter(
    (tx) => tx.houseId === myHouse.id && tx.status === 'confirmed'
  );

  return (
    <div className="admin-shell">
      <Modal
        isOpen={Boolean(modal)}
        type={modal?.type}
        title={modal?.title}
        message={modal?.message}
        onClose={() => setModal(null)}
      />
      <BlindBidAlert
        alert={blindBidAlert}
        onClose={() => dispatch({ type: 'CLEAR_BLIND_BID_ALERT' })}
      />

      {/* Dedicated Single-House Header */}
      <header className="admin-header">
        <div>
          <p className="eyebrow">
            Exclusive House Captain Screen · {myHouse.captainTeamName || '23k House Captain'}
          </p>
          <h1 style={{ color: myHouse.color }}>{myHouse.name} Bidding Terminal</h1>
        </div>
        <div className="admin-actions">
          <div className="connection-pill">
            <span className={`dot ${connected ? 'online' : 'offline'}`} />
            {connected ? 'Live Floor Connected' : 'Reconnecting'}
          </div>
          <button className="danger-button" onClick={handleLogout}>
            Logout ({myHouse.name})
          </button>
        </div>
      </header>

      <div className="admin-grid">
        {/* ── 1. Live Center Stage Bidding Console ── */}
        <section ref={stageCardRef} className="admin-card auction-card">
          <h2>Live Bidding Stage</h2>

          {currentTeam ? (
            <div className="auction-control-active">
              <div className="auction-active-team">
                <div>
                  <span className="eyebrow" style={{ fontSize: '0.62rem' }}>
                    Now on Stage
                  </span>
                  <div className="auction-active-name">{currentTeam.name}</div>
                  <div className="auction-active-batch">
                    {currentBatch?.name} · Your Batch Quota: {currentBatchCount}/{currentBatchQuota}
                  </div>
                  {auction.isBlindBidRound && (
                    <div
                      style={{
                        marginTop: '0.35rem',
                        fontSize: '0.7rem',
                        color: '#fca5a5',
                        background: 'rgba(231,76,60,0.14)',
                        border: '1px solid rgba(231,76,60,0.4)',
                        borderRadius: 6,
                        padding: '0.2rem 0.5rem',
                        display: 'inline-block',
                      }}
                    >
                      ⚡ {auction.blindBidRuleLabel} · Freeze Card Disabled
                    </div>
                  )}
                </div>
              </div>

              {/* Current Highest Bid Box */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 10,
                  background: isLeading
                    ? 'rgba(78,203,128,0.16)'
                    : auction.isBlindBidActive
                      ? 'rgba(231,76,60,0.16)'
                      : 'rgba(244,214,109,0.08)',
                  border: isLeading
                    ? '1px solid rgba(78,203,128,0.55)'
                    : auction.isBlindBidActive
                      ? '1px solid rgba(231,76,60,0.5)'
                      : '1px solid rgba(244,214,109,0.28)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {auction.isBlindBidActive ? '🔇 Blind Bid Protocol Active' : 'Current Highest Floor Bid'}
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--gold)', margin: '0.2rem 0' }}>
                  {auction.currentBid > 0
                    ? `${Number(auction.currentBid).toLocaleString()} pts`
                    : `Opening Base Price: ${basePrice.toLocaleString()} pts`}
                </div>
                {leadingHouse && !auction.isBlindBidActive && (
                  <div style={{ fontSize: '0.84rem', color: isLeading ? 'var(--success)' : '#fff', fontWeight: 700 }}>
                    {isLeading ? '★ YOUR HOUSE CURRENTLY LEADS THE BID!' : `Leading House: ${leadingHouse.name}`}
                  </div>
                )}
              </div>

              {/* Status Guards (Frozen / Quota Full) */}
              {isFrozen && (
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: 10,
                    background: 'rgba(30,64,175,0.28)',
                    border: '1px solid rgba(96,165,250,0.6)',
                    color: '#bfdbfe',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                  }}
                >
                  ❄ YOUR HOUSE IS FROZEN BY {(myHouse.frozenByHouseName || 'A RIVAL').toUpperCase()}!
                  <div style={{ fontSize: '0.72rem', fontWeight: 400, marginTop: '0.2rem' }}>
                    You are silenced and blocked from bidding until a different house places a bid.
                  </div>
                </div>
              )}

              {isBatchQuotaFull && (
                <div
                  style={{
                    padding: '0.6rem',
                    borderRadius: 8,
                    background: 'rgba(214,91,77,0.14)',
                    border: '1px solid rgba(214,91,77,0.4)',
                    color: '#fca5a5',
                    fontSize: '0.78rem',
                    textAlign: 'center',
                  }}
                >
                  Your {currentBatch?.name} quota ({currentBatchCount}/{currentBatchQuota}) is already full.
                </div>
              )}

              {/* Open Bidding Controls vs Blind Bid Entry */}
              {!auction.isBlindBidActive ? (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
                      gap: '0.45rem',
                    }}
                  >
                    {[
                      {
                        label:
                          auction.currentBid === 0
                            ? 'Bid 5,000 (Base)'
                            : `+1,000 (${(auction.currentBid + 1000).toLocaleString()})`,
                        amount: auction.currentBid === 0 ? basePrice : auction.currentBid + 1000,
                      },
                      {
                        label: `+2,000 (${((auction.currentBid || basePrice - 1000) + 2000).toLocaleString()})`,
                        amount: (auction.currentBid || basePrice - 1000) + 2000,
                      },
                      {
                        label: `+5,000 (${((auction.currentBid || basePrice - 1000) + 5000).toLocaleString()})`,
                        amount: (auction.currentBid || basePrice - 1000) + 5000,
                      },
                    ].map((btn) => {
                      const exceedsLimit = btn.amount > currentMaxBid;
                      return (
                        <button
                          key={btn.label}
                          type="button"
                          disabled={!canPlaceStandardBid || exceedsLimit || loading}
                          onClick={() => {
                            setCustomBid(String(btn.amount));
                            handleBid(btn.amount);
                          }}
                          className="primary-button"
                          style={{
                            padding: '0.65rem 0.4rem',
                            fontSize: '0.74rem',
                            opacity: !canPlaceStandardBid || exceedsLimit ? 0.4 : 1,
                          }}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleBid(customBid);
                    }}
                    style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
                  >
                    <input
                      type="number"
                      min={minNextBid}
                      step={bidIncrement}
                      value={customBid}
                      onChange={(e) => setCustomBid(e.target.value)}
                      disabled={!canPlaceStandardBid}
                      placeholder={`Custom bid (min ${minNextBid.toLocaleString()})`}
                      style={{ flex: '1 1 160px' }}
                    />
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={!canPlaceStandardBid || loading}
                      style={{ whiteSpace: 'nowrap', fontWeight: 700, flex: '1 1 auto' }}
                    >
                      Place Paddle Bid
                    </button>
                  </form>
                </>
              ) : (
                /* Sealed Blind Bid Entry for Captain */
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: 10,
                    background: 'rgba(231,76,60,0.1)',
                    border: '1px solid rgba(231,76,60,0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ff6b5b' }}>
                    🔇 SUBMIT SECRET SEALED BID (&gt; {Number(auction.blindBidThreshold || 15000).toLocaleString()} PTS)
                  </div>
                  {mySubmittedBlindBid ? (
                    <div
                      style={{
                        padding: '0.6rem',
                        borderRadius: 8,
                        background: 'rgba(78,203,128,0.14)',
                        border: '1px solid rgba(78,203,128,0.4)',
                        color: 'var(--success)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textAlign: 'center',
                      }}
                    >
                      ✓ Sealed Bid Locked: {Number(mySubmittedBlindBid).toLocaleString()} pts
                    </div>
                  ) : null}
                  <form onSubmit={handleBlindBidSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="number"
                      min={Number(auction.blindBidThreshold || 15000) + bidIncrement}
                      step={bidIncrement}
                      value={blindBidAmount}
                      onChange={(e) => setBlindBidAmount(e.target.value)}
                      disabled={isBatchQuotaFull || isOverallQuotaFull}
                      placeholder={`Min ${(Number(auction.blindBidThreshold || 15000) + bidIncrement).toLocaleString()} pts`}
                      style={{ flex: '1 1 160px' }}
                    />
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={isBatchQuotaFull || isOverallQuotaFull || loading}
                      style={{ whiteSpace: 'nowrap', flex: '1 1 auto' }}
                    >
                      {mySubmittedBlindBid ? 'Update Sealed Bid' : 'Lock Sealed Bid'}
                    </button>
                  </form>
                </div>
              )}

              {/* ── Power Arsenal (Quick Draw: Freeze Card Only) ── */}
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  paddingTop: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.08em' }}>
                  ❄ FREEZE CARD (QUICK DRAW — FIRST PRESS WINS)
                </div>

                {/* Freeze Card */}
                <form onSubmit={handleSlapFreeze} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={freezeTargetId}
                    onChange={(e) => setFreezeTargetId(e.target.value)}
                    style={{ flex: '1 1 180px' }}
                    disabled={
                      Boolean(myHouse.powerCards?.freeze?.used) ||
                      isFrozen ||
                      auction.isBlindBidRound ||
                      auction.isBlindBidActive ||
                      Boolean(auction.frozenHouseId)
                    }
                  >
                    <option value="">
                      {myHouse.powerCards?.freeze?.used
                        ? '❄ Freeze Card — ALREADY USED'
                        : isFrozen
                          ? '❄ Cannot use Freeze Card while Frozen'
                          : auction.frozenHouseId
                            ? '❄ Quick Draw Locked — Another freeze is active'
                            : auction.isBlindBidRound
                              ? '❄ Freeze Card — Disabled on Blind-Bid Round'
                              : '— Select Rival House to Freeze —'}
                    </option>
                    {houses
                      .filter((h) => h.id !== myHouse.id)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          Freeze {h.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    disabled={
                      Boolean(myHouse.powerCards?.freeze?.used) ||
                      isFrozen ||
                      auction.isBlindBidRound ||
                      auction.isBlindBidActive ||
                      Boolean(auction.frozenHouseId) ||
                      !freezeTargetId ||
                      loading
                    }
                    style={{
                      whiteSpace: 'nowrap',
                      background: 'rgba(59,130,246,0.22)',
                      borderColor: 'rgba(96,165,250,0.5)',
                      color: '#bfdbfe',
                      fontWeight: 700,
                      opacity:
                        myHouse.powerCards?.freeze?.used ||
                        isFrozen ||
                        Boolean(auction.frozenHouseId) ||
                        auction.isBlindBidRound ||
                        auction.isBlindBidActive ||
                        !freezeTargetId
                          ? 0.4
                          : 1,
                    }}
                  >
                    ❄ Slap Freeze
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <p className="empty-state">
              Waiting for the Host to place the next team on Center Stage…
            </p>
          )}
        </section>

        {/* ── 2. Live Reserve Law Formula & Next-Team Max Bid Calculator ── */}
        <section ref={houseCardRef} className="admin-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <HouseFlagBackground house={myHouse} opacity={0.18} variant="portal" />
          <div style={{ position: 'relative', zIndex: 2, textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}>
            <h2>Reserve Law &amp; Next-Team Limit Calculator</h2>

          {/* Live Formula Box */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: 10,
              background: 'rgba(244,214,109,0.07)',
              border: '1px solid rgba(244,214,109,0.32)',
              marginBottom: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontSize: '0.68rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              📐 Active Reserve Formula (Current Team Limit)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
              max_bid = current_purse - ((remaining_slots - 1) × 5,000)
            </div>
            <div style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>
              {currentPurse.toLocaleString()} - (({remainingSlots} - 1) × 5,000) ={' '}
              <strong style={{ color: 'var(--gold)', fontSize: '1.05rem' }}>
                {currentMaxBid.toLocaleString()} pts
              </strong>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              ({currentReservePoints.toLocaleString()} pts reserved to buy remaining{' '}
              {Math.max(0, remainingSlots - 1)} teams at 5,000 base price)
            </div>
          </div>

          {/* Dynamic Next-Team Max Bid Limit Preview */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: 10,
              background: 'rgba(78,203,128,0.08)',
              border: '1px solid rgba(78,203,128,0.35)',
              marginBottom: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ fontSize: '0.68rem', color: 'var(--success)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              🔮 Next Team Bid Limit Forecast
            </div>
            {remainingSlots > 1 ? (
              <>
                <div style={{ fontSize: '0.76rem', color: 'var(--text)' }}>
                  If you win this team at{' '}
                  <strong style={{ color: 'var(--gold)' }}>
                    {validSimPrice.toLocaleString()} pts
                  </strong>
                  :
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                    gap: '0.45rem',
                    marginTop: '0.2rem',
                  }}
                >
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.28)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ fontSize: '0.63rem', color: 'var(--muted)' }}>
                      Purse Left for Next Team
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>
                      {purseAfterWinningCurrent.toLocaleString()} pts
                    </strong>
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>
                      ({slotsAfterWinningCurrent} slots left · {reserveForNextTeam.toLocaleString()} reserved)
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: 8,
                      background: 'rgba(78,203,128,0.12)',
                      border: '1px solid rgba(78,203,128,0.4)',
                    }}
                  >
                    <div style={{ fontSize: '0.63rem', color: '#a7f3d0' }}>
                      Max Bid on NEXT Team
                    </div>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--success)' }}>
                      {nextTeamMaxBidIfWin.toLocaleString()} pts
                    </strong>
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>
                      {purseAfterWinningCurrent.toLocaleString()} - (({slotsAfterWinningCurrent} - 1) × 5k)
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                  • If you <strong>do not win</strong> this team, your Next Team Max Bid Limit stays at{' '}
                  <strong style={{ color: 'var(--gold)' }}>{currentMaxBid.toLocaleString()} pts</strong>.
                </div>
              </>
            ) : remainingSlots === 1 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--gold)' }}>
                This is your final (11th) team pick! You can spend up to your entire remaining purse ({currentMaxBid.toLocaleString()} pts).
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--success)' }}>
                All 11 mandatory slots for {myHouse.name} are complete!
              </div>
            )}
          </div>

          {/* Purse & Slots Summary */}
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
            Mandatory Batch Quotas ({myHouse.acquiredCount || 0} / 11 Teams Drafted)
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.45rem',
              marginBottom: '0.85rem',
            }}
          >
            {batches.map((b) => {
              const count = myHouse.slots?.[b.id] || 0;
              const quota = b.quota || 0;
              const full = count >= quota;
              return (
                <div
                  key={b.id}
                  style={{
                    padding: '0.45rem 0.3rem',
                    borderRadius: 8,
                    textAlign: 'center',
                    background: full ? 'rgba(78,203,128,0.14)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${
                      full ? 'rgba(78,203,128,0.45)' : 'rgba(255,255,255,0.1)'
                    }`,
                  }}
                >
                  <div style={{ fontSize: '0.66rem', color: 'var(--muted)' }}>{b.code}</div>
                  <strong style={{ fontSize: '0.92rem', color: full ? 'var(--success)' : '#fff' }}>
                    {count}/{quota}
                  </strong>
                </div>
              );
            })}
          </div>

          {/* Power Card Inventory */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <PowerCardIcon
              type="freeze"
              used={Boolean(myHouse.powerCards?.freeze?.used)}
              size="sm"
            />
          </div>

          {/* Drafted Roster */}
          <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
            Your Drafted Teams ({myTransactions.length})
          </div>
          <div className="transaction-list">
            {myTransactions.map((tx) => {
              const team = teams.find((t) => t.id === tx.teamId);
              const batch = batches.find((b) => b.id === team?.batchId);
              return (
                <div key={tx.id} className="transaction-row">
                  <div>
                    <strong>
                      [{batch?.code}] {team?.name || '—'}
                    </strong>
                    <span style={{ color: 'var(--gold)' }}>
                      {Number(tx.amount).toLocaleString()} pts
                      {tx.viaBlindBid ? ' · BLIND' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
            {myTransactions.length === 0 && (
              <p className="empty-state">No teams drafted yet.</p>
            )}
          </div>
          </div>
        </section>
      </div>

      {acquisition && (
        <AcquisitionAnimation
          teamName={acquisition.teamName}
          houseName={acquisition.houseName}
          houseColor={
            houses.find((h) => h.id === acquisition.houseId)?.color || '#f4d66d'
          }
          amount={acquisition.amount}
          startX={
            stageCardRef.current
              ? stageCardRef.current.getBoundingClientRect().left +
                stageCardRef.current.getBoundingClientRect().width / 2
              : window.innerWidth * 0.28
          }
          startY={
            stageCardRef.current
              ? stageCardRef.current.getBoundingClientRect().top + 140
              : window.innerHeight * 0.35
          }
          targetX={
            houseCardRef.current
              ? houseCardRef.current.getBoundingClientRect().left +
                houseCardRef.current.getBoundingClientRect().width / 2
              : window.innerWidth * 0.72
          }
          targetY={
            houseCardRef.current
              ? houseCardRef.current.getBoundingClientRect().top +
                houseCardRef.current.getBoundingClientRect().height / 2
              : window.innerHeight * 0.5
          }
          onDone={() => dispatch({ type: 'CLEAR_ACQUISITION' })}
        />
      )}
    </div>
  );
}
