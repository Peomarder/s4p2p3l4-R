// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register'; 
import Index from './pages/Index';
import Login from './pages/Login';
import LockDetail from './pages/LockDetail'; // Import the new component
import Navbar from './components/Navbar';
//import './App.css';

console.log("Available routes:", [
  { path: "/", component: "Index" },
  { path: "/login", component: "Login" },
  { path: "/register", component: "Register" },
  { path: "/landing", component: "Home" },
  { path: "/detail/:lockId", component: "LockDetail" }
]);

const App = () => {
const [currentUser, setCurrentUser] = useState(null);

useEffect(() => {
// Recover last logged in user from local storage
const user = localStorage.getItem('currentUser');
if (user) {
setCurrentUser(user);
}
}, []);

return (
<>
<Navbar currentUser={currentUser} />
<Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
<Route path="/landing" element={<Home />} />
<Route path="/" element={<Index />} />

<Route path="/detail/:lockId" element={<LockDetail />} /> {}
        {/* Add a catch-all route */}
        <Route path="*" element={<div>Page not found</div>} />
</Routes>
</>
);
};

export default App;