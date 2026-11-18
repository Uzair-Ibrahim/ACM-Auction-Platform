const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const {
  getState,
  replaceState,
  buildPublicSnapshot,
  buildDefaultAuctionState,
  buildDefaultPowerCards,
  hydrateFromSupabaseIfAvailable,
  addHistory,
  generateId,
  resetStore,
  HOUSE_POINT_LIMIT,
  BASE_PRICE,
  BID_INCREMENT,
} = require('../data/store');
const {
  calculateMaxBid,
  getHouseSlotSummary,
  getTeamBlindBidInfo,
} = require('../utils/bidUtils');
const {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  authenticateWithSupabase,
} = require('../utils/authUtils');
const { syncUserToSupabaseAuth } = require('../utils/supabaseClient');

// In-memory captain session tokens: token -> { houseId, createdAt }
const captainSessions = new Map();

// Hydrate from Supabase on Vercel serverless cold-starts or initial boot
router.use(async (req, res, next) => {
  if (process.env.VERCEL) {
    await hydrateFromSupabaseIfAvailable(req.method !== 'GET');
  }
  next();
});

function getPointLimit(state) {
  return Number(state.settings?.housePointLimit || HOUSE_POINT_LIMIT);
}

function getBasePrice(state) {
  return Number(state.settings?.basePrice || BASE_PRICE);
}

function getBidIncrement(state) {
  return Number(state.settings?.bidIncrement || BID_INCREMENT);
}

function confirmedHouseSpend(state, houseId, excludedTransactionId = null) {
  return state.transactions
    .filter(
      (transaction) =>
        transaction.houseId === houseId &&
        transaction.status === 'confirmed' &&
        transaction.id !== excludedTransactionId
    )
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
}

function getHouseMetrics(state, houseId, excludedTransactionId = null) {
  const pointLimit = getPointLimit(state);
  const basePrice = getBasePrice(state);
  const totalSpent = confirmedHouseSpend(state, houseId, excludedTransactionId);
  const remainingPoints = pointLimit - totalSpent;
  const slotInfo = getHouseSlotSummary(houseId, state.teams, state.batches);
  const maxBid = calculateMaxBid(remainingPoints, slotInfo.remainingOverallSlots, basePrice);

  return {
    pointLimit,
    basePrice,
    totalSpent,
    remainingPoints,
    ...slotInfo,
    maxBid,
  };
}

