import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const authTelegram = (initData, user, startParam) =>
  api.post('/auth/telegram', { initData, user, startParam });

// User
export const getProfile = () => api.get('/user/profile');
export const getBalance = () => api.get('/user/balance');

// Daily Reward
export const getDailyStatus = () => api.get('/daily/status');
export const claimDaily = () => api.post('/daily/claim');

// Spin
export const getSpinStatus = () => api.get('/spin/status');
export const playSpin = (isAdSpin = false) => api.post('/spin/play', { isAdSpin });

// Ads
export const getAdsStatus = () => api.get('/ads/status');
export const startAd = () => api.post('/ads/start');
export const completeAd = (adId, watchDuration, sessionToken) => api.post('/ads/complete', { adId, watchDuration, sessionToken });
export const getAdConfig = () => api.get('/ads/config');

// Withdraw
export const getWithdrawInfo = () => api.get('/withdraw/info');
export const requestWithdraw = (amount) => api.post('/withdraw/request', { amount });
export const getWithdrawHistory = () => api.get('/withdraw/history');

// Notifications
export const getNotifications = () => api.get('/notifications');
export const markAllRead = () => api.post('/notifications/read-all');

// Referral
export const getReferralInfo = () => api.get('/referral/info');
export const getReferralList = () => api.get('/referral/list');

// Admin
export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAdminUsers = (search, page) => api.get(`/admin/users?search=${search || ''}&page=${page || 1}`);
export const toggleBan = (userId) => api.post(`/admin/users/${userId}/ban`);
export const updateBalance = (userId, amount, action) => api.post(`/admin/users/${userId}/balance`, { amount, action });
export const getAdminWithdrawals = (status, page) => api.get(`/admin/withdrawals?status=${status || ''}&page=${page || 1}`);
export const processWithdrawal = (id, action, note) => api.post(`/admin/withdrawals/${id}/process`, { action, note });
export const sendBroadcast = (message) => api.post('/admin/broadcast', { message });
export const sendAdminMessage = (telegramId, message) => api.post(`/admin/send-message/${telegramId}`, { message });

export default api;
