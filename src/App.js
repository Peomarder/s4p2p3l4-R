// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Index from './pages/Index';
import Login from './pages/Login';
import Register from './pages/Form'; 
import LockDetail from './pages/LockDetail'; // Import the new component
import Navbar from './components/Navbar';
import './App.css';

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
<Router>
<Navbar currentUser={currentUser} />
<Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
<Route path="/landing" element={<Home />} />
<Route path="/" element={<Index />} />
//<Route path="/add" element={<Form setCurrentUser={setCurrentUser} />} /> //form
<Route path="/detail/:lockId" element={<LockDetail />} /> {}
</Routes>
</Router>
);
};

export default App;