function extractBearerToken(req) {
  const auth = String(req.headers['authorization'] || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function isAdminRequest(req) {
  const token =
    String(req.headers['x-admin-token'] || '').trim() ||
    extractBearerToken(req) ||
    String(req.headers['x-admin-key'] || '').trim();

  if (!token) return false;

  // 1. Verify signed HS256 Admin JWT token
  const payload = verifyJwt(token);
  if (payload && payload.role === 'admin') {
    return true;
  }

  // 2. Fallback: verify direct admin key against stored scrypt hash or env ADMIN_KEY
  const state = getState();
  const configuredKey = process.env.ADMIN_KEY || 'hogwarts-admin';
  if (token === configuredKey) return true;
  if (state.settings?.adminPasswordHash && verifyPassword(token, state.settings.adminPasswordHash)) {
    return true;
  }
  return false;
}

function ensureAdmin(req, res, next) {
  if (isAdminRequest(req)) {
    return next();
  }
  return res.status(403).json({ error: 'Admin authentication required. Please log in as Admin.' });
}

function getCaptainHouseId(req) {
  const token =
    String(req.headers['x-captain-token'] || '').trim() ||
    extractBearerToken(req);
  if (!token) return null;

  // 1. Verify stateless signed HS256 JWT token (survives team sales & server restarts!)
  const payload = verifyJwt(token);
  if (payload && payload.role === 'captain' && payload.houseId) {
    return payload.houseId;
  }

  // 2. Legacy in-memory map fallback
  if (captainSessions.has(token)) {
    return captainSessions.get(token).houseId;
  }

  return null;
}

function ensureAdminOrCaptain(req, res, next) {
  if (isAdminRequest(req)) {
    req.actorRole = 'admin';
    return next();
  }
  const captainHouseId = getCaptainHouseId(req);
  if (captainHouseId) {
    req.actorRole = 'captain';
    req.captainHouseId = captainHouseId;
    return next();
  }
  return res.status(403).json({ error: 'Authentication required (Admin or House Captain).' });
}

function emitUpdate(req) {
  const io = req.app.get('io');
  io.emit('auction:update', buildPublicSnapshot());
}

function safeNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Shared atomic post-sold transaction execution block:
 * 1. Subtracts final points from winning House's purse
 * 2. Assigns Team to House's roster
 * 3. Increments House's Slot Counter for that Batch (+1)
 * 4. Permanently locks any used Freeze or RTM card
 * 5. Recalculates Max Bid Limits and broadcasts to all portals
 */
function executeSoldTransaction(req, state, { team, house, amount, viaRTM = false, viaBlindBid = false, note = '' }) {
  const now = new Date().toISOString();
  const transaction = {
    id: generateId('txn'),
    teamId: team.id,
    houseId: house.id,
    amount,
    status: 'confirmed',
    viaRTM,
    viaBlindBid,
    createdAt: now,
    updatedAt: now,
    reversedAt: null,
    note:
      note ||
      (viaRTM
        ? `Sold via RTM (Right to Match) to ${house.name}.`
        : viaBlindBid
          ? `Sold via Blind Bid Protocol to ${house.name}.`
          : 'Auction confirmed by host.'),
  };

  state.transactions.push(transaction);
  team.status = 'assigned';
  team.assignedHouseId = house.id;
  team.assignedTransactionId = transaction.id;

  // Reset active stage state for next lot (used powerCards on houses remain permanently locked)
  state.auction = buildDefaultAuctionState();

  const tag = viaRTM ? ' [RTM STEAL]' : viaBlindBid ? ' [BLIND BID]' : '';
  addHistory(
    'auction_confirmed',
    `${team.name} sold to ${house.name} for ${amount.toLocaleString()} pts${tag}.`,
    {
      teamId: team.id,
      houseId: house.id,
      amount,
      viaRTM,
      viaBlindBid,
      transactionId: transaction.id,
    }
  );

  replaceState(state);
  emitUpdate(req);
  req.app.get('io').emit('auction:confirmed', {
    team: team.name,
    teamId: team.id,
    house: house.name,
    houseId: house.id,
    amount,
    viaRTM,
    viaBlindBid,
  });

  return transaction;
}

// ── Public Endpoints ───────────────────────────────────────────────

router.get('/state', (req, res) => {
  res.json(buildPublicSnapshot());
});

router.get('/history', (req, res) => {
  res.json(getState().history.slice(-50));
});

router.get('/houses', (req, res) => {
  res.json(buildPublicSnapshot().houses);
});

router.get('/batches', (req, res) => {
  res.json(getState().batches);
});

router.get('/teams', (req, res) => {
  res.json(buildPublicSnapshot().teams);
});

// ── Authentication Endpoints ───────────────────────────────────────

router.post('/admin/login', async (req, res) => {
  const state = getState();
  const username = String(req.body?.username || 'admin').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();
  const expectedUsername = String(state.settings?.adminUsername || 'admin').toLowerCase();

  if (username !== expectedUsername && username !== 'admin' && username !== 'host') {
    return res.status(401).json({ error: 'Invalid Admin username or password.' });
  }

  // 1. Check Supabase Auth if configured
  const sb = await authenticateWithSupabase(username, password, {
    url: state.settings?.supabaseUrl,
    anonKey: state.settings?.supabaseAnonKey,
  });
  let authenticated = Boolean(sb.enabled && sb.success);

  // 2. Verify against server-side salted scrypt passwordHash
  if (!authenticated) {
    const configuredKey = process.env.ADMIN_KEY || 'hogwarts-admin';
    const hashValid =
      state.settings?.adminPasswordHash &&
      verifyPassword(password, state.settings.adminPasswordHash);
    const envValid = password === configuredKey;
    authenticated = Boolean(hashValid || envValid);
    if (authenticated && sb.enabled) {
      syncUserToSupabaseAuth(username, password, { role: 'admin' }).catch(() => {});
    }
  }

  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid Admin username or password.' });
  }

  const token = signJwt({
    role: 'admin',
    username: state.settings?.adminUsername || 'admin',
    authProvider: sb.enabled && sb.success ? 'supabase' : 'coderscup-jwt',
  });

  return res.json({
    success: true,
    role: 'admin',
    username: state.settings?.adminUsername || 'admin',
    token,
    adminKey: token,
    authProvider: sb.enabled && sb.success ? 'supabase' : 'coderscup-jwt',
    message: 'Admin authenticated.',
  });
});

router.get('/admin/state', ensureAdmin, (req, res) => {
  // Never expose plaintext passwords or password hashes in any network response!
  const snapshot = buildPublicSnapshot({ includeBlindAmounts: true });
  const rawState = getState();
  snapshot.houses = snapshot.houses.map((h) => {
    const rawHouse = rawState.houses.find((rh) => rh.id === h.id);
    return {
      ...h,
      username: rawHouse?.username || h.id,
      hasPassword: Boolean(rawHouse?.passwordHash),
    };
  });
  res.json(snapshot);
});

router.post('/captain/login', async (req, res) => {
  const state = getState();
  const rawIdentifier = String(req.body?.username || req.body?.houseId || '').trim().toLowerCase();
  const password = String(req.body?.password || req.body?.pin || '').trim();

  const house = state.houses.find(
    (h) =>
      h.id.toLowerCase() === rawIdentifier ||
      String(h.username || '').toLowerCase() === rawIdentifier ||
      h.name.toLowerCase() === rawIdentifier
  );
  if (!house) {
    return res.status(404).json({ error: 'House account not found.' });
  }
  if (!password) {
    return res.status(401).json({ error: 'Password is required.' });
  }

  // 1. Check Supabase Auth if configured
  const sb = await authenticateWithSupabase(house.username || house.id, password, {
    url: state.settings?.supabaseUrl,
    anonKey: state.settings?.supabaseAnonKey,
  });
  let authenticated = Boolean(sb.enabled && sb.success);

  // 2. Verify against server-side salted scrypt passwordHash
  if (!authenticated) {
    authenticated = verifyPassword(password, house.passwordHash);
    if (authenticated && sb.enabled) {
      syncUserToSupabaseAuth(house.username || house.id, password, {
        role: 'captain',
        houseId: house.id,
        houseName: house.name,
      }).catch(() => {});
    }
  }

  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid House Captain credentials.' });
  }

  const token = signJwt({
    role: 'captain',
    houseId: house.id,
    username: house.username || house.id,
    authProvider: sb.enabled && sb.success ? 'supabase' : 'coderscup-jwt',
  });
  captainSessions.set(token, { houseId: house.id, createdAt: new Date().toISOString() });

  return res.json({
    success: true,
    role: 'captain',
    token,
    houseId: house.id,
    houseName: house.name,
    username: house.username || house.id,
    authProvider: sb.enabled && sb.success ? 'supabase' : 'coderscup-jwt',
  });
});

router.get('/captain/me', (req, res) => {
  const houseId = getCaptainHouseId(req);
  if (!houseId) {
    return res.status(401).json({ error: 'Invalid or expired captain session.' });
  }
  const snapshot = buildPublicSnapshot();
  const house = snapshot.houses.find((h) => h.id === houseId);
  const rawState = getState();
  const myBlindBid = rawState.auction.blindBids?.[houseId] || null;
  return res.json({
    success: true,
    houseId,
    house,
    myBlindBid,
  });
});

// ── Team Management Endpoints (Admin) ──────────────────────────────

router.post('/teams', ensureAdmin, (req, res) => {
  const state = getState();
  const name = String(req.body?.name || '').trim();
  const batchId = String(req.body?.batchId || state.batches[0]?.id || 'batch-26k');
  const isFirstTeam = Boolean(req.body?.isFirstTeam);

  if (!name) {
    return res.status(400).json({ error: 'Team name is required.' });
  }
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) {
    return res.status(404).json({ error: 'Selected batch does not exist.' });
  }

  if (isFirstTeam) {
    state.teams.forEach((t) => {
      if (t.batchId === batchId) t.isFirstTeam = false;
    });
    batch.firstTeamName = name;
  }

  const team = {
    id: generateId('team'),
    name,
    batchId,
    isFirstTeam,
    isCaptain: false,
    status: 'unsold',
    assignedHouseId: null,
    assignedTransactionId: null,
    createdAt: new Date().toISOString(),
  };

  state.teams.push(team);
  addHistory('team_added', `Team added: ${name} (${batch.name}).`, { teamId: team.id, batchId });
  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, team });
});

