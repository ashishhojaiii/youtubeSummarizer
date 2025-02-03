import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import { YoutubeTranscript } from "youtube-transcript";
import axios from "axios"; // Import axios for API requests
import fs from "fs"; // Import fs for file operations

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json());
app.use(bodyParser.json());

import { GoogleGenerativeAI } from "@google/generative-ai";

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'homepage.html'));
});

let globaltranscript = [];
app.post("/", async (req, res) => {
    const { url, question } = req.body;
    console.log(question);

    // Get the client's real IP address
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;

    // Check if the IP is "::1" (localhost) and replace with a test IP
    const realIp = ip === "::1" ? "8.8.8.8" : ip;

    // Fetch geolocation data using Axios
    let location = {};
    try {
        const response = await axios.get(`http://ip-api.com/json/${realIp}`);
        location = {
            city: response.data.city || "Unknown",
            region: response.data.regionName || "Unknown",
            country: response.data.country || "Unknown"
        };
    } catch (error) {
        console.error("Error fetching geolocation data:", error.message);
        location = { city: "Unknown", region: "Unknown", country: "Unknown" };
    }

    // Fetch the transcript
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    transcript.forEach((element) => {
        globaltranscript.push(element.text);
        console.log(element.text)
    });

    let fulltext = globaltranscript.join(',');
    const genAI = new GoogleGenerativeAI("AIzaSyAy21yHlGAoeWXsycUKi2JtvB-S0vk_vis");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    let prompt = `${question} ${fulltext}`;
    const result = await model.generateContent(prompt);
    const summarized_data = result.response.text();

    console.log(location);

    // Save the location to a file
    const locationData = {
        ip: realIp,
        location: location,
        timestamp: new Date().toISOString()
    };

    // Write the location data to a file
    fs.appendFile("location_data.json", JSON.stringify(locationData, null, 2) + ",\n", (err) => {
        if (err) {
            console.error("Error saving location data to file:", err);
        } else {
            console.log("Location data saved successfully.");
        }
    });

    // Return the summarized data and geolocation
    res.json({
        result: summarized_data,
        ip: realIp,
        location: location
    });
});

app.listen(8080, () => {
    console.log("Listening on port 8080");
});
