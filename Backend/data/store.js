const fs = require('fs');
const path = require('path');
const {
  HOUSE_POINT_LIMIT,
  BASE_PRICE,
  BID_INCREMENT,
  TOTAL_SLOTS_PER_HOUSE,
  BATCH_CONFIGS,
  calculateMaxBid,
  getHouseSlotSummary,
  getTeamBlindBidInfo,
} = require('../utils/bidUtils');
const { hashPassword } = require('../utils/authUtils');
const {
  saveAuctionStateToSupabase,
  loadAuctionStateFromSupabase,
} = require('../utils/supabaseClient');

const DEFAULT_CANVA_FLAGS_LINK = 'https://canva.link/azdy8wx9bki207b';

const HOUSE_BLUEPRINTS = [
  {
    id: 'gryffindor',
    username: 'gryffindor',
    name: 'Gryffindor',
    captainTeamName: '23k Top Seed #1',
    passwordHash: hashPassword('1111', 'salt-gryffindor'),
    flagUrl: '',
    color: '#d83d2f',
    accent: '#f7d16b',
    crest: 'G',
  },
  {
    id: 'slytherin',
    username: 'slytherin',
    name: 'Slytherin',
    captainTeamName: '23k Top Seed #2',
    passwordHash: hashPassword('2222', 'salt-slytherin'),
    flagUrl: '',
    color: '#2d9a5d',
    accent: '#b6d7a8',
    crest: 'S',
  },
  {
    id: 'ravenclaw',
    username: 'ravenclaw',
    name: 'Ravenclaw',
    captainTeamName: '23k Top Seed #3',
    passwordHash: hashPassword('3333', 'salt-ravenclaw'),
    flagUrl: '',
    color: '#3f6dbd',
    accent: '#d4dff7',
    crest: 'R',
  },
  {
    id: 'hufflepuff',
    username: 'hufflepuff',
    name: 'Hufflepuff',
    captainTeamName: '23k Top Seed #4',
    passwordHash: hashPassword('4444', 'salt-hufflepuff'),
    flagUrl: '',
    color: '#d7a236',
    accent: '#f4ebc0',
    crest: 'H',
  },
];

const DEFAULT_BATCHES = BATCH_CONFIGS;

// Use /tmp/auction.db on Vercel serverless (writable), and .db locally so nodemon never restarts on save!
const DATA_FILE =
  process.env.DATA_FILE ||
  (process.env.VERCEL
    ? path.join('/tmp', 'auction.db')
    : path.join(__dirname, 'auction.db'));

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildDefaultPowerCards() {
  return {
    freeze: {
      used: false,
      usedOnHouseId: null,
      usedOnTeamId: null,
      usedAt: null,
    },
    rtm: {
      used: false,
      usedOnTeamId: null,
      amount: null,
      usedAt: null,
    },
  };
}