router.post('/teams/bulk', ensureAdmin, (req, res) => {
  const state = getState();
  const items = Array.isArray(req.body?.teams) ? req.body.teams : [];
  const replaceExisting = Boolean(req.body?.replaceExisting);

  if (!items.length) {
    return res.status(400).json({ error: 'No teams provided for bulk import.' });
  }

  if (replaceExisting) {
    const hasSold = state.teams.some((t) => t.status === 'assigned');
    if (hasSold) {
      return res.status(400).json({ error: 'Reset the auction before replacing all existing teams.' });
    }
    state.teams = [];
  }

  const added = [];
  const now = new Date().toISOString();
  for (const item of items) {
    const name = String(item.name || '').trim();
    const batchId = String(item.batchId || 'batch-26k');
    if (!name || !state.batches.some((b) => b.id === batchId)) continue;

    const batchCfg = state.batches.find((b) => b.id === batchId);
    const isFirstTeam =
      Boolean(item.isFirstTeam) ||
      Boolean(
        batchCfg?.firstTeamName &&
          name.toLowerCase() === String(batchCfg.firstTeamName).trim().toLowerCase()
      );

    const team = {
      id: generateId('team'),
      name,
      batchId,
      isFirstTeam,
      isCaptain: false,
      status: 'unsold',
      assignedHouseId: null,
      assignedTransactionId: null,
      createdAt: now,
    };
    state.teams.push(team);
    added.push(team);
  }

  addHistory('teams_bulk_imported', `Bulk imported ${added.length} teams.`, { count: added.length });
  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, count: added.length, teams: added });
});

router.put('/teams/:id', ensureAdmin, (req, res) => {
  const state = getState();
  const team = state.teams.find((item) => item.id === req.params.id);
  if (!team) {
    return res.status(404).json({ error: 'Team not found.' });
  }

  const name = String(req.body?.name || '').trim();
  const batchId = String(req.body?.batchId || team.batchId);
  const isFirstTeam = req.body?.isFirstTeam !== undefined ? Boolean(req.body.isFirstTeam) : team.isFirstTeam;

  if (!name) {
    return res.status(400).json({ error: 'Team name is required.' });
  }
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found.' });
  }

  if (isFirstTeam) {
    state.teams.forEach((t) => {
      if (t.batchId === batchId && t.id !== team.id) t.isFirstTeam = false;
    });
    batch.firstTeamName = name;
  }

  const previousName = team.name;
  team.name = name;
  team.batchId = batchId;
  team.isFirstTeam = isFirstTeam;

  addHistory('team_updated', `Team updated from ${previousName} to ${name}.`, { teamId: team.id, batchId });
  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, team });
});

router.delete('/teams/:id', ensureAdmin, (req, res) => {
  const state = getState();
  const team = state.teams.find((item) => item.id === req.params.id);
  if (!team) {
    return res.status(404).json({ error: 'Team not found.' });
  }
  if (team.assignedHouseId) {
    return res.status(400).json({ error: 'Reverse the confirmed assignment before deleting this team.' });
  }

  state.teams = state.teams.filter((item) => item.id !== team.id);
  if (state.auction.currentTeamId === team.id) {
    state.auction = buildDefaultAuctionState();
  }

  addHistory('team_deleted', `Team deleted: ${team.name}.`, { teamId: team.id });
  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, deletedId: team.id });
});

// ── Stage & Live Bidding Endpoints ─────────────────────────────────

router.post('/auction/select-team', ensureAdmin, (req, res) => {
  const state = getState();
  const team = state.teams.find((item) => item.id === req.body?.teamId);

  if (!team) {
    return res.status(404).json({ error: 'Team not found.' });
  }
  if (team.assignedHouseId) {
    return res.status(400).json({ error: 'This team has already been assigned to a house.' });
  }

  const blindInfo = getTeamBlindBidInfo(team, state.batches, state.teams);

  state.auction = {
    ...buildDefaultAuctionState(),
    currentTeamId: team.id,
    status: 'live',
    startedAt: new Date().toISOString(),
    isBlindBidRound: blindInfo.isBlindBidRound,
    blindBidThreshold: blindInfo.blindBidThreshold,
    blindBidRuleLabel: blindInfo.ruleLabel,
  };

  addHistory(
    'team_selected',
    `Selected ${team.name} for auction${blindInfo.isBlindBidRound ? ` [${blindInfo.ruleLabel}]` : ''}.`,
    {
      teamId: team.id,
      isBlindBidRound: blindInfo.isBlindBidRound,
      blindBidThreshold: blindInfo.blindBidThreshold,
    }
  );
  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, team, auction: state.auction });
});

router.post('/auction/cancel-selection', ensureAdmin, (req, res) => {
  const state = getState();
  const teamId = state.auction.currentTeamId;

  state.auction = buildDefaultAuctionState();

  if (teamId) {
    addHistory('selection_cancelled', `Auction stage cleared for team ID ${teamId}.`, { teamId });
  }

  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, cleared: true });
});

router.post('/auction/set-house', ensureAdmin, (req, res) => {
  const state = getState();
  const houseId = String(req.body?.houseId || '');
  if (!state.houses.some((house) => house.id === houseId)) {
    return res.status(404).json({ error: 'House not found.' });
  }

  state.auction.selectedHouseId = houseId;
  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, houseId });
});

/**
 * Core Paddle Bid Handler (used by both /auction/bid and /auction/update-bid).
 * Supports both Host input and Authenticated Captain live bidding.
 */
