import { WebSocketServer } from 'ws'; // Use WebSocketServer explicitly
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import express from 'express';

const app = express();

const PORT = process.env.PORT || 3000;

// Create the HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Create the WebSocket server using the same HTTP server
const wss = new WebSocketServer({ server }); // Corrected this line

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
            if (client !== ws && client.readyState === ws.OPEN) {
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
            // Hardcoded list of hospitals
            const hospitals = {
                "Ganga Hospital": { name: "Ganga Hospital", lat: 11.0225, lng: 76.9606 },
                "Amrita Clinic": { name: "Amrita Clinic", lat: 10.9017502, lng: 76.9011755 }
            };

            // Find the nearest hospital
            let nearestHospital = null;
            let minDistance = Infinity;

            Object.values(hospitals).forEach(hospital => {
                const distance = Math.sqrt(
                    Math.pow(hospital.lat - lat, 2) +
                    Math.pow(hospital.lng - lon, 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestHospital = hospital;
                }
            });

            if (!nearestHospital) {
                console.log('No hospitals found nearby.');
                res.status(404).send({ message: 'No hospitals found nearby.' });
                return;
            }

            // Add the nearest hospital's details to the data
            data.hlat = nearestHospital.lat;
            data.hlng = nearestHospital.lng;
            data.hospital_name = nearestHospital.name;

            // Log the nearest hospital
            console.log('Nearest hospital found:', {
                name: nearestHospital.name,
                hlat: nearestHospital.lat,
                hlng: nearestHospital.lng
            });

            // Broadcast the updated data to all connected WebSocket clients
            clients.forEach(client => {
                if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });

            // Respond to the POST request
            res.status(200).send({ message: 'Nearest hospital data broadcasted.', data });
        } catch (error) {
            console.error('Error processing hospital request:', error.message || error);
            res.status(500).send({ message: 'Error processing hospital request.', error: error.message || error });
        }
    } else {
        // For other types, simply broadcast the data
        clients.forEach(client => {
            if (client.readyState === ws.OPEN) {
                client.send(JSON.stringify(data));
            }
        });

        // Respond to the POST request
        res.status(200).send({ message: 'Data broadcasted.' });
    }
});