function buildSeedTeams() {
  const now = new Date().toISOString();
  const teams = [];

  // 26k Batch: 16 teams (First team: "One piece")
  teams.push({
    id: 'team-26k-01',
    name: 'One piece',
    batchId: 'batch-26k',
    isFirstTeam: true,
    isCaptain: false,
    status: 'unsold',
    assignedHouseId: null,
    assignedTransactionId: null,
    createdAt: now,
  });
  for (let i = 2; i <= 16; i += 1) {
    const num = String(i).padStart(2, '0');
    teams.push({
      id: `team-26k-${num}`,
      name: `26k Team ${num}`,
      batchId: 'batch-26k',
      isFirstTeam: false,
      isCaptain: false,
      status: 'unsold',
      assignedHouseId: null,
      assignedTransactionId: null,
      createdAt: now,
    });
  }

  // 25k Batch: 12 teams (First team: "Cook If you can")
  teams.push({
    id: 'team-25k-01',
    name: 'Cook If you can',
    batchId: 'batch-25k',
    isFirstTeam: true,
    isCaptain: false,
    status: 'unsold',
    assignedHouseId: null,
    assignedTransactionId: null,
    createdAt: now,
  });
  for (let i = 2; i <= 12; i += 1) {
    const num = String(i).padStart(2, '0');
    teams.push({
      id: `team-25k-${num}`,
      name: `25k Team ${num}`,
      batchId: 'batch-25k',
      isFirstTeam: false,
      isCaptain: false,
      status: 'unsold',
      assignedHouseId: null,
      assignedTransactionId: null,
      createdAt: now,
    });
  }

  // 24k Batch: 12 teams (First team: "Three Muggles")
  teams.push({
    id: 'team-24k-01',
    name: 'Three Muggles',
    batchId: 'batch-24k',
    isFirstTeam: true,
    isCaptain: false,
    status: 'unsold',
    assignedHouseId: null,
    assignedTransactionId: null,
    createdAt: now,
  });
  for (let i = 2; i <= 12; i += 1) {
    const num = String(i).padStart(2, '0');
    teams.push({
      id: `team-24k-${num}`,
      name: `24k Team ${num}`,
      batchId: 'batch-24k',
      isFirstTeam: false,
      isCaptain: false,
      status: 'unsold',
      assignedHouseId: null,
      assignedTransactionId: null,
      createdAt: now,
    });
  }

  // 23k Batch: 4 auction teams (All trigger Blind Bid @ 10,000 pts)
  for (let i = 1; i <= 4; i += 1) {
    const num = String(i).padStart(2, '0');
    teams.push({
      id: `team-23k-${num}`,
      name: `23k Finalist ${num}`,
      batchId: 'batch-23k',
      isFirstTeam: false,
      isCaptain: false,
      status: 'unsold',
      assignedHouseId: null,
      assignedTransactionId: null,
      createdAt: now,
    });
  }

  return teams;
}

function buildDefaultAuctionState() {
  return {
    currentTeamId: null,
    currentBid: 0,
    selectedHouseId: null,
    status: 'idle',
    startedAt: null,
    isBlindBidRound: false,
    blindBidThreshold: null,
    blindBidRuleLabel: null,
    isBlindBidActive: false,
    blindBids: {},
    frozenHouseId: null,
    frozenByHouseId: null,
    bidHistory: [],
  };
}

function buildDefaultState() {
  return {
    settings: {
      housePointLimit: HOUSE_POINT_LIMIT,
      basePrice: BASE_PRICE,
      bidIncrement: BID_INCREMENT,
      totalSlotsPerHouse: TOTAL_SLOTS_PER_HOUSE,
      canvaFlagsLink: DEFAULT_CANVA_FLAGS_LINK,
      adminUsername: 'admin',
      adminPasswordHash: hashPassword(process.env.ADMIN_KEY || 'admin123', 'salt-admin'),
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    },
    houses: HOUSE_BLUEPRINTS.map((house) => ({
      ...house,
      pointLimit: HOUSE_POINT_LIMIT,
      totalSpent: 0,
      acquiredTeams: [],
      powerCards: buildDefaultPowerCards(),
    })),
    batches: clone(DEFAULT_BATCHES),
    teams: buildSeedTeams(),
    transactions: [],
    history: [
      {
        id: generateId('history'),
        type: 'system',
        message: 'Coders Cup Live Auction system initialized (150k purse, 44 teams across 26k/25k/24k/23k).',
        createdAt: new Date().toISOString(),
        meta: {},
      },
    ],
    auction: buildDefaultAuctionState(),
  };
}

function normalizeBatchId(rawBatchId) {
  const map = {
    'batch-1': 'batch-26k',
    'batch-2': 'batch-25k',
    'batch-3': 'batch-24k',
    'batch-4': 'batch-23k',
  };
  return map[rawBatchId] || rawBatchId || 'batch-26k';
}