function handlePlaceBid(req, res) {
  const state = getState();
  const currentTeam = state.teams.find((t) => t.id === state.auction.currentTeamId);
  if (!currentTeam) {
    return res.status(400).json({ error: 'No team is currently on stage for auction.' });
  }

  if (state.auction.isBlindBidActive) {
    return res.status(400).json({
      error: 'Blind Bid Protocol is active! Open paddle bidding is halted — submit a sealed blind bid instead.',
      code: 'BLIND_BID_ACTIVE',
    });
  }

  const houseId =
    req.actorRole === 'captain'
      ? req.captainHouseId
      : String(req.body?.houseId || state.auction.selectedHouseId || '').trim();

  const house = state.houses.find((h) => h.id === houseId);
  if (!house) {
    return res.status(400).json({ error: 'Please select a valid bidding House.' });
  }

  const amount = safeNumber(req.body?.amount);
  const basePrice = getBasePrice(state);
  const bidIncrement = getBidIncrement(state);

  if (amount === null || amount <= 0) {
    return res.status(400).json({ error: 'Valid bid amount is required.' });
  }

  // Check if house is currently frozen on stage
  if (state.auction.frozenHouseId === house.id) {
    const freezer = state.houses.find((h) => h.id === state.auction.frozenByHouseId);
    return res.status(400).json({
      error: `${house.name} is FROZEN${freezer ? ` by ${freezer.name}` : ''} and blocked from bidding until another house places a bid!`,
      code: 'HOUSE_FROZEN',
    });
  }

  // Check if house is already the highest bidder (for captain portal or strict paddle bids)
  if (req.actorRole === 'captain' && state.auction.selectedHouseId === house.id && state.auction.currentBid > 0) {
    return res.status(400).json({
      error: `${house.name} already holds the highest bid (${state.auction.currentBid.toLocaleString()} pts).`,
    });
  }

  // Check Batch Quota & Overall Slot availability
  const batch = state.batches.find((b) => b.id === currentTeam.batchId);
  const metrics = getHouseMetrics(state, house.id);
  if (metrics.remainingOverallSlots <= 0) {
    return res.status(400).json({
      error: `${house.name} has already drafted its maximum ${metrics.totalQuota} teams.`,
    });
  }
  const currentBatchCount = metrics.slots[currentTeam.batchId] || 0;
  const batchQuota = Number(batch?.quota || 0);
  if (batch && currentBatchCount >= batchQuota) {
    return res.status(400).json({
      error: `${house.name} has already filled its ${batch.name} quota (${currentBatchCount}/${batchQuota}).`,
      code: 'BATCH_QUOTA_FULL',
    });
  }

  // Check Base Price & 1,000 Increment Rules
  if (amount < basePrice) {
    return res.status(400).json({
      error: `Base price is ${basePrice.toLocaleString()} points.`,
    });
  }
  if (amount % bidIncrement !== 0) {
    return res.status(400).json({
      error: `All paddle bids must be strictly in multiples of ${bidIncrement.toLocaleString()} points.`,
    });
  }
  if (state.auction.currentBid > 0 && amount < state.auction.currentBid + bidIncrement) {
    return res.status(400).json({
      error: `Bid must be at least ${(state.auction.currentBid + bidIncrement).toLocaleString()} points (minimum +${bidIncrement.toLocaleString()} increment).`,
    });
  }

  // Check The Reserve Law (Max Bid Limit)
  if (amount > metrics.maxBid) {
    return res.status(400).json({
      error: 'Error: House lacks sufficient reserve points.',
      code: 'RESERVE_LIMIT_EXCEEDED',
      maxBid: metrics.maxBid,
      remainingPoints: metrics.remainingPoints,
      remainingOverallSlots: metrics.remainingOverallSlots,
    });
  }

  // Record valid bid
  state.auction.currentBid = amount;
  state.auction.selectedHouseId = house.id;
  state.auction.status = 'live';
  state.auction.bidHistory.push({
    id: generateId('bid'),
    houseId: house.id,
    houseName: house.name,
    amount,
    placedBy: req.actorRole || 'admin',
    createdAt: new Date().toISOString(),
  });

  // Check Freeze Card Unfreeze Condition:
  // "House B remains frozen until a different house (House C or D) makes a bid."
  let unfrozenHouseName = null;
  if (
    state.auction.frozenHouseId &&
    house.id !== state.auction.frozenHouseId &&
    house.id !== state.auction.frozenByHouseId
  ) {
    const unfrozenHouse = state.houses.find((h) => h.id === state.auction.frozenHouseId);
    unfrozenHouseName = unfrozenHouse ? unfrozenHouse.name : state.auction.frozenHouseId;
    state.auction.frozenHouseId = null;
    state.auction.frozenByHouseId = null;
    addHistory(
      'house_unfrozen',
      `${unfrozenHouseName} is UNFROZEN after third-party bid by ${house.name}!`,
      { unfrozenHouseId: unfrozenHouse?.id, bidderHouseId: house.id }
    );
  }

  // Check Blind Bid Protocol Trigger:
  // - 23k Batch: Triggered if live bid reaches/exceeds 10,000 points.
  // - First-Team (One piece, Cook If you can, Three Muggles): Triggered if live bid reaches/exceeds 15,000 points.
  let blindBidTriggered = false;
  if (
    state.auction.isBlindBidRound &&
    state.auction.blindBidThreshold &&
    amount >= state.auction.blindBidThreshold
  ) {
    state.auction.isBlindBidActive = true;
    blindBidTriggered = true;
  }

  addHistory(
    'bid_updated',
    `${house.name} bid ${amount.toLocaleString()} pts on ${currentTeam.name}${
      blindBidTriggered ? ' — 🔇 BLIND BID PROTOCOL INITIATED!' : ''
    }`,
    {
      teamId: currentTeam.id,
      amount,
      houseId: house.id,
      blindBidTriggered,
    }
  );

  replaceState(state);
  emitUpdate(req);

  const io = req.app.get('io');
  io.emit('auction:bid', {
    teamId: currentTeam.id,
    teamName: currentTeam.name,
    houseId: house.id,
    houseName: house.name,
    amount,
    unfrozenHouseName,
    blindBidTriggered,
  });

  if (blindBidTriggered) {
    io.emit('auction:blind_bid_initiated', {
      teamId: currentTeam.id,
      teamName: currentTeam.name,
      threshold: state.auction.blindBidThreshold,
      ruleLabel: state.auction.blindBidRuleLabel,
    });
  }

  return res.json({
    success: true,
    amount,
    houseId: house.id,
    unfrozenHouseName,
    blindBidTriggered,
  });
}

