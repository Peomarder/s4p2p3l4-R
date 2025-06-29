import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../components/Auth';

const Navbar = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error fetching user:', error);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <nav className="navbar">
      <div className="container">
        <ul className="nav-list">
          <li><Link to="/landing">Home</Link></li>
          <li><Link to="/">Index</Link></li>
          <li><Link to="/logs">Journal</Link></li>
          <li className="user-info">
            {loading ? (
              <div>Loading user...</div>
            ) : currentUser ? (
              <>
                <span>Logged in as: {currentUser.username}</span>
                <button className="logout-btn" onClick={logoutUser}>
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login">Login</Link>
            )}
          </li>
          {currentUser && (
            <li>
              <div className="user-info">
                <span>Welcome, {currentUser.name} ({currentUser.username})</span>
                <span>Privilege: {currentUser.privilege}</span>
              </div>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;