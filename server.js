const express = require('express');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Create the HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Create the WebSocket server using the same HTTP server
const wss = new WebSocket.Server({ server });

app.use(bodyParser.json());

let clients = [];

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    clients.push(ws);

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        clients = clients.filter(client => client !== ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Handle HTTP POST requests to the /signal endpoint
app.post('/signal', (req, res) => {
    const data = req.body;

    // Log the received data
    console.log('Received POST request:', data);

    // Broadcast data to all connected WebSocket clients
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });

    // Respond to the device
    res.sendStatus(200); // HTTP 200 OK
});