router.post('/auction/bid', ensureAdminOrCaptain, handlePlaceBid);
router.post('/auction/update-bid', ensureAdminOrCaptain, handlePlaceBid);

router.post('/auction/undo-last-bid', ensureAdmin, (req, res) => {
  const state = getState();
  if (!state.auction.currentTeamId) {
    return res.status(400).json({ error: 'No active team on stage.' });
  }

  state.auction.bidHistory.pop();
  const previousBid = state.auction.bidHistory[state.auction.bidHistory.length - 1] || null;

  state.auction.currentBid = previousBid ? previousBid.amount : 0;
  state.auction.selectedHouseId = previousBid ? previousBid.houseId : null;

  if (
    state.auction.isBlindBidActive &&
    (!state.auction.blindBidThreshold || state.auction.currentBid < state.auction.blindBidThreshold)
  ) {
    state.auction.isBlindBidActive = false;
    state.auction.blindBids = {};
  }

  addHistory(
    'bid_undone',
    previousBid
      ? `Last bid undone. Reverted to ${previousBid.amount.toLocaleString()} pts by ${previousBid.houseName}.`
      : 'Last bid undone. Stage reset to opening bid (0 pts).'
  );

  replaceState(state);
  emitUpdate(req);
  res.json({
    success: true,
    currentBid: state.auction.currentBid,
    selectedHouseId: state.auction.selectedHouseId,
  });
});

// ── Power Arsenal: Freeze Card Only (Quick Draw First-Press Atomic Lock) ──

router.post('/auction/freeze', ensureAdminOrCaptain, (req, res) => {
  const pressTimestampMs = Date.now();
  const pressIso = new Date(pressTimestampMs).toISOString();
  const state = getState();
  const currentTeam = state.teams.find((t) => t.id === state.auction.currentTeamId);
  if (!currentTeam) {
    return res.status(400).json({ error: 'No team is currently on stage.' });
  }

  // Rule: "Condition: Cannot be used during any round that involves a Blind Bid protocol."
  if (state.auction.isBlindBidRound || state.auction.isBlindBidActive) {
    return res.status(400).json({
      error: 'Freeze Card cannot be used during any round that involves a Blind Bid protocol.',
      code: 'BLIND_BID_ROUND_RESTRICTION',
    });
  }

  const sourceHouseId =
    req.actorRole === 'captain'
      ? req.captainHouseId
      : String(req.body?.sourceHouseId || req.body?.houseId || '').trim();
  const targetHouseId = String(req.body?.targetHouseId || '').trim();

  const sourceHouse = state.houses.find((h) => h.id === sourceHouseId);
  const targetHouse = state.houses.find((h) => h.id === targetHouseId);

  if (!sourceHouse || !targetHouse) {
    return res.status(400).json({ error: 'Both source House and target House must be selected.' });
  }
  if (sourceHouse.id === targetHouse.id) {
    return res.status(400).json({ error: 'A House cannot use a Freeze Card on itself.' });
  }

  // Quick Draw Priority Check 1: If this house was JUST frozen by a rival house milliseconds earlier,
  // they lost the Quick Draw and cannot use their Freeze Card while frozen!
  if (state.auction.frozenHouseId === sourceHouse.id) {
    const freezer = state.houses.find((h) => h.id === state.auction.frozenByHouseId);
    const diffMs = state.auction.freezeActivatedAtMs
      ? Math.max(1, pressTimestampMs - state.auction.freezeActivatedAtMs)
      : null;
    return res.status(400).json({
      error: `⚡ Quick Draw Lost! ${freezer ? freezer.name : 'Another house'} pressed Freeze first${
        diffMs ? ` (${diffMs}ms earlier)` : ''
      } and froze ${sourceHouse.name}!`,
      code: 'QUICK_DRAW_LOST',
    });
  }

  // Quick Draw Priority Check 2: If another freeze is already active on the floor, first press wins!
  if (state.auction.frozenHouseId) {
    const alreadyFrozen = state.houses.find((h) => h.id === state.auction.frozenHouseId);
    const freezer = state.houses.find((h) => h.id === state.auction.frozenByHouseId);
    const diffMs = state.auction.freezeActivatedAtMs
      ? Math.max(1, pressTimestampMs - state.auction.freezeActivatedAtMs)
      : null;
    return res.status(400).json({
      error: `⚡ Quick Draw Lost! ${freezer ? freezer.name : 'A house'} pressed Freeze first${
        diffMs ? ` (${diffMs}ms earlier)` : ''
      } — ${alreadyFrozen ? alreadyFrozen.name : 'a house'} is already frozen on the floor!`,
      code: 'QUICK_DRAW_LOST',
    });
  }

  if (sourceHouse.powerCards?.freeze?.used) {
    return res.status(400).json({ error: `${sourceHouse.name} has already used its Freeze Card.` });
  }

  // First house to press Freeze claims the atomic lock & permanently consumes their Freeze Card
  sourceHouse.powerCards.freeze = {
    used: true,
    usedOnHouseId: targetHouse.id,
    usedOnTeamId: currentTeam.id,
    usedAt: pressIso,
  };
  state.auction.frozenHouseId = targetHouse.id;
  state.auction.frozenByHouseId = sourceHouse.id;
  state.auction.freezeActivatedAtMs = pressTimestampMs;
  state.auction.freezeActivatedAt = pressIso;

  addHistory(
    'freeze_played',
    `❄ QUICK DRAW FREEZE: ${sourceHouse.name} pressed Freeze first and silenced ${targetHouse.name} on ${currentTeam.name}! (${targetHouse.name} is blocked until a 3rd house bids)`,
    {
      sourceHouseId: sourceHouse.id,
      targetHouseId: targetHouse.id,
      teamId: currentTeam.id,
      activatedAtMs: pressTimestampMs,
    }
  );

  replaceState(state);
  emitUpdate(req);
  req.app.get('io').emit('auction:freeze', {
    sourceHouseId: sourceHouse.id,
    sourceHouseName: sourceHouse.name,
    targetHouseId: targetHouse.id,
    targetHouseName: targetHouse.name,
    teamId: currentTeam.id,
    teamName: currentTeam.name,
    activatedAt: pressIso,
  });

  return res.json({
    success: true,
    sourceHouseId: sourceHouse.id,
    targetHouseId: targetHouse.id,
    activatedAt: pressIso,
  });
});