function normalizeState(raw) {
  const base = buildDefaultState();
  const source = raw && typeof raw === 'object' ? raw : {};
  const pointLimit = Number(source.settings?.housePointLimit) || HOUSE_POINT_LIMIT;
  const basePrice = Number(source.settings?.basePrice) || BASE_PRICE;
  const bidIncrement = Number(source.settings?.bidIncrement) || BID_INCREMENT;

  const batches = clone(DEFAULT_BATCHES).map((defaultBatch, index) => {
    const existing = Array.isArray(source.batches)
      ? source.batches.find((b) => normalizeBatchId(b.id) === defaultBatch.id)
      : null;
    return {
      ...defaultBatch,
      ...(existing ? { firstTeamName: existing.firstTeamName ?? defaultBatch.firstTeamName } : {}),
      id: defaultBatch.id,
      code: defaultBatch.code,
      name: defaultBatch.name,
      quota: Number(existing?.quota || defaultBatch.quota),
      totalTeams: Number(existing?.totalTeams || defaultBatch.totalTeams),
      blindBidRule: existing?.blindBidRule || defaultBatch.blindBidRule,
      blindBidThreshold: Number(existing?.blindBidThreshold || defaultBatch.blindBidThreshold),
      order: index + 1,
    };
  });

  const houses = HOUSE_BLUEPRINTS.map((blueprint, index) => {
    const existing = Array.isArray(source.houses)
      ? source.houses.find((h) => h.id === blueprint.id) || source.houses[index]
      : null;
    const rawPower = existing?.powerCards || {};
    let passwordHash = existing?.passwordHash || blueprint.passwordHash;
    if (!existing?.passwordHash && existing?.accessPin) {
      passwordHash = hashPassword(String(existing.accessPin), `salt-${blueprint.id}`);
    }
    const { accessPin, flagUrl: _oldFlag, ...cleanExisting } = existing || {};
    return {
      ...blueprint,
      ...cleanExisting,
      id: blueprint.id,
      username: String(existing?.username || blueprint.username),
      name: String(existing?.name || blueprint.name),
      captainTeamName: String(existing?.captainTeamName || blueprint.captainTeamName),
      passwordHash,
      pointLimit,
      totalSpent: Number(existing?.totalSpent || 0),
      acquiredTeams: Array.isArray(existing?.acquiredTeams) ? existing.acquiredTeams : [],
      powerCards: {
        freeze: {
          used: Boolean(rawPower.freeze?.used),
          usedOnHouseId: rawPower.freeze?.usedOnHouseId || null,
          usedOnTeamId: rawPower.freeze?.usedOnTeamId || null,
          usedAt: rawPower.freeze?.usedAt || null,
        },
        rtm: {
          used: Boolean(rawPower.rtm?.used),
          usedOnTeamId: rawPower.rtm?.usedOnTeamId || null,
          amount: rawPower.rtm?.amount !== undefined ? Number(rawPower.rtm.amount) : null,
          usedAt: rawPower.rtm?.usedAt || null,
        },
      },
    };
  });

  const teams = Array.isArray(source.teams) && source.teams.length > 0
    ? source.teams.map((team) => {
        const batchId = normalizeBatchId(team.batchId);
        const batchCfg = batches.find((b) => b.id === batchId);
        const isFirstByName = Boolean(
          batchCfg?.firstTeamName &&
          String(team.name || '').trim().toLowerCase() === String(batchCfg.firstTeamName).trim().toLowerCase()
        );
        return {
          id: team.id || generateId('team'),
          name: String(team.name || 'Unnamed Team'),
          batchId,
          isFirstTeam: Boolean(team.isFirstTeam || isFirstByName),
          isCaptain: Boolean(team.isCaptain),
          status: team.status || 'unsold',
          assignedHouseId: team.assignedHouseId || null,
          assignedTransactionId: team.assignedTransactionId || null,
          createdAt: team.createdAt || new Date().toISOString(),
        };
      })
    : clone(base.teams);

  const transactions = Array.isArray(source.transactions)
    ? source.transactions.map((tx) => ({
        id: tx.id || generateId('txn'),
        teamId: tx.teamId,
        houseId: tx.houseId,
        amount: Number(tx.amount || 0),
        status: tx.status || 'confirmed',
        viaRTM: Boolean(tx.viaRTM),
        viaBlindBid: Boolean(tx.viaBlindBid),
        createdAt: tx.createdAt || new Date().toISOString(),
        updatedAt: tx.updatedAt || tx.createdAt || new Date().toISOString(),
        reversedAt: tx.reversedAt || null,
        note: tx.note || '',
      }))
    : [];

  const history = Array.isArray(source.history) && source.history.length > 0
    ? source.history.map((entry) => ({
        id: entry.id || generateId('history'),
        type: entry.type || 'system',
        message: String(entry.message || 'System update'),
        createdAt: entry.createdAt || new Date().toISOString(),
        meta: entry.meta || {},
      }))
    : clone(base.history);

  const rawAuction = source.auction || {};
  const currentTeam = rawAuction.currentTeamId
    ? teams.find((t) => t.id === rawAuction.currentTeamId) || null
    : null;
  const blindInfo = currentTeam
    ? getTeamBlindBidInfo(currentTeam, batches, teams)
    : { isBlindBidRound: false, blindBidThreshold: null, ruleLabel: null };

  return {
    settings: {
      housePointLimit: pointLimit,
      basePrice,
      bidIncrement,
      totalSlotsPerHouse: TOTAL_SLOTS_PER_HOUSE,
      canvaFlagsLink: String(source.settings?.canvaFlagsLink || DEFAULT_CANVA_FLAGS_LINK),
      adminUsername: String(source.settings?.adminUsername || 'admin'),
      adminPasswordHash:
        source.settings?.adminPasswordHash ||
        hashPassword(process.env.ADMIN_KEY || 'admin123', 'salt-admin'),
      supabaseUrl: String(source.settings?.supabaseUrl || process.env.SUPABASE_URL || ''),
      supabaseAnonKey: String(
        source.settings?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || ''
      ),
    },
    houses,
    batches,
    teams,
    transactions,
    history,
    auction: {
      currentTeamId: currentTeam ? currentTeam.id : null,
      currentBid: Number(rawAuction.currentBid || 0),
      selectedHouseId: rawAuction.selectedHouseId || null,
      status: currentTeam ? (rawAuction.status || 'live') : 'idle',
      startedAt: rawAuction.startedAt || null,
      isBlindBidRound: blindInfo.isBlindBidRound,
      blindBidThreshold: blindInfo.blindBidThreshold,
      blindBidRuleLabel: blindInfo.ruleLabel,
      isBlindBidActive: Boolean(rawAuction.isBlindBidActive),
      blindBids: rawAuction.blindBids && typeof rawAuction.blindBids === 'object' ? rawAuction.blindBids : {},
      frozenHouseId: rawAuction.frozenHouseId || null,
      frozenByHouseId: rawAuction.frozenByHouseId || null,
      bidHistory: Array.isArray(rawAuction.bidHistory) ? rawAuction.bidHistory : [],
    },
  };
}

