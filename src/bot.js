import TelegramBot from "node-telegram-bot-api";
export class FoodBot {
    constructor(token, aiAgent) {
        this.bot = new TelegramBot(token, {
            polling: {
                interval: 300,
                autoStart: true,
                params: {
                    timeout: 10
                }
            }
        });
        this.aiAgent = aiAgent;
        this.userSessions = new Map();
        this.bot.on('polling_error', (error) => {
            console.error('❌ Telegram Polling Error:', error.message);
            if (error.message.includes('404')) {
                console.error('\n⚠️  Your Telegram bot token is invalid or the bot was deleted.');
                console.error('Please create a new bot:');
                console.error('1. Open Telegram and search for @BotFather');
                console.error('2. Send /newbot and follow instructions');
                console.error('3. Copy the new token to .env file');
                console.error('4. Restart the application\n');
            }
        });
        this.setupCommands();
        this.setupMessageHandlers();
    }
    getUserSession(chatId) {
        const key = String(chatId);
        if (!this.userSessions.has(key)) {
            this.userSessions.set(key, {
                location: this.aiAgent.defaultLocation,
                selectedRestaurant: null,
                cart: [],
                awaitingInput: null,
            });
        }
        return this.userSessions.get(key);
    }
    setupCommands() {
        this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
        this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
        this.bot.onText(/\/setlocation (.+)/, (msg, match) => this.handleSetLocation(msg, match));
        this.bot.onText(/\/reset/, (msg) => this.handleReset(msg));
    }
    setupMessageHandlers() {
        this.bot.on("message", (msg) => {
            if (!msg.text || msg.text.startsWith("/")) return;
            this.handleAIMessage(msg);
        });
    }
    async handleStart(msg) {
        const chatId = msg.chat.id;
        const session = this.getUserSession(chatId);
        const welcomeMessage = `
🍔 Welcome to Bhook.exe - Your AI Food Ordering Assistant!
I understand natural language! Just tell me what you want:
Examples:
• "Find me the cheapest pav bhaji near me"
• "I want biryani under 200 rupees"
• "Show me pizza places with good ratings"
• "Order 2 masala dosa from the cheapest place"
📍 Your current location: ${session.location}
Commands:
/setlocation <location> - Change location
/reset - Clear conversation history
/help - Show help
Just type what you want and I'll help you! 🤖
    `;
        this.bot.sendMessage(chatId, welcomeMessage);
    }
    async handleHelp(msg) {
        const chatId = msg.chat.id;
        const helpMessage = `
🤖 AI Food Ordering Bot
I'm an AI assistant that understands natural language!
Example requests:
• "Find cheapest pav bhaji near me"
• "Show me biryani places under ₹300"
• "Get me 2 masala dosa, cheapest option"
• "What's in my cart?"
• "Place the order"
• "Find pizza with 4+ star rating"
I will:
✓ Search restaurants for you
✓ Compare prices automatically
✓ Find the best deals
✓ Add items to cart
✓ Place orders when you confirm
Commands:
/setlocation <location> - Change delivery location
/reset - Clear conversation
/help - Show this message
Just chat naturally! 💬
    `;
        this.bot.sendMessage(chatId, helpMessage);
    }
    async handleSetLocation(msg, match) {
        const chatId = msg.chat.id;
        const location = match[1];
        const session = this.getUserSession(chatId);
        session.location = location;
        this.bot.sendMessage(
            chatId,
            `📍 Location set to: ${location}\n\nNow just tell me what you want to eat!`
        );
    }
    async handleReset(msg) {
        const chatId = msg.chat.id;
        this.aiAgent.clearHistory(chatId);
        this.bot.sendMessage(chatId, "🔄 Conversation history cleared!");
    }
    async handleAIMessage(msg) {
        const chatId = msg.chat.id;
        const userMessage = msg.text;
        const session = this.getUserSession(chatId);
        this.bot.sendChatAction(chatId, "typing").catch(() => {});
        const typingInterval = setInterval(() => {
            this.bot.sendChatAction(chatId, "typing").catch(() => {});
        }, 4000);
        try {
            const response = await this.aiAgent.processUserRequest(
                chatId,
                userMessage,
                session.location
            );
            try {
                await this.bot.sendMessage(chatId, response, {
                    parse_mode: "Markdown",
                    disable_web_page_preview: true
                });
            } catch (mdErr) {
                console.warn("⚠️ Markdown parse failed, delivering message as plain text:", mdErr.message);
                await this.bot.sendMessage(chatId, response, {
                    disable_web_page_preview: true
                });
            }
        } catch (error) {
            console.error("AI message error:", error);
            this.bot.sendMessage(
                chatId,
                `❌ Sorry, I encountered an error: ${error.message}\n\nPlease try again or use /help for assistance.`
            );
        } finally {
            clearInterval(typingInterval);
        }
    }
    start() {
        console.log("🤖 Telegram bot started!");
    }
}
