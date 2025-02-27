import { WebSocketServer } from 'ws'; // Only import WebSocketServer
import bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import nodemailer from "./nodemailer.config.js";

const app = express();

// Add CORS middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // Allow all origins (Change * to specific domain for security)
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    
    if (req.method === "OPTIONS") {
        return res.sendStatus(200); // Handle preflight requests
    }
    
    next();
});


const PORT = process.env.PORT || 3000;

// Create the HTTP server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// Create the WebSocket server using the same HTTP server
const wss = new WebSocketServer({ server });

app.use(bodyParser.json());

let clients = [];

wss.on('connection', (ws) => {
    console.log('✅ New WebSocket connection established');
    clients.push(ws);

    ws.on('close', () => {
        console.log('❌ WebSocket connection closed');
        clients = clients.filter(client => client !== ws);
    });

    ws.on('error', (error) => {
        console.error('⚠️ WebSocket error:', error);
    });

    ws.on('message', (message) => {
        const messageStr = message.toString();
        console.log('📩 Message received from client:', messageStr);

        try {
            const data = JSON.parse(messageStr);
            console.log('📨 Parsed message:', data);

            // Broadcast message to all other clients
            clients.forEach(client => {
                if (client !== ws && client.readyState === 1) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (err) {
            console.error('⚠️ Error parsing message as JSON:', err);
        }
    });
});

let hospitals = {
    "Ganga Hospital": { name: "Ganga Hospital", lat: 11.0225, lng: 76.9606, status: false },
    "Amrita Clinic": { name: "Amrita Clinic", lat: 10.9017502, lng: 76.9011755, status: false }
};

function findNearestHospital(lat, lon) {
    let nearestHospital = null;
    let minDistance = Infinity;

    Object.values(hospitals).forEach(hospital => {
        console.log(hospital.name);
        console.log(hospital.status);
        if (hospital.status) { // Check only active hospitals
            const distance = Math.sqrt(
                Math.pow(hospital.lat - lat, 2) + Math.pow(hospital.lng - lon, 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                nearestHospital = hospital;
            }
        }
    });
    return nearestHospital;
}

// Function to process hospital requests
async function handle_request(data, res) {
    if (data.type === "status_update") {
        console.log("🔄 Updating hospital status");
        if (hospitals[data.hname]) {
            hospitals[data.hname].status = !hospitals[data.hname].status;
            console.log(hospitals[data.hname].name);
            console.log(hospitals[data.hname].status);
            res.status(200).json({ message: "Status updated successfully", status: hospitals[data.hname].status });
        } else {
            res.status(400).json({ error: "Hospital not found" });
        }
    } else if (data.type === "hospital_request") {
        try {
            const lat = parseFloat(data.lat);
            const lon = parseFloat(data.lng);

            let nearestHospital = findNearestHospital(lat, lon);

            if (!nearestHospital) {
                console.log('🚫 No hospitals found nearby.');
                return res.status(404).json({ message: 'No hospitals found nearby.' });
            }

            // Send hospital details to clients
            data.hlat = nearestHospital.lat;
            data.hlng = nearestHospital.lng;
            data.hospital_name = nearestHospital.name;

            console.log('🏥 Nearest hospital found:', nearestHospital.name);

            clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(data));
                }
            });

            res.status(200).json({ message: 'Nearest hospital data broadcasted.', data });

            // Send emergency email notification
            await nodemailer.sendMail({
                from: `"Emergency Alert System" <${process.env.EMAIL_USER}>`,
                to: "raamprathap17242@gmail.com",
                subject: "🚨 URGENT: Accident Notification & Assistance Needed",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f8f9fa;">
                        <h2 style="color: #d9534f; text-align: center;">🚨 Emergency Alert! 🚨</h2>
                        <p><strong>Raam</strong> has been involved in an accident.</p>
                        <p><b>🏥 Nearest Hospital:</b> ${data.hospital_name}</p>
                        <p>Immediate attention is required.</p>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <p style="text-align: center;">
                            <a href="https://www.google.com/maps/search/${encodeURIComponent(data.location)}"
                            style="background-color: #d9534f; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
                            📍 View Location
                            </a>
                        </p>
                    </div>
                `,
            });
        } catch (error) {
            console.error('⚠️ Error processing hospital request:', error);
            res.status(500).json({ message: 'Error processing hospital request.', error: error.message });
        }
    }else if (data.type === "Deny_request") {
        console.log("🚫 Deny request received, searching for next available hospital...");
        const lat = parseFloat(data.lat);
        const lon = parseFloat(data.lng);

        let nearestHospital = findNearestHospital(lat, lon);

        if (nearestHospital) {
            console.log('🏥 Hospital became available:', nearestHospital.name);
            data.hlat = nearestHospital.lat;
            data.hlng = nearestHospital.lng;
            data.hospital_name = nearestHospital.name;
            console.log("yo");
            clients.forEach(client => {
                console.log("yo1");
                if (client.readyState === 1) {
                    console.log("yo2");
                    client.send(JSON.stringify(data));
                }
            });
        } else {
            console.log('🚫 No available hospitals. Waiting for status change...');
            let interval = setInterval(() => {
                nearestHospital = findNearestHospital(lat, lon);
                if (nearestHospital) {
                    clearInterval(interval);
                    console.log('🏥 Hospital became available:', nearestHospital.name);
                    data.hlat = nearestHospital.lat;
                    data.hlng = nearestHospital.lng;
                    data.hospital_name = nearestHospital.name;
                    clients.forEach(client => {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify(data));
                        }
                    });
                }
            }, 5000); // Check every 5 seconds
            return res.status(202).json({ message: 'Waiting for hospital availability.' });
        }
    } else {
        console.log('❓ Unknown request type:', data.type);
        res.status(400).json({ error: 'Invalid request type' });
    }
}

// Handle HTTP POST requests to the /signal endpoint
app.post('/signal', (req, res) => {
    console.log('📩 Received POST request:', req.body);
    handle_request(req.body, res);
});
