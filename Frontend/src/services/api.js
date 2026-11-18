import axios from 'axios';

const DEFAULT_BACKEND =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';

const API_BASE = (import.meta.env.VITE_API_URL || DEFAULT_BACKEND).replace(/\/$/, '');

const getAdminToken = () =>
  sessionStorage.getItem('coderscup-admin-token') ||
  localStorage.getItem('coderscup-admin-token') ||
  '';

const getCaptainToken = () =>
  sessionStorage.getItem('coderscup-tab-captain-token') ||
  localStorage.getItem('coderscup-captain-token') ||
  '';

const withAdminHeaders = (config = {}) => {
  const token = getAdminToken();
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      Authorization: token ? `Bearer ${token}` : '',
      'X-Admin-Token': token,
      'X-Admin-Key': token,
    },
  };
};

const withCaptainHeaders = (config = {}) => {
  const token = getCaptainToken();
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      Authorization: token ? `Bearer ${token}` : '',
      'X-Captain-Token': token,
    },
  };
};

const client = axios.create({
  baseURL: API_BASE,
  timeout: 12000,
});

export function extractErrorMessage(err) {
  if (err?.response?.data?.error) {
    return err.response.data.error;
  }
  if (typeof err?.response?.data === 'string' && err.response.data.includes('Cannot ')) {
    return 'Backend server needs a restart to load updated endpoints (please restart Backend terminal).';
  }
  if (err?.code === 'ERR_NETWORK' || !err?.response) {
    return `Cannot reach Backend server at ${API_BASE}. Make sure Backend is running on port 5000.`;
  }
  return err?.message || 'Request failed.';
}

