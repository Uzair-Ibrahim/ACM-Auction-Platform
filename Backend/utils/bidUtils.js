const HOUSE_POINT_LIMIT = 150000;
const BASE_PRICE = 5000;
const BID_INCREMENT = 1000;
const TOTAL_SLOTS_PER_HOUSE = 11;

const BATCH_CONFIGS = [
  {
    id: 'batch-26k',
    code: '26k',
    name: '26k Batch',
    quota: 4,
    totalTeams: 16,
    blindBidRule: 'first_team',
    blindBidThreshold: 15000,
    firstTeamName: 'One piece',
    order: 1,
  },
  {
    id: 'batch-25k',
    code: '25k',
    name: '25k Batch',
    quota: 3,
    totalTeams: 12,
    blindBidRule: 'first_team',
    blindBidThreshold: 15000,
    firstTeamName: 'Cook If you can',
    order: 2,
  },
  {
    id: 'batch-24k',
    code: '24k',
    name: '24k Batch',
    quota: 3,
    totalTeams: 12,
    blindBidRule: 'first_team',
    blindBidThreshold: 15000,
    firstTeamName: 'Three Muggles',
    order: 3,
  },
  {
    id: 'batch-23k',
    code: '23k',
    name: '23k Batch',
    quota: 1,
    totalTeams: 4,
    blindBidRule: 'all_teams',
    blindBidThreshold: 10000,
    firstTeamName: null,
    order: 4,
  },
];

/**
 * Reserve Law Formula:
 *   max_bid = current_purse - ((remaining_overall_slots - 1) * 5000)
 *
 * Returns 0 if the house has filled all 11 overall slots or cannot afford at least 0.
 */
function calculateMaxBid(currentPurse, remainingOverallSlots, basePrice = BASE_PRICE) {
  if (remainingOverallSlots <= 0) return 0;
  const reserveNeeded = (remainingOverallSlots - 1) * basePrice;
  const maxBid = currentPurse - reserveNeeded;
  return Math.max(0, maxBid);
}

/**
 * Computes per-batch slot counts and overall acquired team count for a house.
 */
function getHouseSlotSummary(houseId, teams, batches = BATCH_CONFIGS) {
  const assignedTeams = teams.filter(
    (team) => team.assignedHouseId === houseId && team.status === 'assigned' && !team.isCaptain
  );

  const slots = {};
  const quotas = {};
  for (const batch of batches) {
    const count = assignedTeams.filter((team) => team.batchId === batch.id).length;
    slots[batch.id] = count;
    quotas[batch.id] = Number(batch.quota || 0);
  }

  const totalQuota = batches.reduce((sum, b) => sum + Number(b.quota || 0), 0) || TOTAL_SLOTS_PER_HOUSE;
  const acquiredCount = assignedTeams.length;
  const remainingOverallSlots = Math.max(0, totalQuota - acquiredCount);

  return {
    slots,
    quotas,
    acquiredCount,
    totalQuota,
    remainingOverallSlots,
    acquiredTeamIds: assignedTeams.map((t) => t.id),
  };
}

/**
 * Determines whether a team triggers the Blind Bid Protocol and at what threshold.
 * Rules:
 * - 23k Batch: ALL teams in 23k batch trigger Blind Bid if live bid reaches/exceeds 10,000 pts.
 * - Other 3 Batches (26k, 25k, 24k): ONLY the very first team presented/designated
 *   ('One piece' for 26k, 'Cook If you can' for 25k, 'Three Muggles' for 24k, or team.isFirstTeam)
 *   triggers Blind Bid if live bid reaches/exceeds 15,000 pts.
 */
function getTeamBlindBidInfo(team, batches, allTeams = []) {
  if (!team) {
    return { isBlindBidRound: false, blindBidThreshold: null, ruleLabel: null };
  }

  const batch = batches.find((b) => b.id === team.batchId);
  if (!batch) {
    return { isBlindBidRound: false, blindBidThreshold: null, ruleLabel: null };
  }

  if (batch.blindBidRule === 'all_teams' || batch.id === 'batch-23k' || batch.code === '23k') {
    const threshold = Number(batch.blindBidThreshold || 10000);
    return {
      isBlindBidRound: true,
      blindBidThreshold: threshold,
      ruleLabel: `23k Batch Trigger (@ ${threshold.toLocaleString()} pts)`,
    };
  }

  const targetFirstName = String(batch.firstTeamName || '').trim().toLowerCase();
  const teamNameLower = String(team.name || '').trim().toLowerCase();
  const matchesDesignatedName = Boolean(targetFirstName && teamNameLower === targetFirstName);
  const explicitlyFlagged = Boolean(team.isFirstTeam);

  // Also check if any designated first team exists in this batch; if none exists, fallback to first unsold presentation
  const batchTeams = allTeams.filter((t) => t.batchId === batch.id && !t.isCaptain);
  const batchHasDesignated = batchTeams.some(
    (t) => Boolean(t.isFirstTeam) || (targetFirstName && String(t.name || '').trim().toLowerCase() === targetFirstName)
  );
  const soldInBatch = batchTeams.filter((t) => t.status === 'assigned').length;

  const isFirstTeamTrigger =
    explicitlyFlagged ||
    matchesDesignatedName ||
    (!batchHasDesignated && soldInBatch === 0);

  if (isFirstTeamTrigger) {
    const threshold = Number(batch.blindBidThreshold || 15000);
    return {
      isBlindBidRound: true,
      blindBidThreshold: threshold,
      ruleLabel: `${batch.code || batch.name} First-Team Trigger (@ ${threshold.toLocaleString()} pts)`,
    };
  }

  return { isBlindBidRound: false, blindBidThreshold: null, ruleLabel: null };
}

/**
 * Checks whether a house can bid in the given batch.
 */
function canHouseBidInBatch(houseId, batchId, teams, batches = BATCH_CONFIGS) {
  const batch = batches.find((b) => b.id === batchId);
  if (!batch) return false;
  const { slots } = getHouseSlotSummary(houseId, teams, batches);
  const currentCount = slots[batchId] || 0;
  return currentCount < Number(batch.quota || 0);
}

module.exports = {
  HOUSE_POINT_LIMIT,
  BASE_PRICE,
  BID_INCREMENT,
  TOTAL_SLOTS_PER_HOUSE,
  BATCH_CONFIGS,
  calculateMaxBid,
  getHouseSlotSummary,
  getTeamBlindBidInfo,
  canHouseBidInBatch,
};
