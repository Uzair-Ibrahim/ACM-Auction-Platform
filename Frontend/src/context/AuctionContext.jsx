import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';

const AuctionContext = createContext(null);

const initialState = {
  settings: {
    housePointLimit: 150000,
    basePrice: 5000,
    bidIncrement: 1000,
    totalSlotsPerHouse: 11,
  },
  houses: [],
  batches: [],
  teams: [],
  transactions: [],
  history: [],
  auction: {
    currentTeamId: null,
    currentTeam: null,
    currentBid: 0,
    selectedHouseId: null,
    status: 'idle',
    startedAt: null,
    isBlindBidRound: false,
    blindBidThreshold: null,
    blindBidRuleLabel: null,
    isBlindBidActive: false,
    blindBids: {},
    blindBidCount: 0,
    frozenHouseId: null,
    frozenByHouseId: null,
    bidHistory: [],
  },
  connected: false,
  notice: null,
  acquisition: null,
  blindBidAlert: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return {
        ...state,
        settings: action.payload.settings || state.settings,
        houses: action.payload.houses || state.houses,
        batches: action.payload.batches || state.batches,
        teams: action.payload.teams || state.teams,
        transactions: action.payload.transactions || state.transactions,
        history: action.payload.history || state.history,
        auction: {
          ...state.auction,
          ...(action.payload.auction || {}),
          currentTeam: action.payload.auction?.currentTeam || null,
        },
      };
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };
    case 'SET_NOTICE':
      return { ...state, notice: action.payload };
    case 'CLEAR_NOTICE':
      return { ...state, notice: null };
    case 'SET_ACQUISITION':
      return { ...state, acquisition: action.payload };
    case 'CLEAR_ACQUISITION':
      return { ...state, acquisition: null };
    case 'SET_BLIND_BID_ALERT':
      return { ...state, blindBidAlert: action.payload };
    case 'CLEAR_BLIND_BID_ALERT':
      return { ...state, blindBidAlert: null };
    default:
      return state;
  }
}

export function AuctionProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const seenConfirmedTxIdsRef = useRef(null);

  function detectNewSaleAndAnimate(data) {
    if (!data || !Array.isArray(data.transactions)) return;
    const confirmedTxs = data.transactions.filter((tx) => tx.status === 'confirmed');

    // On initial load, seed seen transaction IDs without firing old animations
    if (seenConfirmedTxIdsRef.current === null) {
      seenConfirmedTxIdsRef.current = new Set(confirmedTxs.map((tx) => tx.id));
      return;
    }

    // Check if any confirmed transaction is newly added since last state sync
    const newTxs = confirmedTxs.filter((tx) => !seenConfirmedTxIdsRef.current.has(tx.id));
    confirmedTxs.forEach((tx) => seenConfirmedTxIdsRef.current.add(tx.id));

    if (newTxs.length > 0) {
      const latestTx = newTxs[newTxs.length - 1];
      const soldTeam = (data.teams || []).find((t) => t.id === latestTx.teamId);
      const winningHouse = (data.houses || []).find((h) => h.id === latestTx.houseId);
      dispatch({
        type: 'SET_ACQUISITION',
        payload: {
          txId: latestTx.id,
          teamId: latestTx.teamId,
          teamName: soldTeam?.name || latestTx.teamName || 'Team',
          houseName: winningHouse?.name || latestTx.houseName || 'House',
          houseId: latestTx.houseId,
          amount: latestTx.amount,
          viaBlindBid: Boolean(latestTx.viaBlindBid),
        },
      });
    }
  }

  async function refreshState() {
    try {
      const { data } = await api.getState();
      detectNewSaleAndAnimate(data);
      dispatch({ type: 'SET_STATE', payload: data });
      dispatch({ type: 'SET_CONNECTED', payload: true });
    } catch (error) {
      console.error('State refresh failed', error);
    }
  }

  useEffect(() => {
    refreshState();

    // Smooth real-time polling fallback (essential for Vercel serverless deployment & network resilience)
    const pollInterval = setInterval(() => {
      refreshState();
    }, 1800);

    const socket = io(api.baseURL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 5000,
    });

    socket.on('connect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: true });
      socket.emit('request:state');
    });

    socket.on('disconnect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    socket.on('auction:update', (payload) => {
      detectNewSaleAndAnimate(payload);
      dispatch({ type: 'SET_STATE', payload });
    });

    socket.on('auction:confirmed', (payload) => {
      const txId = payload.transaction?.id;
      if (txId && seenConfirmedTxIdsRef.current) {
        if (seenConfirmedTxIdsRef.current.has(txId)) {
          return;
        }
        seenConfirmedTxIdsRef.current.add(txId);
      }
      dispatch({
        type: 'SET_ACQUISITION',
        payload: {
          txId: txId || `tx-${Date.now()}`,
          teamId: payload.transaction?.teamId,
          teamName: payload.team,
          houseName: payload.house,
          houseId: payload.houseId,
          amount: payload.amount,
          viaBlindBid: payload.viaBlindBid,
        },
      });
    });

    socket.on('auction:blind_bid_initiated', (payload) => {
      dispatch({
        type: 'SET_BLIND_BID_ALERT',
        payload: {
          teamName: payload.teamName,
          threshold: payload.threshold || 15000,
          ruleLabel: payload.ruleLabel,
        },
      });
      setTimeout(() => {
        dispatch({ type: 'CLEAR_BLIND_BID_ALERT' });
      }, 4500);
    });

    socket.on('auction:freeze', (payload) => {
      dispatch({
        type: 'SET_NOTICE',
        payload: {
          type: 'freeze',
          title: '❄ FREEZE CARD SLAPPED!',
          text: `${payload.sourceHouseName} froze ${payload.targetHouseName}! ${payload.targetHouseName} is silenced until another house bids.`,
        },
      });
      setTimeout(() => dispatch({ type: 'CLEAR_NOTICE' }), 5500);
    });

    socket.on('auction:reversed', () => {
      dispatch({
        type: 'SET_NOTICE',
        payload: {
          type: 'info',
          title: 'Assignment Reversed',
          text: 'The house assignment has been reversed and balances recalculated.',
        },
      });
      setTimeout(() => dispatch({ type: 'CLEAR_NOTICE' }), 4000);
    });

    socket.on('auction:reset', () => {
      refreshState();
    });

    return () => {
      clearInterval(pollInterval);
      socket.disconnect();
    };
  }, []);

  return (
    <AuctionContext.Provider value={{ state, dispatch, refreshState }}>
      {children}
    </AuctionContext.Provider>
  );
}

export function useAuction() {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error('useAuction must be used within AuctionProvider');
  return ctx;
}