function ensureFileExists(filePath) {
  try {
    const folder = path.dirname(filePath);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(buildDefaultState(), null, 2));
    }
  } catch (err) {
    console.warn('Warning: could not initialize data file on disk:', err.message);
  }
}

let state = null;
let pendingSaveTimer = null;

function loadState() {
  ensureFileExists(DATA_FILE);
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) {
      state = buildDefaultState();
      saveState(state);
      return clone(state);
    }
    state = normalizeState(JSON.parse(raw));
    saveState(state);
    return clone(state);
  } catch (error) {
    console.warn('Falling back to default store state:', error.message);
    state = buildDefaultState();
    saveState(state);
    return clone(state);
  }
}

function saveState(nextState) {
  const value = nextState || state;
  state = value;
  const serialized = JSON.stringify(value, null, 2);
  try {
    fs.writeFileSync(DATA_FILE, serialized);
  } catch (err) {
    console.warn('Transient file lock on store.json, scheduling background retry:', err.message);
    if (pendingSaveTimer) clearTimeout(pendingSaveTimer);
    pendingSaveTimer = setTimeout(() => {
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
      } catch (_) {}
    }, 250);
  }
  // Background sync to Supabase Postgres (for Vercel serverless cloud persistence)
  saveAuctionStateToSupabase(value).catch(() => {});
  return clone(value);
}