// ── Blind Bid Protocol Endpoints ───────────────────────────────────

router.post('/auction/trigger-blind-bid', ensureAdmin, (req, res) => {
  const state = getState();
  const currentTeam = state.teams.find((t) => t.id === state.auction.currentTeamId);
  if (!currentTeam) {
    return res.status(400).json({ error: 'No team is currently on stage.' });
  }

  const threshold =
    safeNumber(req.body?.threshold) ||
    state.auction.blindBidThreshold ||
    (currentTeam.batchId === 'batch-23k' ? 10000 : 15000);

  state.auction.isBlindBidRound = true;
  state.auction.blindBidThreshold = threshold;
  state.auction.isBlindBidActive = true;
  state.auction.frozenHouseId = null;
  state.auction.frozenByHouseId = null;

  addHistory(
    'blind_bid_triggered',
    `🔇 Blind Bid Protocol manually initiated on ${currentTeam.name} (Threshold: ${threshold.toLocaleString()} pts).`,
    { teamId: currentTeam.id, threshold }
  );

  replaceState(state);
  emitUpdate(req);
  req.app.get('io').emit('auction:blind_bid_initiated', {
    teamId: currentTeam.id,
    teamName: currentTeam.name,
    threshold,
    ruleLabel: state.auction.blindBidRuleLabel || `Blind Bid Trigger (@ ${threshold.toLocaleString()} pts)`,
  });

  res.json({ success: true, threshold });
});

router.post('/auction/blind-bid', ensureAdminOrCaptain, (req, res) => {
  const state = getState();
  const currentTeam = state.teams.find((t) => t.id === state.auction.currentTeamId);
  if (!currentTeam) {
    return res.status(400).json({ error: 'No team is currently on stage.' });
  }
  if (!state.auction.isBlindBidActive) {
    return res.status(400).json({ error: 'Blind Bid Protocol is not currently active.' });
  }

  const houseId =
    req.actorRole === 'captain'
      ? req.captainHouseId
      : String(req.body?.houseId || '').trim();
  const house = state.houses.find((h) => h.id === houseId);
  if (!house) {
    return res.status(404).json({ error: 'House not found.' });
  }

  const amount = safeNumber(req.body?.amount);
  const threshold = Number(state.auction.blindBidThreshold || 15000);
  const bidIncrement = getBidIncrement(state);

  if (amount === null || amount <= threshold) {
    return res.status(400).json({
      error: `Sealed blind bid must be strictly higher than the trigger amount (${threshold.toLocaleString()} pts — minimum ${(threshold + bidIncrement).toLocaleString()} pts).`,
    });
  }
  if (amount % bidIncrement !== 0) {
    return res.status(400).json({
      error: `Blind bid must be a multiple of ${bidIncrement.toLocaleString()} points.`,
    });
  }

  const batch = state.batches.find((b) => b.id === currentTeam.batchId);
  const metrics = getHouseMetrics(state, house.id);
  if (metrics.remainingOverallSlots <= 0) {
    return res.status(400).json({
      error: `${house.name} has no remaining overall slots.`,
    });
  }
  const currentBatchCount = metrics.slots[currentTeam.batchId] || 0;
  const batchQuota = Number(batch?.quota || 0);
  if (batch && currentBatchCount >= batchQuota) {
    return res.status(400).json({
      error: `${house.name} has already filled its ${batch.name} quota (${currentBatchCount}/${batchQuota}).`,
    });
  }

  if (amount > metrics.maxBid) {
    return res.status(400).json({
      error: 'Error: House lacks sufficient reserve points.',
      code: 'RESERVE_LIMIT_EXCEEDED',
      maxBid: metrics.maxBid,
    });
  }

  if (!state.auction.blindBids || typeof state.auction.blindBids !== 'object') {
    state.auction.blindBids = {};
  }

  state.auction.blindBids[house.id] = {
    houseId: house.id,
    houseName: house.name,
    amount,
    submittedAt: new Date().toISOString(),
  };

  addHistory(
    'blind_bid_submitted',
    `🔇 Sealed blind bid locked by ${house.name} for ${currentTeam.name}.`,
    { teamId: currentTeam.id, houseId: house.id }
  );

  replaceState(state);
  emitUpdate(req);
  return res.json({
    success: true,
    houseId: house.id,
    amount,
  });
});

router.post('/auction/resolve-blind-bid', ensureAdmin, (req, res) => {
  const state = getState();
  const currentTeam = state.teams.find((t) => t.id === state.auction.currentTeamId);
  if (!currentTeam) {
    return res.status(400).json({ error: 'No team is currently on stage.' });
  }

  const entries = Object.values(state.auction.blindBids || {});
  const explicitHouseId = String(req.body?.houseId || '').trim();
  const explicitAmount = safeNumber(req.body?.amount);

  let winningHouseId = explicitHouseId;
  let winningAmount = explicitAmount;

  if (!winningHouseId) {
    if (!entries.length) {
      return res.status(400).json({ error: 'No sealed blind bids have been submitted yet.' });
    }
    const sorted = [...entries].sort((a, b) => b.amount - a.amount);
    if (sorted.length > 1 && sorted[0].amount === sorted[1].amount) {
      return res.status(400).json({
        error: `Tie detected at ${sorted[0].amount.toLocaleString()} pts between ${sorted
          .filter((e) => e.amount === sorted[0].amount)
          .map((e) => e.houseName)
          .join(' & ')}. Select the tie-break winning House explicitly.`,
        code: 'BLIND_BID_TIE',
      });
    }
    winningHouseId = sorted[0].houseId;
    winningAmount = sorted[0].amount;
  } else if (winningAmount === null) {
    const recorded = state.auction.blindBids?.[winningHouseId];
    if (!recorded) {
      return res.status(400).json({ error: 'No blind bid found for the selected House.' });
    }
    winningAmount = recorded.amount;
  }

  const house = state.houses.find((h) => h.id === winningHouseId);
  if (!house) {
    return res.status(404).json({ error: 'Winning house not found.' });
  }

  const metrics = getHouseMetrics(state, house.id);
  if (winningAmount > metrics.maxBid) {
    return res.status(400).json({
      error: 'Error: House lacks sufficient reserve points.',
      code: 'RESERVE_LIMIT_EXCEEDED',
      maxBid: metrics.maxBid,
    });
  }

  const transaction = executeSoldTransaction(req, state, {
    team: currentTeam,
    house,
    amount: winningAmount,
    viaBlindBid: true,
  });

  return res.json({
    success: true,
    transaction,
    team: currentTeam,
    house,
    amount: winningAmount,
  });
});

