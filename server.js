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
    clients.push(ws);
    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
    });
});

app.post('/signal', (req, res) => {
    const data = req.body;
    clients.forEach(client => {
        client.send(JSON.stringify(data));
    });
    res.sendStatus(200);
});

function connectWebSocket() {
    const socket = new WebSocket('wss://sample-server-plq2.onrender.com');
    
    socket.onopen = () => {
        console.log('WebSocket connection established.');
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (toggle_val === 1) {
            showPopup(data.name, data.eta, data.severity, data.lat, data.lng);
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket error: ', error);
    };

    socket.onclose = (event) => {
        console.log('WebSocket connection closed. Attempting to reconnect...');
        // Reconnect after a delay
        setTimeout(connectWebSocket, 5000); // 5 seconds
    };
}

// Initialize WebSocket connection
connectWebSocket();

