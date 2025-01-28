import { WebSocketServer } from 'ws'; // Only import WebSocketServer
import bodyParser from 'body-parser';
import express from 'express';

const app = express();

const PORT = process.env.PORT || 3000;

// Create the HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Create the WebSocket server using the same HTTP server
const wss = new WebSocketServer({ server });

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
        const messageStr = message.toString(); // Convert Buffer to string
        console.log('Message received from client:', messageStr);
    
        try {
            const data = JSON.parse(messageStr); // Parse JSON
            console.log('Parsed message:', data);
    
            clients.forEach(client => {
                if (client !== ws && client.readyState === 1) {
                    client.send(JSON.stringify(data)); // Send the parsed message
                }
            });
        } catch (err) {
            console.error('Error parsing message as JSON:', err);
        }
    });    
});

// Handle HTTP POST requests to the /signal endpoint
app.post('/signal', async (req, res) => {
    const data = req.body;

    console.log('Received POST request:', data);

    if (data.type === "hospital_request") {
        const lat = parseFloat(data.lat);
        const lon = parseFloat(data.lng);

        try {
            const hospitals = {
                "Ganga Hospital": { name: "Ganga Hospital", lat: 11.0225, lng: 76.9606 },
                "Amrita Clinic": { name: "Amrita Clinic", lat: 10.9017502, lng: 76.9011755 }
            };

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

            data.hlat = nearestHospital.lat;
            data.hlng = nearestHospital.lng;
            data.hospital_name = nearestHospital.name;

            console.log('Nearest hospital found:', {
                name: nearestHospital.name,
                hlat: nearestHospital.lat,
                hlng: nearestHospital.lng
            });

            clients.forEach(client => {
                if (client.readyState === 1) { // Use 1 for open state
                    client.send(JSON.stringify(data));
                }
            });

            res.status(200).send({ message: 'Nearest hospital data broadcasted.', data });
        } catch (error) {
            console.error('Error processing hospital request:', error.message || error);
            res.status(500).send({ message: 'Error processing hospital request.', error: error.message || error });
        }
    } else if (data.type === "Deny_request") {
        const lat = parseFloat(data.lat);
        const lon = parseFloat(data.lng);
        data.type = 'hospital_request'

        try {
            const hospitals = {
                "Ganga Hospital": { name: "Ganga Hospital", lat: 11.0225, lng: 76.9606 },
                "Amrita Clinic": { name: "Amrita Clinic", lat: 10.9017502, lng: 76.9011755 }
            };

            let nearestHospital = null;
            let minDistance = Infinity;

            Object.values(hospitals).forEach(hospital => {
                const distance = Math.sqrt(
                    Math.pow(hospital.lat - lat, 2) +
                    Math.pow(hospital.lng - lon, 2)
                );
                if (distance < minDistance && (hospital.lat !== parseFloat(data.hlat) && hospital.lng !== parseFloat(data.hlng))) {
                    minDistance = distance;
                    nearestHospital = hospital;
                }
            });

            if (!nearestHospital) {
                console.log('No hospitals found nearby.');
                res.status(404).send({ message: 'No hospitals found nearby.' });
                return;
            }

            data.hlat = nearestHospital.lat;
            data.hlng = nearestHospital.lng;
            data.hospital_name = nearestHospital.name;

            console.log('Nearest hospital found:', {
                name: nearestHospital.name,
                hlat: nearestHospital.lat,
                hlng: nearestHospital.lng
            });

            clients.forEach(client => {
                if (client.readyState === 1) { // Use 1 for open state
                    client.send(JSON.stringify(data));
                }
            });

            res.status(200).send({ message: 'Nearest hospital data broadcasted.', data });
        } catch (error) {
            console.error('Error processing hospital request:', error.message || error);
            res.status(500).send({ message: 'Error processing hospital request.', error: error.message || error });
        }
    } else {
        clients.forEach(client => {
            if (client.readyState === 1) { // Use 1 for open state
                client.send(JSON.stringify(data));
            }
        });

        res.status(200).send({ message: 'Data broadcasted.' });
    }
});
