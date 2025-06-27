// src/pages/Index.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation

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
const response = await fetch('http://217.71.129.139:4821/api/users');
const data = await response.json();
setUsers(data);
} catch (error) {
console.error('Error fetching users:', error);
}
};

const fetchLocks = async () => {
	try {
	const response = await fetch('http://217.71.129.139:4821/api/locks'); //method: 'GET'
	const data = await response.json();
	setLocks(data);
	} catch (error) {
	console.error('Error fetching locks:', error);
	}
};

const addUser = async (username) => {
	try {
	const response = await fetch('http://217.71.129.139:4821/api/users', {
	method: 'POST',
	headers: {
	'Content-Type': 'application/json',
	},
	body: JSON.stringify({ username }),
	});

	if (response.ok) {
	fetchUsers(); // Refresh user list after adding
	} else {
	console.error('Error adding user:', await response.text());
	}
	} catch (error) {
	console.error('Error:', error);
	}
};
/*
const updateLockStatus = async (lockId, isOpen) => {
	try {
	const response = await fetch(`http://217.71.129.139:4821/api/locks/${lockId}`, {
	method: 'PUT',
	headers: {
	'Content-Type': 'application/json',
	},
	body: JSON.stringify({ isOpen: !isOpen }), // Toggle lock status
	});

	if (response.ok) {
	fetchLocks(); // Refresh lock list after updating
	} else {
	console.error('Error updating lock:', await response.text());
	}
	} catch (error) {
	console.error('Error:', error);
	}
};*/

const updateLockStatus = async (lockId, currentStatus) => {
  try {
    const newStatus = !currentStatus;
    
    const response = await fetch(`http://217.71.129.139:4821/api/locks/${lockId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOpen: newStatus }),
    });

    if (response.ok) {
      const updatedLock = await response.json();
      
      // Optimistic UI update
      setLocks(prevLocks => 
        prevLocks.map(lock => 
          lock.id === lockId ? updatedLock : lock
        )
      );
	  fetchLocks(); 
    } else {
      console.error('Error updating lock:', await response.text());
    }
  } catch (error) {
    console.error('Error:', error);
  }
};


const deleteUser = async (userId) => {
	try {
	const response = await fetch(`http://217.71.129.139:4821/api/users/${userId}`, {
	method: 'DELETE',
	});

	if (response.ok) {
	fetchUsers(); // Refresh user list after deletion
	} else {
	console.error('Error deleting user:', await response.text());
	}
	} catch (error) {
	console.error('Error:', error);
	}
};
/*
const addLock = async (lockId) => {
	if (!lockId) {
	alert('Please enter a lock ID');
	return; // Exit if lockId is invalid
	}

	try {
	const response = await fetch('http://217.71.129.139:4821/api/locks', {
	method: 'POST',
	headers: {
	'Content-Type': 'application/json',
	},
	body: JSON.stringify({ id: lockId, isOpen: false }), // Assume new locks start as closed
	});

	if (response.ok) {
	setNewLockId(''); // Clear the input field after addition
	fetchLocks(); // Refresh the lock list after adding
	} else {
	console.error('Error adding lock:', await response.text());
	}
	} catch (error) {
	console.error('Error:', error);
	}
};
*/

const addLock = async (lockIdInput) => {
  const lockId = Number(lockIdInput);
  
  if (!lockIdInput || isNaN(lockId)) {
    alert('Lock ID must be a number');
    return;
  }
  
  try {
    const response = await fetch('http://217.71.129.139:4821/api/locks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lockId, isOpen: false }),
    });

    if (response.ok) {
      const newLock = await response.json();
      setLocks(prevLocks => [...prevLocks, newLock]);
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
	const response = await fetch(`http://217.71.129.139:4821/api/locks/${lockId}`, {
	method: 'DELETE',
	});

	if (response.ok) {
	fetchLocks(); // Refresh the lock list after deletion
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
<th>Username</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
{users.map((user) => (
<tr key={user.id}>
<td>{user.username}</td>
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
<th>Lock ID</th>
<th>Status</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
{locks.map((lock) => (
  <tr key={lock.id}>
    <td>{lock.id}</td>
    <td>{lock.is_open ? 'Open' : 'Closed'}</td> {/* Changed to is_open */}
    <td>
      <button onClick={() => updateLockStatus(lock.id, lock.is_open)}>
        Toggle Status
      </button>
<button onClick={() => deleteLock(lock.id)}>Delete Lock</button>
{/* Link to view lock details */}
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
