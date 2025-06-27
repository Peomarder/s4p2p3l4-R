// src/pages/Form.js
import React, { useState } from 'react';
import md5 from 'md5';

const Form = ({ setCurrentUser }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Encrypt the password using md5
    const encryptedPassword = md5(password);

    // User object to send to the server
    const newUser = {
      username: username,
      password: encryptedPassword,
    };

    try {
      // Send a POST request to the JSON server to add the user
      const response = await fetch('http://217.71.129.139:4821/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser), // Adding new user data
      });

      if (response.ok) {
        // If successful, set current user and store in local storage
        localStorage.setItem('currentUser', username);
        setCurrentUser(username);
        alert('User registered successfully!');
        setUsername(''); // Clear input field
        setPassword(''); // Clear input field
      } else {
        const errorText = await response.text();
        console.error('Error registering user:', errorText);
        alert('Failed to register user. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while registering the user.');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <h2>Register User</h2>
        <label>
          Username:
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit">Register</button>
      </form>
    </div>
  );
};

export default Form;