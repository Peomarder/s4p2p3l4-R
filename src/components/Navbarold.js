// src/components/Navbar.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, logoutUser, } from '../components/Auth';


const Navbar = () => {
  const currentUser = getCurrentUser();

  return (
    <nav className="navbar">
      <div className="container">
        <ul className="nav-list">
          <li><Link to="/landing">Home</Link></li>
          <li><Link to="/">Index</Link></li>
          <li><Link to="/logs">Journal</Link></li>
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
		  <li>
      {currentUser ? (
        <div className="user-info">
          <span>Welcome, {currentUser.name} ({currentUser.username})</span>
          <span>Privilege: {currentUser.privilege}</span>
        </div>
      ) : (
        <div>Loading user...</div>
      )}
    </li>
        </ul>
      </div>
    </nav>
  );
};



export default Navbar;