// src/components/Navbar.js

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../components/Auth';

const Navbar = () => {
  const currentUser = getCurrentUser();

  return (
    <nav className="navbar">
      <div className="container">
        <ul className="nav-list">
          <li><Link to="/landing">Home</Link></li>
          <li><Link to="/">Index</Link></li>
          <li><Link to="/add">Form</Link></li>
          <li className="user-info">
            {currentUser ? (
              <>
                <span>Logged in as: {currentUser}</span>
                <button className="logout-btn" onClick={logoutUser}>
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login">Login</Link>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;