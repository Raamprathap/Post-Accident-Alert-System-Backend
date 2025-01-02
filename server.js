const express = require('express');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // Use `node-fetch` to make HTTP requests

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

    // Broadcast messages received from one WebSocket client to all others
    ws.on('message', (message) => {
        console.log('Message received from client:', message);

        // Broadcast the message to all other connected WebSocket clients
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

// Handle HTTP POST requests to the /signal endpoint
app.post('/signal', async (req, res) => {
    const data = req.body;

    // Log the received data
    console.log('Received POST request:', data);

    // Check if the type is "hospital_request"
    if (data.type === "hospital_request") {
        const lat = data.lat;
        const lon = data.lng;

        try {
            // Find the nearest hospital
            const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node["amenity"="hospital"](around:25000,${lat},${lon});out;`;
            const response = await fetch(overpassUrl);
            const hospitalData = await response.json();

            const hospitals = hospitalData.elements;

            if (hospitals.length === 0) {
                console.log('No hospitals found nearby.');
                res.status(404).send({ message: 'No hospitals found nearby.' });
                return;
            }

            // Find the nearest hospital
            let nearestHospital = null;
            let minDistance = Infinity;

            hospitals.forEach(hospital => {
                const distance = Math.sqrt(
                    Math.pow(hospital.lat - lat, 2) +
                    Math.pow(hospital.lon - lon, 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestHospital = hospital;
                }
            });

            // Add the nearest hospital's lat/lng to the data
            data.hlat = nearestHospital.lat;
            data.hlng = nearestHospital.lon;

            // Log the nearest hospital
            console.log('Nearest hospital found:', {
                hlat: nearestHospital.lat,
                hlng: nearestHospital.lon
            });

            // Broadcast the updated data to all connected WebSocket clients
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });

            // Respond to the POST request
            res.status(200).send({ message: 'Nearest hospital data broadcasted.', data });
        } catch (error) {
            console.error('Error fetching hospital data:', error);
            res.status(500).send({ message: 'Error fetching hospital data.', error });
        }
    } else {
        // For other types, simply broadcast the data
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });

        // Respond to the POST request
        res.status(200).send({ message: 'Data broadcasted.' });
    }
});
