const net = require('net');
const readline = require('readline');

// Configuration
const SERVER_HOST = '217.71.129.139'; // Change to your server IP
const SERVER_PORT = 5835;

// Create client socket
const client = net.createConnection({ host: SERVER_HOST, port: SERVER_PORT }, () => {
  console.log(`Connected to server at ${SERVER_HOST}:${SERVER_PORT}`);
  promptUser();
});

// Setup command line interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

// Handle server responses
client.on('data', (data) => {
  console.log(data.toString().trim());
  promptUser();
});

// Handle connection close
client.on('end', () => {
  console.log('Disconnected from server');
  rl.close();
});

// Handle errors
client.on('error', (err) => {
  console.error(`Connection error: ${err.message}`);
  process.exit(1);
});

// Prompt user for input
function promptUser() {
  rl.prompt();
}

// Send user input to server
rl.on('line', (line) => {
  client.write(`${line}\n`);
  
  if (line.toLowerCase() === 'bye') {
    client.end();
    rl.close();
  }
});

// Clean up on exit
rl.on('close', () => {
  console.log('Client closed');
  process.exit(0);
});