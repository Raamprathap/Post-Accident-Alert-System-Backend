const express = require('express');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;  // Ensure the app uses the dynamic port

// Create the HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Create the WebSocket server using the same HTTP server
const wss = new WebSocket.Server({ server });

app.use(bodyParser.json());

let clients = [];

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    clients.push(ws);
    
    // Handle incoming messages
    ws.on('message', (message) => {
        console.log('Received:', message);
    });

    // Remove client on connection close
    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Route to receive signals
app.post('/signal', (req, res) => {
    const data = req.body;
    clients.forEach(client => {
        client.send(JSON.stringify(data));  // Send the signal to all connected clients
    });
    res.sendStatus(200);  // Respond to signal POST request
});
