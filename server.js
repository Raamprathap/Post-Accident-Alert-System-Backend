const express = require('express');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

const app = express();
const wss = new WebSocket.Server({ port: 8080 });

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

app.listen(3000, () => console.log('Server running on port 3000'));
