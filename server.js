import { WebSocketServer } from 'ws'; // Only import WebSocketServer
import bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import nodemailer from "./nodemailer.config.js";

const app = express();

// Add CORS middleware
app.use(cors({
    origin: 'https://post-accident-alert-system.onrender.com',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));


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

let hospitals = {
    "Ganga Hospital": { name: "Ganga Hospital", lat: 11.0225, lng: 76.9606, status: false},
    "Amrita Clinic": { name: "Amrita Clinic", lat: 10.9017502, lng: 76.9011755, status: false }
};

async function handle_request(data, res){
    if(data.type === "status_update"){
        hospitals[data.hname].status = hospitals[data.hname].status === false ? true : false;
    }else if (data.type === "hospital_request") {
        const lat = parseFloat(data.lat);
        const lon = parseFloat(data.lng);

        try {

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

            // **Trigger email alert here**
            if (true) {
                await nodemailer.sendMail({
                    from: `"Emergency Alert System" <${process.env.EMAIL_USER}>`,
                    to: "raamprathap17242@gmail.com",
                    subject: "🚨 URGENT: Accident Notification & Assistance Needed",
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f8f9fa;">
                            <h2 style="color: #d9534f; text-align: center;">🚨 Emergency Alert! 🚨</h2>
                            <p style="font-size: 16px; color: #333;"><strong>Raam</strong> has been involved in an accident.</p>
                            <p style="font-size: 16px; color: #333;"><b>🏥 Nearest Hospital:</b> ${data.hospital_name}</p>
                            <p style="font-size: 16px; color: #333;">Immediate attention is required. Please take necessary action.</p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                            <p style="text-align: center;">
                                <a href="https://www.google.com/maps/search/${encodeURIComponent(data.location)}" 
                                style="background-color: #d9534f; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
                                📍 View Location
                                </a>
                            </p>
                            <p style="text-align: center; font-size: 14px; color: #666;">Stay safe and act fast!</p>
                        </div>
                    `,
                });
            }


            res.status(200).send({ message: 'Nearest hospital data broadcasted.', data });
        } catch (error) {
            console.error('Error processing hospital request:', error.message || error);
            res.status(500).send({ message: 'Error processing hospital request.', error: error.message || error });
        }
    } else if (data.type === "Deny_request") {
        console.log("Processing deny request");
        const lat = parseFloat(data.lat);
        const lon = parseFloat(data.lng);
        data.type = 'hospital_request';
    
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
                if (distance < minDistance && hospital.status){
                    minDistance = distance;
                    nearestHospital = hospital;
                }
            });
    
            if (!nearestHospital) {
                handle_request(data, res);
                res.status(404).json({ message: 'No hospitals found nearby.' });
                return 
            }
    
            data.hlat = nearestHospital.lat;
            data.hlng = nearestHospital.lng;
            data.hospital_name = nearestHospital.name;
    
            clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(data));
                }
            });
    
            res.status(200).json({ message: 'Nearest hospital data broadcasted.', data });
        } catch (error) {
            console.error('Error processing hospital request:', error);
            res.status(500).json({ message: 'Error processing hospital request.', error: error.message });
        }
    } else {
        clients.forEach(client => {
            if (client.readyState === 1) { // Use 1 for open state
                client.send(JSON.stringify(data));
            }
        });

        res.status(200).send({ message: 'Data broadcasted.' });

    }
}

// app.post("/send-alert", async (req, res) => {
//     const { name, email, phone, location } = req.body;

//     if (!name || !email || !phone || !location) {
//         return res.status(400).json({ error: "Missing required fields" });
//     }

//     try {
//         // Sending SMS Alert
//         // await twilioClient.messages.create({
//         //     body: `🚨 Emergency Alert! 🚨\n${name} met with an accident at ${location}. Please respond immediately.`,
//         //     from: process.env.TWILIO_PHONE_NUMBER,
//         //     to: phone,
//         // });

//         // Sending Email Alert
//         await nodemailer.sendMail({
//             from: `"Emergency Alert System" <${process.env.EMAIL_USER}>`,
//             to: email,
//             subject: "🚨 URGENT: Accident Notification & Assistance Needed",
//             html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f8f9fa;">
//                     <h2 style="color: #d9534f; text-align: center;">🚨 Emergency Alert! 🚨</h2>
//                     <p style="font-size: 16px; color: #333;"><strong>${name}</strong> has been involved in an accident.</p>
//                     <p style="font-size: 16px; color: #333;"><b>📍 Location:</b> ${location}</p>
//                     <p style="font-size: 16px; color: #333;">Immediate attention is required. Please take necessary action and ensure help is on the way.</p>
//                     <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
//                     <p style="text-align: center;">
//                         <a href="https://www.google.com/maps/search/${encodeURIComponent(location)}" 
//                            style="background-color: #d9534f; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
//                            📍 View Location
//                         </a>
//                     </p>
//                     <p style="text-align: center; font-size: 14px; color: #666;">Stay safe and act fast!</p>
//                 </div>
//             `,
//         });        

//         return res.status(200).json({ success: true, message: "Alert sent successfully!" });
//     } catch (error) {
//         console.error("Error sending alert:", error);
//         return res.status(500).json({ error: "Failed to send alert", details: error.message });
//     }
// });

// Handle HTTP POST requests to the /signal endpoint
app.post('/signal', (req, res) => {
    const data = req.body;

    console.log('Received POST request:', data);

    handle_request(data, res);
});