// ── Confirm Sold & Post-Sold Corrections ───────────────────────────

router.post('/auction/confirm', ensureAdmin, (req, res) => {
  const state = getState();
  const team = state.teams.find((item) => item.id === state.auction.currentTeamId);
  const houseId = String(req.body?.houseId || state.auction.selectedHouseId || '');
  const amount = safeNumber(req.body?.amount ?? state.auction.currentBid);
  const basePrice = getBasePrice(state);
  const bidIncrement = getBidIncrement(state);

  if (!team) {
    return res.status(400).json({ error: 'No team is selected for auction.' });
  }
  if (!houseId) {
    return res.status(400).json({ error: 'A winning house is required.' });
  }
  if (team.assignedHouseId) {
    return res.status(400).json({ error: 'This team is already assigned to a house.' });
  }
  if (amount === null || amount < basePrice) {
    return res.status(400).json({ error: `The minimum bid per team is ${basePrice.toLocaleString()} points.` });
  }
  if (amount % bidIncrement !== 0) {
    return res.status(400).json({ error: `Points must be a multiple of ${bidIncrement.toLocaleString()}.` });
  }

  const house = state.houses.find((item) => item.id === houseId);
  if (!house) {
    return res.status(404).json({ error: 'House not found.' });
  }
  if (state.auction.frozenHouseId === house.id) {
    return res.status(400).json({ error: `${house.name} is currently frozen and cannot acquire this team.` });
  }

  const batch = state.batches.find((b) => b.id === team.batchId);
  const metrics = getHouseMetrics(state, house.id);
  if (metrics.remainingOverallSlots <= 0) {
    return res.status(400).json({ error: `${house.name} has already drafted all ${metrics.totalQuota} teams.` });
  }
  const currentBatchCount = metrics.slots[team.batchId] || 0;
  const batchQuota = Number(batch?.quota || 0);
  if (batch && currentBatchCount >= batchQuota) {
    return res.status(400).json({
      error: `${house.name} has already filled its ${batch.name} quota (${currentBatchCount}/${batchQuota}).`,
    });
  }

  if (amount > metrics.maxBid) {
    return res.status(400).json({
      error: 'Error: House lacks sufficient reserve points.',
      code: 'RESERVE_LIMIT_EXCEEDED',
      maxBid: metrics.maxBid,
    });
  }

  const transaction = executeSoldTransaction(req, state, {
    team,
    house,
    amount,
    viaRTM: false,
    viaBlindBid: Boolean(state.auction.isBlindBidActive),
  });

  return res.json({ success: true, transaction, team, house });
});

router.post('/auction/reverse-transaction/:id', ensureAdmin, (req, res) => {
  const state = getState();
  const transaction = state.transactions.find((tx) => tx.id === req.params.id && tx.status === 'confirmed');

  if (!transaction) {
    return res.status(404).json({ error: 'Confirmed transaction not found.' });
  }

  const team = state.teams.find((item) => item.id === transaction.teamId);
  const house = state.houses.find((item) => item.id === transaction.houseId);

  transaction.status = 'reversed';
  transaction.reversedAt = new Date().toISOString();
  transaction.updatedAt = transaction.reversedAt;
  transaction.note = 'Reversed by admin correction.';

  if (team) {
    team.status = 'unsold';
    team.assignedHouseId = null;
    team.assignedTransactionId = null;
  }

  // If this transaction consumed an RTM card on this team, restore the RTM card
  if (transaction.viaRTM && house && house.powerCards?.rtm?.usedOnTeamId === transaction.teamId) {
    house.powerCards.rtm = {
      used: false,
      usedOnTeamId: null,
      amount: null,
      usedAt: null,
    };
  }

  addHistory(
    'auction_reversed',
    `${team ? team.name : 'Team'} assignment reversed from ${house ? house.name : 'house'}.`,
    {
      transactionId: transaction.id,
      teamId: transaction.teamId,
      houseId: transaction.houseId,
    }
  );

  replaceState(state);
  emitUpdate(req);
  req.app.get('io').emit('auction:reversed', { transactionId: transaction.id });
  res.json({ success: true, transaction, team, house });
});

router.post('/transactions/:id/revise-amount', ensureAdmin, (req, res) => {
  const state = getState();
  const transaction = state.transactions.find((tx) => tx.id === req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }
  if (transaction.status !== 'confirmed') {
    return res.status(400).json({ error: 'Only confirmed transactions can be revised.' });
  }

  const basePrice = getBasePrice(state);
  const bidIncrement = getBidIncrement(state);
  const amount = safeNumber(req.body?.amount);
  if (amount === null || amount < basePrice || amount % bidIncrement !== 0) {
    return res.status(400).json({
      error: `Amount must be at least ${basePrice.toLocaleString()} and a multiple of ${bidIncrement.toLocaleString()} points.`,
    });
  }

  const metrics = getHouseMetrics(state, transaction.houseId, transaction.id);
  if (!transaction.viaRTM && amount > metrics.maxBid) {
    return res.status(400).json({ error: 'Error: House lacks sufficient reserve points.' });
  }

  const previousAmount = transaction.amount;
  transaction.amount = amount;
  transaction.updatedAt = new Date().toISOString();
  transaction.note = `Amount corrected from ${previousAmount} to ${amount}.`;

  addHistory(
    'amount_corrected',
    `Amount corrected from ${previousAmount.toLocaleString()} to ${amount.toLocaleString()} pts.`,
    {
      transactionId: transaction.id,
      previousAmount,
      newAmount: amount,
    }
  );

  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, transaction });
});

// ── Admin Floor Overrides (Freeze, Power Cards, House Config, Settings) ──

