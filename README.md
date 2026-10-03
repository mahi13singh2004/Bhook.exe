# Bhook.exe 🍔🤖

An AI-powered Telegram bot that lets you order food from Swiggy using natural language! Just chat like you would with a friend.

## What Makes This Special?

🧠 **AI-Powered** - Uses Claude AI to understand natural language
💬 **Chat Naturally** - No complex commands, just say what you want
🔍 **Smart Search** - AI finds and compares prices automatically
📍 **Location Aware** - Uses your saved location (Koramangala, Bengaluru by default)

## Example Usage

Just chat with the bot:
- "Find me the cheapest pav bhaji near me"
- "I want biryani under 200 rupees"
- "Show me pizza places with good ratings"
- "Order 2 masala dosa from the cheapest place"
- "What's in my cart?"
- "Place the order"

The AI will:
1. Search restaurants
2. Compare prices
3. Find the best deals
4. Add items to cart
5. Confirm before ordering

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Get API Keys

**Telegram Bot Token:**
1. Open Telegram, search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow instructions
3. Copy the bot token

**Groq API Key:**
1. Go to [https://console.groq.com/](https://console.groq.com/)
2. Sign up or login (free tier available!)
3. Go to API Keys section
4. Create a new API key

### 3. Configure .env File

Edit `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
GROQ_API_KEY=your_groq_api_key_here
DEFAULT_LOCATION=Koramangala, Bengaluru
```

Change `DEFAULT_LOCATION` to your area.

### 4. Run the Bot

```bash
npm start
```

The bot will:
- Open browser for Swiggy OAuth login
- Connect to Swiggy MCP
- Initialize AI agent
- Start listening on Telegram

### 5. Start Chatting!

1. Find your bot on Telegram
2. Send `/start`
3. Start chatting naturally!

## How It Works

### Technology Stack

- **Telegram Bot API** - Interface
- **Groq (Llama 3.3 70B)** - Ultra-fast AI inference
- **Swiggy MCP** - Food ordering backend
- **Model Context Protocol** - AI-tool integration

### Architecture

```
User Message (Telegram)
    ↓
AI Agent (Groq - Llama 3.3)
    ↓
MCP Tools (Swiggy API)
    ↓
Response (Telegram)
```

The AI agent has access to these tools:
- `search_restaurants` - Search by location and query
- `get_restaurant_menu` - Get full menu with prices
- `add_to_cart` - Add items to cart
- `view_cart` - See cart contents
- `place_order` - Place the order

## Commands

- `/start` - Welcome message
- `/help` - Show help
- `/setlocation <location>` - Change location
- `/reset` - Clear conversation history

Everything else is natural language!

## Project Structure

```
bhook.exe/
├── src/
│   ├── index.js           # Main entry point
│   ├── bot.js             # Telegram bot
│   ├── aiAgent.js         # Groq AI integration
│   ├── swiggyClient.js    # Swiggy MCP wrapper
│   └── mcp/
│       ├── oauth.js       # OAuth authentication
│       └── swiggy.js      # MCP example
├── .env                   # Config (API keys)
├── package.json
└── README.md
```

## Example Conversations

**Example 1: Find cheapest option**
```
You: Find me the cheapest pav bhaji near me
Bot: 🔍 Let me search for pav bhaji places in Koramangala...

I found 3 restaurants:
1. Mumbai Pav Bhaji - ₹120
2. Street Food Corner - ₹89
3. Tasty Bites - ₹150

The cheapest is Street Food Corner at ₹89. Would you like me to add it to your cart?

You: Yes, add 2 plates
Bot: ✅ Added 2x Pav Bhaji from Street Food Corner (₹178 total) to your cart!
```

**Example 2: Budget search**
```
You: Show me biryani under 200 rupees
Bot: Here are biryani options under ₹200:
[AI lists restaurants with prices]
```

## Troubleshooting

**Bot not responding:**
- Check if both tokens are correct in `.env`
- Verify bot is running (`npm start`)

**AI not working:**
- Check Groq API key is correct
- Groq has generous free tier
- Make sure you're using valid key from console.groq.com

**Swiggy auth failed:**
- Complete OAuth flow in browser
- Try restarting the bot

## Cost Considerations

- **Telegram Bot**: Free
- **Swiggy MCP**: Free (uses your Swiggy account)
- **Groq API**: FREE tier with generous limits! 🎉
  - 30 requests/minute
  - 14,400 tokens/minute
  - Perfect for personal use

Groq is much faster and has a generous free tier!

## Privacy & Security

- OAuth tokens stored in memory only
- No data saved to disk
- Conversation history cleared on restart
- Use `/reset` to clear chat history

## License

ISC

