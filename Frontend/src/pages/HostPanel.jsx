import React, { useEffect, useMemo, useState } from 'react';
import api, { extractErrorMessage } from '../services/api';
import { useAuction } from '../context/AuctionContext';
import Modal from '../components/Modal';
import BlindBidAlert from '../components/BlindBidAlert';
import PowerCardIcon from '../components/PowerCardIcon';

export default function HostPanel() {
  const { state, dispatch, refreshState } = useAuction();
  const {
    settings,
    houses,
    batches,
    teams,
    transactions,
    history,
    auction,
    connected,
    blindBidAlert,
  } = state;

  const pointLimit = settings?.housePointLimit || 150000;
  const basePrice = settings?.basePrice || 5000;
  const bidIncrement = settings?.bidIncrement || 1000;

  // Admin authentication state
  const [adminSession, setAdminSession] = useState(() => api.getAdminSession());
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Admin state with revealed blind bids & house PINs
  const [adminBlindBids, setAdminBlindBids] = useState({});
  const [adminHouses, setAdminHouses] = useState([]);

  // Paddle bid state
  const [selectedHouseId, setSelectedHouseId] = useState('');
  const [bidAmount, setBidAmount] = useState('');

  // Freeze card state
  const [freezeSourceId, setFreezeSourceId] = useState('');
  const [freezeTargetId, setFreezeTargetId] = useState('');

  // Blind bid state
  const [blindHouseId, setBlindHouseId] = useState('');
  const [blindAmount, setBlindAmount] = useState('');

  // Team management state
  const [teamName, setTeamName] = useState('');
  const [teamBatchId, setTeamBatchId] = useState('batch-26k');
  const [teamIsFirst, setTeamIsFirst] = useState(false);
  const [batchFilter, setBatchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingTeamBatchId, setEditingTeamBatchId] = useState('');
  const [editingTeamIsFirst, setEditingTeamIsFirst] = useState(false);

  // Bulk import & House config
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('batch-26k');
  const [editingHouseId, setEditingHouseId] = useState(null);
  const [houseForm, setHouseForm] = useState({
    name: '',
    username: '',
    captainTeamName: '',
    newPassword: '',
  });
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newPointLimit, setNewPointLimit] = useState('');

  // Modal & notice
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');

  const currentTeam = useMemo(
    () => teams.find((t) => t.id === auction.currentTeamId) || null,
    [teams, auction.currentTeamId]
  );
  const currentBatch = useMemo(
    () => (currentTeam ? batches.find((b) => b.id === currentTeam.batchId) || null : null),
    [batches, currentTeam]
  );

  const selectedHouse = houses.find((h) => h.id === selectedHouseId) || null;
  const minNextBid =
    auction.currentBid > 0 ? auction.currentBid + bidIncrement : basePrice;

  // Fetch admin-only state (reveals sealed blind bid amounts & captain PINs)
  async function fetchAdminDetails() {
    if (!api.getAdminSession().key) return;
    try {
      const { data } = await api.admin.getState();
      setAdminBlindBids(data.auction?.blindBids || {});
      setAdminHouses(data.houses || []);
    } catch (err) {
      if (err?.response?.status === 403) {
        api.setAdminSession('', '');
        setAdminSession({ key: '', username: '' });
      }
    }
  }

  useEffect(() => {
    if (adminSession.key) {
      fetchAdminDetails();
    }
  }, [adminSession.key, auction.currentTeamId, auction.blindBidCount, auction.isBlindBidActive, houses.length]);

  useEffect(() => {
    if (!teamBatchId && batches[0]) setTeamBatchId(batches[0].id);
  }, [batches, teamBatchId]);

  useEffect(() => {
    if (!selectedHouseId && houses.length) {
      setSelectedHouseId(houses[0].id);
    }
  }, [houses, selectedHouseId]);

  // Pre-fill next valid bid whenever currentBid or currentTeam changes
  useEffect(() => {
    if (!currentTeam) {
      setBidAmount('');
      return;
    }
    const nextMin = auction.currentBid > 0 ? auction.currentBid + bidIncrement : basePrice;
    setBidAmount(String(nextMin));
  }, [auction.currentTeamId, auction.currentBid, basePrice, bidIncrement, currentTeam]);

  async function handleAdminLogin(e) {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword.trim()) return;
    setAuthLoading(true);
    try {
      const { data } = await api.admin.login(adminUsername.trim(), adminPassword.trim());
      const key = data.adminKey || adminPassword.trim();
      api.setAdminSession(key, data.username || adminUsername.trim());
      setAdminSession({ key, username: data.username || adminUsername.trim() });
      setAdminPassword('');
      await refreshState();
      await fetchAdminDetails();
    } catch (err) {
      setModal({
        type: 'error',
        title: 'Admin Login Failed',
        message: extractErrorMessage(err),
      });
    } finally {
      setAuthLoading(false);
    }
  }

  function handleAdminLogout() {
    api.setAdminSession('', '');
    setAdminSession({ key: '', username: '' });
  }

  async function runAction(action, onSuccess) {
    try {
      const res = await action();
      setNotice('');
      if (onSuccess) onSuccess(res?.data);
      await refreshState();
      await fetchAdminDetails();
    } catch (err) {
      if (err?.response?.status === 403) {
        handleAdminLogout();
      }
      const msg = extractErrorMessage(err);
      const code = err.response?.data?.code;
      const maxBid = err.response?.data?.maxBid;
      if (code === 'RESERVE_LIMIT_EXCEEDED' || msg.includes('sufficient reserve points')) {
        setModal({
          type: 'error',
          title: 'Reserve Law Violation',
          message:
            maxBid !== undefined
              ? `Error: House lacks sufficient reserve points. (Maximum allowed bid for this house is ${Number(maxBid).toLocaleString()} pts)`
              : 'Error: House lacks sufficient reserve points.',
        });
      } else {
        setModal({
          type: 'error',
          title: 'Action Rejected',
          message: msg,
        });
      }
    }
  }

  // ── Paddle Bid & Sold Handlers ───────────────────────────────────

  async function handlePlaceBid(e, customAmount, customHouseId) {
    if (e) e.preventDefault();
    const targetHouse = customHouseId || selectedHouseId;
    const amount = Number(customAmount !== undefined ? customAmount : bidAmount);
    if (!currentTeam) {
      setModal({ type: 'error', title: 'No Active Lot', message: 'Select a team to put on stage first.' });
      return;
    }
    if (!targetHouse) {
      setModal({ type: 'error', title: 'Select House', message: 'Select a house for this paddle bid.' });
      return;
    }

    // Frontend Reserve Law pre-check with official error message
    const houseObj = houses.find((h) => h.id === targetHouse);
    if (houseObj && amount > Number(houseObj.maxBid || 0)) {
      setModal({
        type: 'error',
        title: 'Reserve Law Violation',
        message: `Error: House lacks sufficient reserve points. (${houseObj.name}'s Max Active Bid Limit is ${Number(houseObj.maxBid || 0).toLocaleString()} pts)`,
      });
      return;
    }

    await runAction(
      () => api.admin.placeBid(targetHouse, amount),
      (data) => {
        if (data?.unfrozenHouseName) {
          setNotice(`❄ ${data.unfrozenHouseName} is now UNFROZEN after third-party bid!`);
        }
      }
    );
  }

  async function handleUndoLastBid() {
    await runAction(() => api.admin.undoLastBid());
  }

  async function handleConfirmSold() {
    if (!currentTeam) return;
    const winningHouseId = auction.selectedHouseId || selectedHouseId;
    const amount = Number(auction.currentBid || bidAmount || 0);
    if (!winningHouseId || amount < basePrice) {
      setModal({
        type: 'error',
        title: 'Cannot Confirm Sold',
        message: `A valid winning House and a bid of at least ${basePrice.toLocaleString()} pts are required.`,
      });
      return;
    }
    await runAction(() => api.admin.confirmAuction(winningHouseId, amount));
  }

  // ── Freeze Card Handler ──────────────────────────────────────────

  async function handleInvokeFreeze(e) {
    e.preventDefault();
    if (!freezeSourceId || !freezeTargetId) {
      setModal({
        type: 'error',
        title: 'Freeze Card',
        message: 'Select both the House playing the Freeze Card and the Target House to freeze.',
      });
      return;
    }
    await runAction(
      () => api.admin.invokeFreeze(freezeSourceId, freezeTargetId),
      () => {
        const src = houses.find((h) => h.id === freezeSourceId)?.name;
        const tgt = houses.find((h) => h.id === freezeTargetId)?.name;
        setFreezeSourceId('');
        setFreezeTargetId('');
        setModal({
          type: 'info',
          title: '❄ Freeze Card Activated',
          message: `${src} froze ${tgt}! ${tgt} is silenced and blocked from bidding until a different house places a bid.`,
        });
      }
    );
  }

  // ── Blind Bid Handlers ───────────────────────────────────────────

  async function handleTriggerBlindBid() {
    if (!currentTeam) return;
    const defaultThreshold =
      auction.blindBidThreshold || (currentTeam.batchId === 'batch-23k' ? 10000 : 15000);
    await runAction(() => api.admin.triggerBlindBid(defaultThreshold));
  }

  async function handleRecordBlindBid(e) {
    e.preventDefault();
    if (!blindHouseId || !blindAmount) return;
    const amount = Number(blindAmount);
    const houseObj = houses.find((h) => h.id === blindHouseId);
    if (houseObj && amount > Number(houseObj.maxBid || 0)) {
      setModal({
        type: 'error',
        title: 'Reserve Law Violation',
        message: `Error: House lacks sufficient reserve points. (${houseObj.name}'s Max Bid Limit is ${Number(houseObj.maxBid || 0).toLocaleString()} pts)`,
      });
      return;
    }
    await runAction(
      () => api.admin.submitBlindBid(blindHouseId, amount),
      () => {
        setBlindAmount('');
        setNotice(`🔇 Sealed blind bid recorded for ${houseObj?.name || blindHouseId}.`);
      }
    );
  }

  async function handleResolveBlindBid(explicitHouseId, explicitAmount) {
    await runAction(() => api.admin.resolveBlindBid(explicitHouseId, explicitAmount));
  }

  // ── Team & Settings Handlers ─────────────────────────────────────

  async function handleCreateTeam() {
    if (!teamName.trim()) {
      setNotice('Team name is required.');
      return;
    }
    await runAction(
      () =>
        api.admin.createTeam({
          name: teamName.trim(),
          batchId: teamBatchId,
          isFirstTeam: teamIsFirst,
        }),
      () => {
        setTeamName('');
        setTeamIsFirst(false);
      }
    );
  }

  async function handleEditTeam(id) {
    if (!editingTeamName.trim()) {
      setNotice('Team name is required.');
      return;
    }
    await runAction(
      () =>
        api.admin.updateTeam(id, {
          name: editingTeamName.trim(),
          batchId: editingTeamBatchId,
          isFirstTeam: editingTeamIsFirst,
        }),
      () => {
        setEditingTeamId(null);
      }
    );
  }

  async function handleBulkImport() {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const payload = lines.map((name) => ({ name, batchId: bulkBatchId }));
    await runAction(
      () => api.admin.bulkImportTeams(payload, false),
      () => {
        setBulkText('');
        setShowBulkModal(false);
      }
    );
  }

  async function handleSaveHouseConfig(houseId) {
    await runAction(
      () => api.admin.updateHouseConfig(houseId, houseForm),
      () => setEditingHouseId(null)
    );
  }

  const lastConfirmedTeamId = useMemo(() => {
    const confirmed = transactions.filter((tx) => tx.status === 'confirmed');
    if (!confirmed.length) return null;
    const latest = confirmed.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    return latest.teamId;
  }, [transactions]);

  const filteredTeams = teams.filter((team) => {
    if (batchFilter !== 'all' && team.batchId !== batchFilter) return false;
    if (statusFilter === 'unsold' && team.status === 'assigned') return false;
    if (statusFilter === 'sold' && team.status !== 'assigned') return false;
    return true;
  });

  const leadingHouse = houses.find((h) => h.id === auction.selectedHouseId) || null;
  const frozenHouse = houses.find((h) => h.id === auction.frozenHouseId) || null;
  const frozenByHouse = houses.find((h) => h.id === auction.frozenByHouseId) || null;

  // ── Dedicated Admin Authentication Gate ──
  if (!adminSession.key) {
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
          <p className="eyebrow">TechOps Host Console · Coders Cup</p>
          <h1 style={{ fontFamily: 'Cinzel, serif', margin: '0.2rem 0 0.5rem' }}>
            Admin / Host Sign In
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1.2rem' }}>
            Enter Admin credentials to access the Auction Control Panel, manage teams, and control Center Stage.
          </p>

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <label>
              Admin Username
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="admin"
              />
            </label>
            <label>
              Admin Password
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter Admin Password"
                autoFocus
              />
            </label>
            <button type="submit" className="primary-button" disabled={authLoading}>
              {authLoading ? 'Authenticating…' : 'Sign In to Host Console'}
            </button>
          </form>
        </section>
      </div>
    );
  }

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

      <header className="admin-header">
        <div>
          <p className="eyebrow">TechOps Host Console · Coders Cup</p>
          <h1>Auction Control Panel</h1>
        </div>
        <div className="admin-actions">
          <div className="connection-pill">
            <span className={`dot ${connected ? 'online' : 'offline'}`} />
            {connected ? 'Connected' : 'Offline'}
          </div>
          <button
            className="ghost-button"
            onClick={() => {
              if (
                window.confirm(
                  'Reset auction & re-seed the default 44 Coders Cup teams (One piece, Cook If you can, Three Muggles, 23k)?'
                )
              ) {
                runAction(() => api.admin.reset(true));
              }
            }}
          >
            Seed Default 44 Teams
          </button>
          <button
            className="danger-button"
            onClick={() => {
              if (
                window.confirm(
                  'Reset auction? Teams will be kept, but all sales, purse deductions, and used power cards will be reset.'
                )
              ) {
                runAction(() => api.admin.reset(false));
              }
            }}
          >
            Reset Auction
          </button>
          <button className="ghost-button" onClick={handleAdminLogout}>
            Logout Admin
          </button>
        </div>
      </header>

      {notice && (
        <div className="admin-notice" onClick={() => setNotice('')}>
          {notice} ✕
        </div>
      )}

      <div className="admin-grid">
        {/* ── 1. Center Stage & Paddle Bidding Control ── */}
        <section className="admin-card auction-card">
          <h2>Center Stage & Paddle Control</h2>
          {currentTeam ? (
            <div className="auction-control-active">
              <div className="auction-active-team">
                <div>
                  <span className="eyebrow" style={{ fontSize: '0.6rem' }}>
                    Now on Center Stage
                  </span>
                  <div className="auction-active-name">{currentTeam.name}</div>
                  <div className="auction-active-batch">
                    {currentBatch?.name} · Quota: {currentBatch?.quota} per House
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
                      ⚡ {auction.blindBidRuleLabel} (Freeze Card Disabled)
                    </div>
                  )}
                </div>
                <button
                  className="ghost-button"
                  onClick={() => runAction(() => api.admin.cancelSelection())}
                >
                  Clear Stage
                </button>
              </div>

              {/* Current Floor Status Strip */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 10,
                  background: auction.isBlindBidActive
                    ? 'rgba(231,76,60,0.16)'
                    : 'rgba(244,214,109,0.08)',
                  border: auction.isBlindBidActive
                    ? '1px solid rgba(231,76,60,0.5)'
                    : '1px solid rgba(244,214,109,0.25)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    {auction.isBlindBidActive ? '🔇 Blind Bid Mode' : 'Highest Floor Bid'}
                  </div>
                  <strong style={{ fontSize: '1.15rem', color: 'var(--gold)' }}>
                    {auction.currentBid > 0
                      ? `${Number(auction.currentBid).toLocaleString()} pts`
                      : `Opening @ ${basePrice.toLocaleString()} pts`}
                  </strong>
                  {leadingHouse && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: leadingHouse.color, fontWeight: 700 }}>
                      ({leadingHouse.name})
                    </span>
                  )}
                </div>
                {auction.bidHistory?.length > 0 && !auction.isBlindBidActive && (
                  <button
                    className="ghost-button"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}
                    onClick={handleUndoLastBid}
                  >
                    ↶ Undo Last Bid
                  </button>
                )}
              </div>

              {/* Active Freeze Banner */}
              {frozenHouse && (
                <div
                  style={{
                    color: '#bfdbfe',
                    fontSize: '0.76rem',
                    background: 'rgba(30,64,175,0.22)',
                    border: '1px solid rgba(96,165,250,0.45)',
                    borderRadius: 8,
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <span>
                    ❄ <strong>{frozenHouse.name}</strong> is FROZEN by{' '}
                    <strong>{frozenByHouse?.name || 'Rival'}</strong> (unfreezes when a 3rd house bids).
                  </span>
                  <button
                    className="ghost-button"
                    style={{ padding: '0.25rem 0.55rem', fontSize: '0.68rem', color: '#93c5fd' }}
                    onClick={() => runAction(() => api.admin.toggleFreeze(frozenHouse.id, false))}
                  >
                    Unfreeze
                  </button>
                </div>
              )}

              {/* ── Open Paddle Bidding Section ── */}
              {!auction.isBlindBidActive ? (
                <>
                  <form onSubmit={handlePlaceBid} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <label>
                      Bidding House (Select Paddle)
                      <select
                        value={selectedHouseId}
                        onChange={(e) => setSelectedHouseId(e.target.value)}
                      >
                        {houses.map((h) => {
                          const batchSlots = h.slots?.[currentTeam.batchId] || 0;
                          const batchQuota = currentBatch?.quota || 0;
                          const quotaFull = batchSlots >= batchQuota;
                          return (
                            <option key={h.id} value={h.id}>
                              {h.name} · Max Bid: {Number(h.maxBid || 0).toLocaleString()} pts ·{' '}
                              {currentBatch?.code}: {batchSlots}/{batchQuota}
                              {h.frozen ? ' ❄ FROZEN' : ''}
                              {quotaFull ? ' [BATCH FULL]' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    {selectedHouse && (() => {
                      const curPurse = Number(selectedHouse.remainingPoints ?? pointLimit);
                      const remSlots = Number(selectedHouse.remainingOverallSlots ?? 11);
                      const curMax = Number(selectedHouse.maxBid || 0);
                      const simBid = Math.max(basePrice, Number(bidAmount || minNextBid));
                      const nextPurse = curPurse - simBid;
                      const nextSlots = Math.max(0, remSlots - 1);
                      const nextMax =
                        nextSlots > 0
                          ? Math.max(0, nextPurse - (nextSlots - 1) * basePrice)
                          : 0;
                      return (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--muted)',
                            padding: '0.55rem 0.7rem',
                            borderRadius: 8,
                            background: 'rgba(244,214,109,0.06)',
                            border: '1px solid rgba(244,214,109,0.22)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>
                              Purse: <strong style={{ color: '#fff' }}>{curPurse.toLocaleString()} pts</strong> ({remSlots} slots left)
                            </span>
                            <span>
                              Current Max Bid: <strong style={{ color: 'var(--gold)' }}>{curMax.toLocaleString()} pts</strong>
                            </span>
                          </div>
                          <div style={{ fontSize: '0.67rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                            Formula: {curPurse.toLocaleString()} - (({remSlots} - 1) × 5,000) = {curMax.toLocaleString()} pts
                          </div>
                          {remSlots > 1 && (
                            <div style={{ fontSize: '0.69rem', color: 'var(--success)' }}>
                              🔮 If won @ {simBid.toLocaleString()} pts → <strong>Next Team Max Bid: {nextMax.toLocaleString()} pts</strong>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <label>
                      Paddle Bid (Base: 5,000 · Multiples of 1,000)
                      <input
                        type="number"
                        min={minNextBid}
                        step={bidIncrement}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Min ${minNextBid.toLocaleString()} pts`}
                      />
                    </label>

                    {/* Quick +1k / +2k / +5k Paddle Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                      {[
                        { label: 'Base 5k', val: basePrice },
                        { label: '+1,000', val: (auction.currentBid || basePrice - 1000) + 1000 },
                        { label: '+2,000', val: (auction.currentBid || basePrice) + 2000 },
                        { label: '+5,000', val: (auction.currentBid || basePrice) + 5000 },
                      ].map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => {
                            setBidAmount(String(q.val));
                            handlePlaceBid(null, q.val, selectedHouseId);
                          }}
                          disabled={q.val < minNextBid}
                          style={{
                            padding: '0.45rem 0.3rem',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            opacity: q.val < minNextBid ? 0.4 : 1,
                          }}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>

                    <button type="submit" className="primary-button" style={{ width: '100%' }}>
                      Submit Paddle Bid ({selectedHouse?.name || 'House'})
                    </button>
                  </form>

                  {/* Confirm Sold Button */}
                  <button
                    onClick={handleConfirmSold}
                    disabled={!auction.selectedHouseId || auction.currentBid < basePrice}
                    style={{
                      width: '100%',
                      background:
                        auction.selectedHouseId && auction.currentBid >= basePrice
                          ? 'linear-gradient(135deg, #4ecb80, #239b56)'
                          : 'rgba(255,255,255,0.05)',
                      color:
                        auction.selectedHouseId && auction.currentBid >= basePrice
                          ? '#04130a'
                          : 'var(--muted)',
                      fontWeight: 800,
                      border: 'none',
                      padding: '0.8rem 1rem',
                      opacity: !auction.selectedHouseId || auction.currentBid < basePrice ? 0.5 : 1,
                    }}
                  >
                    🔨 CONFIRM SOLD —{' '}
                    {leadingHouse
                      ? `${leadingHouse.name} @ ${Number(auction.currentBid).toLocaleString()} pts`
                      : 'Awaiting Opening Bid'}
                  </button>
                </>
              ) : (
                /* ── Blind Bid Protocol Console ── */
                <div
                  style={{
                    border: '1px solid rgba(231,76,60,0.5)',
                    background: 'rgba(231,76,60,0.08)',
                    borderRadius: 10,
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ff6b5b', letterSpacing: '0.08em' }}>
                    🔇 BLIND BID PROTOCOL — SEALED BIDS (&gt; {Number(auction.blindBidThreshold || 15000).toLocaleString()} PTS)
                  </div>

                  <form onSubmit={handleRecordBlindBid} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <select
                      value={blindHouseId}
                      onChange={(e) => setBlindHouseId(e.target.value)}
                    >
                      <option value="">— Select House for Sealed Bid —</option>
                      {houses.map((h) => {
                        const submitted = adminBlindBids[h.id]?.amount;
                        return (
                          <option key={h.id} value={h.id}>
                            {h.name} · Max: {Number(h.maxBid || 0).toLocaleString()} pts
                            {submitted ? ` (Locked: ${Number(submitted).toLocaleString()} pts)` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="number"
                        min={Number(auction.blindBidThreshold || 15000) + bidIncrement}
                        step={bidIncrement}
                        value={blindAmount}
                        onChange={(e) => setBlindAmount(e.target.value)}
                        placeholder={`Min ${(Number(auction.blindBidThreshold || 15000) + bidIncrement).toLocaleString()} pts`}
                      />
                      <button type="submit" className="primary-button" style={{ whiteSpace: 'nowrap' }}>
                        Lock Bid
                      </button>
                    </div>
                  </form>

                  {/* Submitted Sealed Bids & Resolution */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      Submitted Sealed Bids (Click to Award Winner)
                    </div>
                    {houses
                      .filter((h) => adminBlindBids[h.id] || auction.blindBids?.[h.id])
                      .map((h) => {
                        const amt = adminBlindBids[h.id]?.amount;
                        return (
                          <button
                            key={h.id}
                            onClick={() => handleResolveBlindBid(h.id, amt)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: 'rgba(78,203,128,0.14)',
                              border: '1px solid rgba(78,203,128,0.45)',
                              color: '#e8f8ef',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                            }}
                          >
                            <span>✓ Confirm {h.name}</span>
                            <span style={{ color: 'var(--gold)' }}>
                              {amt ? `${Number(amt).toLocaleString()} pts` : 'Locked'}
                            </span>
                          </button>
                        );
                      })}
                    {Object.keys(auction.blindBids || {}).length > 0 && (
                      <button
                        className="primary-button"
                        onClick={() => handleResolveBlindBid()}
                        style={{ marginTop: '0.25rem', width: '100%' }}
                      >
                        🏆 Auto-Resolve Highest Sealed Bid
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Power Arsenal (Quick Draw: Freeze & RTM) ── */}
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Freeze Card Control */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>❄ FREEZE CARD (Quick Draw)</span>
                    {auction.isBlindBidRound && (
                      <span style={{ color: '#fca5a5', fontSize: '0.65rem' }}>
                        Disabled on Blind-Bid Rounds
                      </span>
                    )}
                  </div>
                  <form onSubmit={handleInvokeFreeze} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <select
                        value={freezeSourceId}
                        onChange={(e) => setFreezeSourceId(e.target.value)}
                        disabled={auction.isBlindBidRound || auction.isBlindBidActive}
                      >
                        <option value="">House Playing…</option>
                        {houses
                          .filter((h) => !h.powerCards?.freeze?.used)
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                      </select>
                      <select
                        value={freezeTargetId}
                        onChange={(e) => setFreezeTargetId(e.target.value)}
                        disabled={auction.isBlindBidRound || auction.isBlindBidActive}
                      >
                        <option value="">Target Rival…</option>
                        {houses
                          .filter((h) => h.id !== freezeSourceId)
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={
                        auction.isBlindBidRound ||
                        auction.isBlindBidActive ||
                        Boolean(auction.frozenHouseId) ||
                        !freezeSourceId ||
                        !freezeTargetId
                      }
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: 'rgba(59,130,246,0.18)',
                        borderColor: 'rgba(96,165,250,0.45)',
                        color: '#bfdbfe',
                        opacity:
                          auction.isBlindBidRound ||
                          auction.isBlindBidActive ||
                          Boolean(auction.frozenHouseId) ||
                          !freezeSourceId ||
                          !freezeTargetId
                            ? 0.4
                            : 1,
                      }}
                    >
                      ❄ Activate Freeze (Quick Draw · Until 3rd House Bids)
                    </button>
                  </form>
                </div>

                {/* Manual Blind Bid Trigger Override */}
                {!auction.isBlindBidActive && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleTriggerBlindBid}
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.38rem 0.6rem',
                      color: '#fca5a5',
                      borderColor: 'rgba(231,76,60,0.35)',
                    }}
                  >
                    🔇 Manually Trigger Blind Bid Protocol Now
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="empty-state">
              Select an unsold team from the 44-team pool below to begin bidding on Center Stage.
            </p>
          )}
        </section>

        {/* ── 2. House Balances, Quotas, Power Cards & Passwords ── */}
        <section className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Franchise Economics &amp; Credentials</h2>
            <button
              type="button"
              className="ghost-button"
              style={{ fontSize: '0.68rem', padding: '0.32rem 0.6rem' }}
              onClick={() => setShowSecurityPanel(!showSecurityPanel)}
            >
              🔐 {showSecurityPanel ? 'Close' : 'Admin Password'}
            </button>
          </div>

          {showSecurityPanel && (
            <div
              style={{
                marginBottom: '0.8rem',
                padding: '0.75rem',
                borderRadius: 10,
                background: 'rgba(244,214,109,0.06)',
                border: '1px solid rgba(244,214,109,0.3)',
                display: 'flex',
                gap: '0.45rem',
                alignItems: 'center',
              }}
            >
              <input
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="Enter New Admin Password (min 4 chars)"
                style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.74rem' }}
              />
              <button
                type="button"
                className="primary-button"
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                onClick={() => {
                  if (!newAdminPassword.trim() || newAdminPassword.trim().length < 4) return;
                  runAction(
                    () => api.admin.updateSecurityConfig({ newAdminPassword: newAdminPassword.trim() }),
                    () => {
                      setNewAdminPassword('');
                      setShowSecurityPanel(false);
                      setNotice('Admin password updated.');
                    }
                  );
                }}
              >
                Update Password
              </button>
            </div>
          )}

          <div style={{ marginBottom: '0.7rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              min="50000"
              step="5000"
              value={newPointLimit}
              onChange={(e) => setNewPointLimit(e.target.value)}
              placeholder={`Purse per house (now: ${pointLimit.toLocaleString()} pts)`}
              style={{ flex: 1, fontSize: '0.76rem', padding: '0.5rem 0.65rem' }}
            />
            <button
              onClick={() => {
                const val = Number(newPointLimit);
                if (!val || val < 50000) return;
                runAction(() => api.admin.setPointLimit(val), () => setNewPointLimit(''));
              }}
              style={{ whiteSpace: 'nowrap', padding: '0.5rem 0.85rem', fontSize: '0.76rem' }}
            >
              Set Purse
            </button>
          </div>

          <div className="house-overview">
            {houses.map((house) => {
              const adminHouse = adminHouses.find((ah) => ah.id === house.id);
              const remaining = house.remainingPoints ?? pointLimit;
              const isNeg = remaining < 0;
              const pct = Math.max(0, Math.min(100, (remaining / pointLimit) * 100));

              return (
                <div
                  key={house.id}
                  className="small-house-card"
                  style={
                    house.frozen
                      ? {
                          borderColor: 'rgba(147,197,253,0.45)',
                          background: 'rgba(60,130,220,0.08)',
                        }
                      : {}
                  }
                >
                  <div className="small-house-head">
                    <span className="dot-square" style={{ background: house.color }} />
                    <strong>{house.name}</strong>
                    <span
                      style={{
                        fontSize: '0.63rem',
                        color: 'var(--muted)',
                        marginLeft: '0.3rem',
                      }}
                    >
                      ({adminHouse?.username || house.id} · 🔐 Encrypted)
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.75rem',
                        color: isNeg ? '#ff5e4d' : house.frozen ? '#93c5fd' : house.color,
                        fontWeight: 700,
                      }}
                    >
                      {remaining.toLocaleString()} pts
                    </span>
                  </div>

                  <div className="small-house-bar">
                    <div
                      className="small-house-fill"
                      style={{
                        width: `${pct}%`,
                        background: isNeg ? '#ff5e4d' : house.frozen ? '#93c5fd' : house.color,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.7rem',
                      color: 'var(--muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span>
                      Max Bid: <strong style={{ color: 'var(--gold)' }}>{Number(house.maxBid || 0).toLocaleString()}</strong>
                    </span>
                    <span>
                      Drafted: <strong style={{ color: '#fff' }}>{house.acquiredCount || 0}/11</strong>
                    </span>
                  </div>

                  {/* Batch Quotas Row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '0.25rem',
                      marginBottom: '0.45rem',
                    }}
                  >
                    {batches.map((b) => {
                      const c = house.slots?.[b.id] || 0;
                      const q = b.quota || 0;
                      return (
                        <div
                          key={b.id}
                          style={{
                            fontSize: '0.65rem',
                            textAlign: 'center',
                            padding: '0.15rem',
                            borderRadius: 4,
                            background: c >= q ? 'rgba(78,203,128,0.15)' : 'rgba(255,255,255,0.03)',
                            color: c >= q ? 'var(--success)' : 'var(--text)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {b.code}: <strong>{c}/{q}</strong>
                        </div>
                      );
                    })}
                  </div>

                  {/* Power Card Status & Floor Override Toggle (Freeze Only) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <div
                      onClick={() =>
                        runAction(() =>
                          api.admin.togglePowerCard(
                            house.id,
                            'freeze',
                            !house.powerCards?.freeze?.used
                          )
                        )
                      }
                      style={{ cursor: 'pointer' }}
                      title="Click to toggle Freeze Card USED / AVAILABLE"
                    >
                      <PowerCardIcon
                        type="freeze"
                        used={Boolean(house.powerCards?.freeze?.used)}
                        size="xs"
                      />
                    </div>
                    <button
                      className="ghost-button"
                      style={{
                        marginLeft: 'auto',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.65rem',
                      }}
                      onClick={() => {
                        setEditingHouseId(editingHouseId === house.id ? null : house.id);
                        setHouseForm({
                          name: house.name,
                          username: adminHouse?.username || house.id,
                          captainTeamName: house.captainTeamName || '',
                          newPassword: '',
                        });
                      }}
                    >
                      🔐 Edit / Password
                    </button>
                  </div>

                  {editingHouseId === house.id && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <input
                        value={houseForm.name}
                        onChange={(e) => setHouseForm({ ...houseForm, name: e.target.value })}
                        placeholder="House Display Name"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}
                      />
                      <input
                        value={houseForm.username}
                        onChange={(e) => setHouseForm({ ...houseForm, username: e.target.value })}
                        placeholder="House Login Username"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}
                      />
                      <input
                        value={houseForm.captainTeamName}
                        onChange={(e) =>
                          setHouseForm({ ...houseForm, captainTeamName: e.target.value })
                        }
                        placeholder="23k Captain Team Name"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}
                      />
                      <input
                        type="password"
                        value={houseForm.newPassword}
                        onChange={(e) =>
                          setHouseForm({ ...houseForm, newPassword: e.target.value })
                        }
                        placeholder="Set New House Password (leave blank to keep current)"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}
                      />
                      <button
                        className="primary-button"
                        style={{ padding: '0.4rem', fontSize: '0.72rem' }}
                        onClick={() => handleSaveHouseConfig(house.id)}
                      >
                        Save House Password &amp; Info
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. Qualifying Team Pool (44 Teams across 26k, 25k, 24k, 23k) ── */}
        <section className="admin-card wide-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Qualifying Teams Pool ({teams.length} Teams)</h2>
            <button
              className="ghost-button"
              style={{ fontSize: '0.74rem', padding: '0.4rem 0.75rem' }}
              onClick={() => setShowBulkModal(!showBulkModal)}
            >
              {showBulkModal ? 'Close Bulk Import' : '+ Bulk Paste Teams'}
            </button>
          </div>

          {showBulkModal && (
            <div
              style={{
                marginBottom: '0.85rem',
                padding: '0.75rem',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(244,214,109,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600 }}>
                Paste team names (one per line) into selected Batch:
              </div>
              <select value={bulkBatchId} onChange={(e) => setBulkBatchId(e.target.value)}>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (Target: {b.totalTeams} teams)
                  </option>
                ))}
              </select>
              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'One piece\nTeam Alpha\nTeam Beta'}
                style={{
                  width: '100%',
                  background: 'rgba(10,10,18,0.9)',
                  color: 'var(--text)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '0.6rem',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.78rem',
                }}
              />
              <button className="primary-button" onClick={handleBulkImport}>
                Import Teams to Batch
              </button>
            </div>
          )}

          <div className="inline-form">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
              placeholder="New team name"
            />
            <select value={teamBatchId} onChange={(e) => setTeamBatchId(e.target.value)}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button onClick={handleCreateTeam}>Add</button>
          </div>

          {/* Batch & Status Filters */}
          <div className="filters-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                className={batchFilter === 'all' ? 'active-filter' : ''}
                onClick={() => setBatchFilter('all')}
              >
                All ({teams.length})
              </button>
              {batches.map((b) => {
                const count = teams.filter((t) => t.batchId === b.id).length;
                return (
                  <button
                    key={b.id}
                    className={batchFilter === b.id ? 'active-filter' : ''}
                    onClick={() => setBatchFilter(b.id)}
                  >
                    {b.code} ({count}/{b.totalTeams})
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {['all', 'unsold', 'sold'].map((f) => (
                <button
                  key={f}
                  className={statusFilter === f ? 'active-filter' : ''}
                  onClick={() => setStatusFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="team-table">
            {filteredTeams.map((team) => {
              const isLive = team.id === auction.currentTeamId;
              const assignedHouse = team.assignedHouseId
                ? houses.find((h) => h.id === team.assignedHouseId)
                : null;
              const tx = assignedHouse
                ? transactions.find((t) => t.teamId === team.id && t.status === 'confirmed')
                : null;
              const batch = batches.find((b) => b.id === team.batchId);

              if (editingTeamId === team.id) {
                return (
                  <div key={team.id} className="team-row">
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <input
                        value={editingTeamName}
                        onChange={(e) => setEditingTeamName(e.target.value)}
                      />
                      <select
                        value={editingTeamBatchId || team.batchId}
                        onChange={(e) => setEditingTeamBatchId(e.target.value)}
                      >
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={editingTeamIsFirst}
                          onChange={(e) => setEditingTeamIsFirst(e.target.checked)}
                          style={{ width: 'auto' }}
                        />
                        First-Team 15k Blind Bid Trigger
                      </label>
                    </div>
                    <div className="team-row-actions">
                      <button onClick={() => handleEditTeam(team.id)}>Save</button>
                      <button className="ghost-button" onClick={() => setEditingTeamId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              const isLastAcquired = !isLive && team.id === lastConfirmedTeamId;

              return (
                <div
                  key={team.id}
                  className={`team-row ${team.status === 'assigned' ? 'assigned' : ''} ${
                    isLive ? 'team-row-live' : ''
                  }`}
                  style={
                    isLive
                      ? { borderColor: 'var(--gold)', background: 'rgba(244,214,109,0.07)' }
                      : isLastAcquired
                        ? {
                            borderColor: 'rgba(78,203,128,0.55)',
                            background: 'rgba(78,203,128,0.07)',
                          }
                        : {}
                  }
                >
                  <div>
                    {isLive && <span className="in-auction-badge">On Stage</span>}
                    {team.isBlindBidEligible && (
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.58rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: '#fca5a5',
                          border: '1px solid rgba(231,76,60,0.45)',
                          borderRadius: 4,
                          padding: '0.1rem 0.45rem',
                          marginBottom: '0.25rem',
                          marginRight: '0.35rem',
                          background: 'rgba(231,76,60,0.12)',
                        }}
                      >
                        ⚡ Blind Trigger @ {Number(team.blindBidThreshold).toLocaleString()}
                      </span>
                    )}
                    <strong>{team.name}</strong>
                    <small>
                      {batch?.name}
                      {assignedHouse && (
                        <span style={{ color: assignedHouse.color, marginLeft: '0.5rem' }}>
                          → {assignedHouse.name}
                          {tx ? ` · ${Number(tx.amount).toLocaleString()} pts` : ''}
                          {tx?.viaRTM ? ' [RTM]' : ''}
                          {tx?.viaBlindBid ? ' [BLIND]' : ''}
                        </span>
                      )}
                    </small>
                  </div>
                  <div className="team-row-actions">
                    {!isLive && !team.assignedHouseId && (
                      <button
                        onClick={() => runAction(() => api.admin.selectTeam(team.id))}
                      >
                        Put on Stage
                      </button>
                    )}
                    {isLive && (
                      <button
                        className="ghost-button"
                        onClick={() => runAction(() => api.admin.cancelSelection())}
                      >
                        Remove
                      </button>
                    )}
                    {!isLive && (
                      <button
                        className="ghost-button"
                        onClick={() => {
                          setEditingTeamId(team.id);
                          setEditingTeamName(team.name);
                          setEditingTeamBatchId(team.batchId);
                          setEditingTeamIsFirst(Boolean(team.isFirstTeam));
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {!isLive && !team.assignedHouseId && (
                      <button
                        className="ghost-button"
                        onClick={() => runAction(() => api.admin.deleteTeam(team.id))}
                      >
                        Delete
                      </button>
                    )}
                    {!isLive && team.assignedHouseId && tx && (
                      <button
                        className="ghost-button"
                        style={{ color: 'var(--danger)', borderColor: 'rgba(214,91,77,0.3)' }}
                        onClick={() => {
                          if (window.confirm('Undo this assignment? Points will be restored.')) {
                            runAction(() => api.admin.reverseTransaction(tx.id));
                          }
                        }}
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 4. Confirmed Sales ── */}
        <section className="admin-card transactions-card">
          <h2>Confirmed Draft Ledger</h2>
          <div className="transaction-list">
            {transactions
              .filter((tx) => tx.status === 'confirmed')
              .map((tx) => {
                const team = teams.find((t) => t.id === tx.teamId);
                const house = houses.find((h) => h.id === tx.houseId);
                return (
                  <div key={tx.id} className="transaction-row">
                    <div>
                      <strong>
                        {team?.name || '—'}
                        {tx.viaRTM ? ' [RTM]' : ''}
                        {tx.viaBlindBid ? ' [BLIND]' : ''}
                      </strong>
                      <span style={{ color: house?.color }}>
                        {house?.name || '—'} · {Number(tx.amount).toLocaleString()} pts
                      </span>
                    </div>
                    <div className="transaction-actions">
                      <button
                        onClick={() => {
                          const value = Number(prompt('Enter corrected amount (multiple of 1,000):'));
                          if (!value || value <= 0) return;
                          runAction(() => api.admin.reviseAmount(tx.id, value));
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-button"
                        style={{ color: 'var(--danger)', borderColor: 'rgba(214,91,77,0.3)' }}
                        onClick={() => {
                          if (window.confirm('Undo this sale?')) {
                            runAction(() => api.admin.reverseTransaction(tx.id));
                          }
                        }}
                      >
                        Undo
                      </button>
                    </div>
                  </div>
                );
              })}
            {transactions.filter((tx) => tx.status === 'confirmed').length === 0 && (
              <p className="empty-state">No sales recorded yet.</p>
            )}
          </div>
        </section>

        {/* ── 5. Audit Log ── */}
        <section className="admin-card history-card">
          <h2>Live Floor Log</h2>
          <div className="history-list">
            {history
              .slice()
              .reverse()
              .slice(0, 20)
              .map((entry) => (
                <div key={entry.id} className="history-item">
                  <strong>{entry.type}</strong>
                  <span>{entry.message}</span>
                  <small>{new Date(entry.createdAt).toLocaleTimeString()}</small>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
