// server.js
const app = require('./app');
const http = require('http');

// Define the port
const PORT = process.env.PORT || 3000;

// Create an HTTP server and listen on the specified port
const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
