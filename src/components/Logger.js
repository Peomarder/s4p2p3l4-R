//src/components/Logger.js
/*
export const logAction = async (actionName, lockId = null) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('No authentication token');
    
    await fetch(`${API_BASE}/log-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action_name: actionName,
        lock_id: lockId
      })
    });
  } catch (error) {
    console.error('Error logging action:', error);
  }
};*/

import { API_BASE } from '../components/Auth';

export const logAction = async (actionId, lockId = null) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    await fetch(`${API_BASE}/log-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action_id: actionId,
        lock_id: lockId
      })
    });
  } catch (error) {
    console.error('Error logging action:', error);
  }
};