const net = require('net');

// Create TCP server
const server = net.createServer((socket) => {
  console.log('Client connected:', socket.remoteAddress, socket.remotePort);

  // Handle incoming data
  socket.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`Received from ${socket.remotePort}: ${message}`);
    
    if (message.toLowerCase() === 'bye') {
      socket.end('Goodbye!\n');
      console.log(`Client ${socket.remotePort} disconnected`);
    } else if (message.toLowerCase() === 'shutdown') {
      socket.end('Server shutting down...\n');
      server.close(() => {
        console.log('Server stopped');
        process.exit(0);
      });
    } else {
      // Echo back the message
      socket.write(`ECHO: ${message}\n`);
    }
  });

  // Handle client disconnection
  socket.on('end', () => {
    console.log(`Client ${socket.remotePort} disconnected`);
  });

  // Handle errors
  socket.on('error', (err) => {
    console.error(`Socket error: ${err.message}`);
  });
});

// Handle server errors
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
});

// Start the server
const PORT = 12345;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Echo server listening on port ${PORT}`);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\nServer shutting down...');
  server.close(() => process.exit(0));
});