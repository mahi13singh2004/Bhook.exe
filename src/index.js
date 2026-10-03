import dotenv from "dotenv";
import { FoodBot } from "./bot.js";
import { swiggyClient } from "./swiggyClient.js";
import { AIAgent } from "./aiAgent.js";

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DEFAULT_LOCATION = process.env.DEFAULT_LOCATION || "Koramangala, Bengaluru";

if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN not found in .env file");
    process.exit(1);
}

if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY not found in .env file");
    console.error("Get your API key from: https://console.groq.com/");
    process.exit(1);
}

async function main() {
    try {
        console.log("🚀 Starting Bhook.exe...");

        console.log("🔗 Connecting to Swiggy MCP...");
        await swiggyClient.connect();

        const userLocation = swiggyClient.defaultAddress || DEFAULT_LOCATION;

        console.log("🤖 Initializing AI Agent (Groq)...");
        const aiAgent = new AIAgent(GROQ_API_KEY, userLocation);

        console.log("📱 Starting Telegram bot...");
        const bot = new FoodBot(TELEGRAM_BOT_TOKEN, aiAgent);
        bot.start();

        console.log("✅ Bot is running! Send /start to your bot on Telegram.");
        console.log(`📍 Default location: ${userLocation}`);
    } catch (error) {
        console.error("❌ Error starting bot:", error);
        process.exit(1);
    }
}

main();