const api = {
  baseURL: API_BASE,

  // Admin Session Management (Isolated from Captain sessions so multi-tab never logs anyone out)
  getAdminSession: () => ({
    key: getAdminToken(),
    username:
      sessionStorage.getItem('coderscup-admin-user') ||
      localStorage.getItem('coderscup-admin-user') ||
      '',
  }),

  setAdminSession: (token, username = 'admin') => {
    if (token) {
      sessionStorage.setItem('coderscup-admin-token', token);
      sessionStorage.setItem('coderscup-admin-user', username);
      localStorage.setItem('coderscup-admin-token', token);
      localStorage.setItem('coderscup-admin-user', username);
      window.dispatchEvent(new Event('coderscup-auth-change'));
    } else {
      sessionStorage.removeItem('coderscup-admin-token');
      sessionStorage.removeItem('coderscup-admin-user');
      localStorage.removeItem('coderscup-admin-token');
      localStorage.removeItem('coderscup-admin-user');
      window.dispatchEvent(new Event('coderscup-auth-change'));
    }
  },

  // Captain Session Management (Per-tab sessionStorage + localStorage persistence)
  setCaptainSession: (token, houseId, username = '') => {
    if (token) {
      sessionStorage.setItem('coderscup-tab-captain-token', token);
      sessionStorage.setItem('coderscup-tab-captain-house', houseId || '');
      sessionStorage.setItem('coderscup-tab-captain-user', username || houseId || '');
      localStorage.setItem('coderscup-captain-token', token);
      if (houseId) localStorage.setItem('coderscup-captain-house', houseId);
      if (username) localStorage.setItem('coderscup-captain-user', username);
      window.dispatchEvent(new Event('coderscup-auth-change'));
    } else {
      sessionStorage.removeItem('coderscup-tab-captain-token');
      sessionStorage.removeItem('coderscup-tab-captain-house');
      sessionStorage.removeItem('coderscup-tab-captain-user');
      localStorage.removeItem('coderscup-captain-token');
      localStorage.removeItem('coderscup-captain-house');
      localStorage.removeItem('coderscup-captain-user');
      window.dispatchEvent(new Event('coderscup-auth-change'));
    }
  },

  getCaptainSession: () => ({
    token: getCaptainToken(),
    houseId:
      sessionStorage.getItem('coderscup-tab-captain-house') ||
      localStorage.getItem('coderscup-captain-house') ||
      '',
    username:
      sessionStorage.getItem('coderscup-tab-captain-user') ||
      localStorage.getItem('coderscup-captain-user') ||
      '',
  }),

  getState: () => client.get('/api/state'),
  getHistory: () => client.get('/api/history'),
  getTeams: () => client.get('/api/teams'),
  getBatches: () => client.get('/api/batches'),
  getHouses: () => client.get('/api/houses'),

  admin: {
    login: (username, password) =>
      client.post('/api/admin/login', { username, password }),
    getState: () => client.get('/api/admin/state', withAdminHeaders()),

    createTeam: (payload) => client.post('/api/teams', payload, withAdminHeaders()),
    bulkImportTeams: (teams, replaceExisting = false) =>
      client.post('/api/teams/bulk', { teams, replaceExisting }, withAdminHeaders()),
    updateTeam: (id, payload) => client.put(`/api/teams/${id}`, payload, withAdminHeaders()),
    deleteTeam: (id) => client.delete(`/api/teams/${id}`, withAdminHeaders()),

    selectTeam: (teamId) =>
      client.post('/api/auction/select-team', { teamId }, withAdminHeaders()),
    cancelSelection: () =>
      client.post('/api/auction/cancel-selection', {}, withAdminHeaders()),

    placeBid: (houseId, amount) =>
      client.post('/api/auction/bid', { houseId, amount }, withAdminHeaders()),
    setBid: (amount, houseId) =>
      client.post('/api/auction/update-bid', { amount, houseId }, withAdminHeaders()),
    undoLastBid: () =>
      client.post('/api/auction/undo-last-bid', {}, withAdminHeaders()),
    setHouse: (houseId) =>
      client.post('/api/auction/set-house', { houseId }, withAdminHeaders()),

    invokeFreeze: (sourceHouseId, targetHouseId) =>
      client.post('/api/auction/freeze', { sourceHouseId, targetHouseId }, withAdminHeaders()),
    invokeRTM: (houseId) =>
      client.post('/api/auction/rtm', { houseId }, withAdminHeaders()),

    triggerBlindBid: (threshold) =>
      client.post('/api/auction/trigger-blind-bid', { threshold }, withAdminHeaders()),
    submitBlindBid: (houseId, amount) =>
      client.post('/api/auction/blind-bid', { houseId, amount }, withAdminHeaders()),
    resolveBlindBid: (houseId, amount) =>
      client.post('/api/auction/resolve-blind-bid', { houseId, amount }, withAdminHeaders()),

    confirmAuction: (houseId, amount) =>
      client.post('/api/auction/confirm', { houseId, amount }, withAdminHeaders()),
    reverseTransaction: (id) =>
      client.post(`/api/auction/reverse-transaction/${id}`, {}, withAdminHeaders()),
    reviseAmount: (id, amount) =>
      client.post(`/api/transactions/${id}/revise-amount`, { amount }, withAdminHeaders()),

    toggleFreeze: (houseId, frozen) =>
      client.post(`/api/admin/houses/${houseId}/freeze`, { frozen }, withAdminHeaders()),
    togglePowerCard: (houseId, cardType, used) =>
      client.post(`/api/admin/houses/${houseId}/power-card`, { cardType, used }, withAdminHeaders()),
    updateHouseConfig: (houseId, payload) =>
      client.post(`/api/admin/houses/${houseId}/config`, payload, withAdminHeaders()),
    updateSecurityConfig: (payload) =>
      client.post('/api/admin/security/config', payload, withAdminHeaders()),
    setPointLimit: (limit) =>
      client.post('/api/admin/settings/house-point-limit', { limit }, withAdminHeaders()),
    reset: (reseedDefaultTeams = false) =>
      client.post('/api/reset', { reseedDefaultTeams }, withAdminHeaders()),
  },

  captain: {
    login: (username, password) =>
      client.post('/api/captain/login', { username, houseId: username, password, pin: password }),
    getMe: () => client.get('/api/captain/me', withCaptainHeaders()),
    placeBid: (amount) =>
      client.post('/api/auction/bid', { amount }, withCaptainHeaders()),
    invokeFreeze: (targetHouseId) =>
      client.post('/api/auction/freeze', { targetHouseId }, withCaptainHeaders()),
    invokeRTM: () => client.post('/api/auction/rtm', {}, withCaptainHeaders()),
    submitBlindBid: (amount) =>
      client.post('/api/auction/blind-bid', { amount }, withCaptainHeaders()),
  },
};

export default api;