async function hydrateFromSupabaseIfAvailable() {
  try {
    const cloudState = await loadAuctionStateFromSupabase();
    if (cloudState && typeof cloudState === 'object') {
      state = normalizeState(cloudState);
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
      } catch (_) {}
      return true;
    }
  } catch (_) {}
  return false;
}

function getState() {
  if (!state) {
    state = loadState();
  }
  return clone(state);
}

let lastAddedHistory = [];

function replaceState(nextState) {
  if (lastAddedHistory.length > 0 && Array.isArray(nextState.history)) {
    const existingIds = new Set(nextState.history.map((h) => h.id));
    for (const entry of lastAddedHistory) {
      if (!existingIds.has(entry.id)) {
        nextState.history.push(entry);
      }
    }
    nextState.history = nextState.history.slice(-200);
    lastAddedHistory = [];
  }
  const normalized = normalizeState(nextState);
  state = normalized;
  saveState(normalized);
  return clone(normalized);
}

function buildPublicSnapshot(options = {}) {
  const includeBlindAmounts = Boolean(options.includeBlindAmounts);
  const currentState = getState();
  const pointLimit = currentState.settings?.housePointLimit || HOUSE_POINT_LIMIT;
  const basePrice = currentState.settings?.basePrice || BASE_PRICE;

  const teams = currentState.teams.map((team) => {
    const blindInfo = getTeamBlindBidInfo(team, currentState.batches, currentState.teams);
    return {
      ...team,
      isBlindBidEligible: blindInfo.isBlindBidRound,
      blindBidThreshold: blindInfo.blindBidThreshold,
      blindBidRuleLabel: blindInfo.ruleLabel,
    };
  });

  const houseSummary = currentState.houses.map((house) => {
    const slotInfo = getHouseSlotSummary(house.id, teams, currentState.batches);
    const totalSpent = currentState.transactions
      .filter((tx) => tx.houseId === house.id && tx.status === 'confirmed')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    // Note: Do NOT clamp remainingPoints to 0 because Absolute RTM can put a house in negative balance!
    const remainingPoints = pointLimit - totalSpent;
    const maxBid = calculateMaxBid(remainingPoints, slotInfo.remainingOverallSlots, basePrice);
    const reservePoints =
      slotInfo.remainingOverallSlots > 0
        ? Math.max(0, (slotInfo.remainingOverallSlots - 1) * basePrice)
        : 0;
    const isFrozen = currentState.auction.frozenHouseId === house.id;
    const frozenByHouse = isFrozen && currentState.auction.frozenByHouseId
      ? currentState.houses.find((h) => h.id === currentState.auction.frozenByHouseId)?.name || currentState.auction.frozenByHouseId
      : null;

    const { accessPin, passwordHash, ...publicHouse } = house;

    return {
      ...publicHouse,
      hasPassword: Boolean(passwordHash),
      pointLimit,
      totalSpent,
      purse: remainingPoints,
      remainingPoints,
      maxBid,
      reservePoints,
      basePrice,
      slots: slotInfo.slots,
      quotas: slotInfo.quotas,
      acquiredTeams: slotInfo.acquiredTeamIds,
      acquiredCount: slotInfo.acquiredCount,
      totalQuota: slotInfo.totalQuota,
      remainingOverallSlots: slotInfo.remainingOverallSlots,
      frozen: isFrozen,
      frozenByHouseId: isFrozen ? currentState.auction.frozenByHouseId : null,
      frozenByHouseName: frozenByHouse,
    };
  });

  const currentTeam = currentState.auction.currentTeamId
    ? teams.find((team) => team.id === currentState.auction.currentTeamId) || null
    : null;

  const rawBlindBids = currentState.auction.blindBids || {};
  const publicBlindBids = {};
  Object.keys(rawBlindBids).forEach((hId) => {
    publicBlindBids[hId] = {
      houseId: hId,
      submitted: true,
      submittedAt: rawBlindBids[hId].submittedAt,
      ...(includeBlindAmounts ? { amount: rawBlindBids[hId].amount } : {}),
    };
  });

  const { adminPasswordHash, supabaseAnonKey, ...publicSettings } = currentState.settings || {};

  return {
    settings: {
      ...publicSettings,
      supabaseEnabled: Boolean(currentState.settings?.supabaseUrl && supabaseAnonKey),
    },
    houses: houseSummary,
    batches: currentState.batches,
    teams,
    transactions: currentState.transactions,
    history: currentState.history.slice(-50),
    auction: {
      ...currentState.auction,
      currentTeam,
      blindBids: publicBlindBids,
      blindBidCount: Object.keys(rawBlindBids).length,
    },
  };
}

