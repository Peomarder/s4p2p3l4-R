// src/pages/Index.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import { authFetch } from '../components/Auth';
import './Index.css';

const API_BASE = 'http://217.71.129.139:4821/api';

const Index = () => {
  const [users, setUsers] = useState([]);
  const [locks, setLocks] = useState([]);
  const [newLockId, setNewLockId] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchLocks();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await authFetch(`${API_BASE}/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      // Map to expected format
      const formattedUsers = data.map(user => ({
        id: user.id_user,
        username: user.login,
        name: user.name,
        email: user.email
      }));
      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchLocks = async () => {
    try {
      const response = await authFetch(`${API_BASE}/locks`);
      if (!response.ok) {
        throw new Error('Failed to fetch locks');
      }
      const data = await response.json();
      // Map to expected format
      const formattedLocks = data.map(lock => ({
        id: lock.id,
        name: lock.name,
        is_open: lock.is_open
      }));
      setLocks(formattedLocks);
    } catch (error) {
      console.error('Error fetching locks:', error);
    }
  };

  const addUser = async (username) => {
    try {
      const response = await authFetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        fetchUsers();
      } else {
        console.error('Error adding user:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const updateLockStatus = async (lockId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const response = await authFetch(`${API_BASE}/locks/${lockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_open: newStatus }),
      });

      if (response.ok) {
        fetchLocks(); // Refresh lock list
      } else {
        console.error('Error updating lock:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const deleteUser = async (userId) => {
    try {
      const response = await authFetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchUsers();
      } else {
        console.error('Error deleting user:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const addLock = async (lockIdInput) => {
    const lockId = Number(lockIdInput);
    if (!lockIdInput || isNaN(lockId)) {
      alert('Lock ID must be a number');
      return;
    }
    
    try {
      const response = await authFetch(`${API_BASE}/locks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lockId, is_open: false }),
      });

      if (response.ok) {
        fetchLocks();
        setNewLockId('');
      } else {
        console.error('Error adding lock:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const deleteLock = async (lockId) => {
    try {
      const response = await authFetch(`${API_BASE}/locks/${lockId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchLocks();
      } else {
        console.error('Error deleting lock:', await response.text());
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <>
      <div>
        <h2>Users</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <button onClick={() => deleteUser(user.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Locks</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {locks.map((lock) => (
              <tr key={lock.id}>
                <td>{lock.id}</td>
                <td>{lock.name}</td>
                <td>{lock.is_open ? 'Open' : 'Closed'}</td>
                <td>
                  <button onClick={() => updateLockStatus(lock.id, lock.is_open)}>
                    Toggle Status
                  </button>
                  <button onClick={() => deleteLock(lock.id)}>Delete</button>
                  <Link to={`/detail/${lock.id}`}>View Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Add New Lock</h3>
        <input
          type="number"
          value={newLockId}
          onChange={(e) => setNewLockId(e.target.value)}
          placeholder="Enter Lock ID"
        />
        <button onClick={() => addLock(newLockId)}>Add Lock</button>
      </div>
    </>
  );
};

export default Index;