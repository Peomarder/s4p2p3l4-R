//src/components/Auth.js

import jwt from 'jsonwebtoken';
import md5 from 'md5';

const API_BASE = 'http://217.71.129.139:4821/api';
const TOKEN_KEY = 'energy_security_token';

export const registerUser = async (username, password) => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: md5(password) })
  });
  
  if (!response.ok) throw new Error('Registration failed');
  return await response.json();
};

export const loginUser = async (username, password) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: md5(password) })
  });
  
  if (!response.ok) throw new Error('Login failed');
  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data;
};

export const logoutUser = () => {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = '/login';
};

export const getCurrentUser = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  
  try {
    const decoded = jwt.decode(token);
    return decoded?.username || null;
  } catch {
    return null;
  }
};

export const verifyToken = async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.ok;
  } catch {
    return false;
  }
};

// Add to all protected pages
export const checkAuth = () => {
  if (!getCurrentUser() && !window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
};