router.post('/admin/houses/:id/freeze', ensureAdmin, (req, res) => {
  const state = getState();
  const house = state.houses.find((h) => h.id === req.params.id);
  if (!house) {
    return res.status(404).json({ error: 'House not found.' });
  }

  const currentlyFrozen = state.auction.frozenHouseId === house.id;
  const shouldFreeze = req.body?.frozen !== undefined ? Boolean(req.body.frozen) : !currentlyFrozen;

  if (shouldFreeze) {
    state.auction.frozenHouseId = house.id;
    state.auction.frozenByHouseId = req.body?.frozenByHouseId || null;
  } else if (state.auction.frozenHouseId === house.id) {
    state.auction.frozenHouseId = null;
    state.auction.frozenByHouseId = null;
  }

  addHistory(
    shouldFreeze ? 'house_frozen' : 'house_unfrozen',
    `${house.name} ${shouldFreeze ? 'frozen' : 'unfrozen'} by host override.`,
    { houseId: house.id, frozen: shouldFreeze }
  );
  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, houseId: house.id, frozen: shouldFreeze });
});

router.post('/admin/houses/:id/power-card', ensureAdmin, (req, res) => {
  const state = getState();
  const house = state.houses.find((h) => h.id === req.params.id);
  if (!house) {
    return res.status(404).json({ error: 'House not found.' });
  }

  const cardType = String(req.body?.cardType || 'freeze').trim();
  if (cardType !== 'freeze') {
    return res.status(400).json({ error: 'Invalid cardType. Only "freeze" card is enabled.' });
  }

  if (!house.powerCards) {
    house.powerCards = buildDefaultPowerCards();
  }

  const nextUsed = req.body?.used !== undefined ? Boolean(req.body.used) : !house.powerCards[cardType]?.used;
  house.powerCards[cardType] = {
    ...house.powerCards[cardType],
    used: nextUsed,
    usedAt: nextUsed ? new Date().toISOString() : null,
  };

  if (!nextUsed && cardType === 'freeze' && state.auction.frozenByHouseId === house.id) {
    state.auction.frozenHouseId = null;
    state.auction.frozenByHouseId = null;
  }

  addHistory(
    'power_card_toggled',
    `${house.name} ${cardType.toUpperCase()} card marked as ${nextUsed ? 'USED' : 'AVAILABLE'} by host.`,
    { houseId: house.id, cardType, used: nextUsed }
  );

  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, houseId: house.id, cardType, used: nextUsed });
});

router.post('/admin/houses/:id/config', ensureAdmin, (req, res) => {
  const state = getState();
  const house = state.houses.find((h) => h.id === req.params.id);
  if (!house) {
    return res.status(404).json({ error: 'House not found.' });
  }

  if (req.body?.name) house.name = String(req.body.name).trim();
  if (req.body?.username) house.username = String(req.body.username).trim().toLowerCase();
  if (req.body?.captainTeamName !== undefined) {
    house.captainTeamName = String(req.body.captainTeamName).trim();
  }
  if (req.body?.flagUrl !== undefined) {
    house.flagUrl = String(req.body.flagUrl).trim();
  }
  const newPass = String(req.body?.newPassword || req.body?.accessPin || '').trim();
  if (newPass) {
    house.passwordHash = hashPassword(newPass);
    syncUserToSupabaseAuth(house.username || house.id, newPass, {
      role: 'captain',
      houseId: house.id,
      houseName: house.name,
    }).catch(() => {});
  }

  addHistory('house_configured', `Updated configuration/credentials for ${house.name}.`, {
    houseId: house.id,
  });
  replaceState(state);
  emitUpdate(req);
  const { passwordHash, accessPin, ...safeHouse } = house;
  res.json({ success: true, house: safeHouse });
});

router.post('/admin/security/config', ensureAdmin, (req, res) => {
  const state = getState();
  if (!state.settings) state.settings = {};

  if (req.body?.adminUsername) {
    state.settings.adminUsername = String(req.body.adminUsername).trim().toLowerCase();
  }
  if (req.body?.newAdminPassword && String(req.body.newAdminPassword).trim().length >= 4) {
    const cleanPass = String(req.body.newAdminPassword).trim();
    state.settings.adminPasswordHash = hashPassword(cleanPass);
    syncUserToSupabaseAuth(state.settings.adminUsername || 'admin', cleanPass, {
      role: 'admin',
    }).catch(() => {});
  }
  if (req.body?.supabaseUrl !== undefined) {
    state.settings.supabaseUrl = String(req.body.supabaseUrl).trim();
  }
  if (req.body?.supabaseAnonKey !== undefined) {
    state.settings.supabaseAnonKey = String(req.body.supabaseAnonKey).trim();
  }
  if (req.body?.canvaFlagsLink !== undefined) {
    state.settings.canvaFlagsLink = String(req.body.canvaFlagsLink).trim();
  }

  addHistory('security_updated', 'Admin security & authentication configuration updated.');
  replaceState(state);
  emitUpdate(req);
  res.json({
    success: true,
    supabaseEnabled: Boolean(state.settings.supabaseUrl && state.settings.supabaseAnonKey),
    canvaFlagsLink: state.settings.canvaFlagsLink,
  });
});

router.post('/admin/settings/house-point-limit', ensureAdmin, (req, res) => {
  const state = getState();
  const limit = Number(req.body?.limit);
  if (!Number.isFinite(limit) || limit < 50000 || limit % 1000 !== 0) {
    return res.status(400).json({ error: 'Point limit must be at least 50,000 and a multiple of 1,000.' });
  }
  if (!state.settings) state.settings = {};
  state.settings.housePointLimit = limit;
  addHistory('point_limit_changed', `House point limit set to ${limit.toLocaleString()} pts.`, { limit });
  replaceState(state);
  emitUpdate(req);
  res.json({ success: true, limit });
});

router.post('/reset', ensureAdmin, (req, res) => {
  const reseedDefaultTeams = Boolean(req.body?.reseedDefaultTeams);
  const fresh = resetStore({ reseedDefaultTeams });
  req.app.get('io').emit('auction:reset', { message: 'Auction reset.' });
  emitUpdate(req);
  res.json({ success: true, state: fresh });
});

module.exports = router;