function addHistory(type, message, meta = {}) {
  const entry = {
    id: generateId('history'),
    type,
    message,
    meta,
    createdAt: new Date().toISOString(),
  };
  lastAddedHistory.push(entry);
  if (!state) state = loadState();
  state.history.push(entry);
  state.history = state.history.slice(-200);
  return entry;
}

function resetStore(options = {}) {
  const reseedDefaultTeams = Boolean(options.reseedDefaultTeams);
  const current = getState();
  const freshState = buildDefaultState();
  freshState.settings = {
    ...current.settings,
    housePointLimit: HOUSE_POINT_LIMIT,
    basePrice: BASE_PRICE,
    bidIncrement: BID_INCREMENT,
  };
  freshState.houses = current.houses.map((h, idx) => ({
    ...HOUSE_BLUEPRINTS[idx % HOUSE_BLUEPRINTS.length],
    id: h.id,
    username: h.username || HOUSE_BLUEPRINTS[idx % HOUSE_BLUEPRINTS.length].username,
    name: h.name,
    captainTeamName:
      h.captainTeamName || HOUSE_BLUEPRINTS[idx % HOUSE_BLUEPRINTS.length].captainTeamName,
    passwordHash:
      h.passwordHash || HOUSE_BLUEPRINTS[idx % HOUSE_BLUEPRINTS.length].passwordHash,
    flagUrl: h.flagUrl || '',
    color: h.color,
    accent: h.accent,
    crest: h.crest,
    pointLimit: freshState.settings.housePointLimit,
    totalSpent: 0,
    acquiredTeams: [],
    powerCards: buildDefaultPowerCards(),
  }));

  if (!reseedDefaultTeams && current.teams.length > 0) {
    freshState.teams = current.teams.map((team) => ({
      ...team,
      status: 'unsold',
      assignedHouseId: null,
      assignedTransactionId: null,
    }));
  }

  freshState.history.push({
    id: generateId('history'),
    type: 'system',
    message: reseedDefaultTeams
      ? 'Auction reset and 44 default Coders Cup teams seeded.'
      : 'Auction reset. Teams retained, assignments & power cards cleared.',
    createdAt: new Date().toISOString(),
    meta: {},
  });
  state = freshState;
  saveState(freshState);
  return clone(freshState);
}

module.exports = {
  buildDefaultState,
  buildSeedTeams,
  buildDefaultPowerCards,
  buildDefaultAuctionState,
  getState,
  replaceState,
  saveState,
  hydrateFromSupabaseIfAvailable,
  resetStore,
  buildPublicSnapshot,
  addHistory,
  generateId,
  HOUSE_BLUEPRINTS,
  HOUSE_POINT_LIMIT,
  BASE_PRICE,
  BID_INCREMENT,
  TOTAL_SLOTS_PER_HOUSE,
  DEFAULT_BATCHES,
  DATA_FILE,
};
