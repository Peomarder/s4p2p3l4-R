//src/components/Auth.js

//import jwt from 'jsonwebtoken';
//import md5 from 'md5';
import {jwtDecode } from 'jwt-decode'; // Replace jsonwebtoken with this



const API_BASE = 'http://217.71.129.139:4821/api';
const TOKEN_KEY = 'energy_security_token';


export const registerUser = async (username, password, email, name) => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email, name })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Registration failed');
  }
  
  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data;
};


export const loginUser = async (username, password) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Login failed');
  }
  
  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data;
};

// Add token refresh function
export const refreshToken = async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    return data.token;
  } catch {
    return null;
  }
};

export const logoutUser = () => {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = '/login';
};

// Update getCurrentUser function
// Add this function to Auth.js
// Add user caching to prevent unnecessary API calls
let cachedUser = null;
let lastFetchTime = 0;
/*
export const getCurrentUser = async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  
  // Use cached user if available and not expired (5 minute cache)
  const now = Date.now();
  if (cachedUser && (now - lastFetchTime < 300000)) {
    return cachedUser;
  }
  
  try {
    const decoded = jwtDecode(token);
    const userId = decoded.id_user;

    const response = await fetch(`${API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) {
      // If unauthorized, clear cache and token
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        cachedUser = null;
      }
      throw new Error('Failed to fetch user data');
    }
    
    const userData = await response.json();
    
    // Cache the user data
    cachedUser = {
      id: userData.id_user,
      username: userData.login,
      name: userData.name,
      email: userData.email,
      privilege: userData.privilege_name
    };
    
    lastFetchTime = Date.now();
    return cachedUser;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};
*/

export const getCurrentUser = async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  
  // Cache check
  const now = Date.now();
  if (cachedUser && (now - lastFetchTime < 300000)) {
    return cachedUser;
  }
  
  try {
    const decoded = jwtDecode(token);
    const userId = decoded.id_user;

    const response = await fetch(`${API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        cachedUser = null;
      }
      return null;
    }
    
    const userData = await response.json();
    
    cachedUser = {
      id: userData.id_user,
      username: userData.login,
      name: userData.name,
      email: userData.email,
      privilege: userData.privilege_name
    };
    
    lastFetchTime = Date.now();
    return cachedUser;
  } catch (error) {
    console.error('Error fetching user:', error);
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

// Enhanced checkAuth with token refresh
/*
export const checkAuth = async () => {
  const user = getCurrentUser();
  if (!user) {
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    return false;
  }
  
  const isValid = await verifyToken();
  if (!isValid) {
    const newToken = await refreshToken();
    if (!newToken) {
      logoutUser();
      return false;
    }
  }
  
  return true;
};*/

export const checkAuth = async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    redirectToLogin();
    return false;
  }

  try {
    // Verify token first
    const verifyResponse = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (verifyResponse.ok) return true;
    
    // If verification fails, try to refresh token
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    
    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      return true;
    }
    
    // Both verification and refresh failed
    logoutUser();
    return false;
  } catch (error) {
    console.error('Authentication check failed:', error);
    logoutUser();
    return false;
  }
};

function redirectToLogin() {
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}