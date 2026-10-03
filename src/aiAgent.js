import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { swiggyClient } from "./swiggyClient.js";
const HISTORY_FILE = path.resolve("./conversation_history.json");
function loadHistoryFromFile() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
            const data = JSON.parse(raw);
            const map = new Map();
            for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value)) {
                    map.set(String(key), value);
                }
            }
            console.log(`✓ Loaded conversation history for ${map.size} chat(s) from disk.`);
            return map;
        }
    } catch (e) {
        console.error("Could not read conversation history from disk:", e.message);
    }
    return new Map();
}
function saveHistoryToFile(historyMap) {
    try {
        const obj = {};
        for (const [key, value] of historyMap.entries()) {
            obj[key] = value;
        }
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(obj, null, 2), "utf-8");
    } catch (e) {
        console.error("Could not write conversation history to disk:", e.message);
    }
}
export class AIAgent {
    constructor(apiKey, defaultLocation) {
        this.groq = new Groq({ apiKey });
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey) {
            this.gemini = new GoogleGenerativeAI(geminiKey);
        }
        this.defaultLocation = defaultLocation;
        this.conversationHistory = loadHistoryFromFile();
        this.activeModel = process.env.AI_MODEL || "gemini-3.8-flash";
        this.useGemini = process.env.USE_GEMINI === "true";
    }
    async callAI(params) {
        if (this.useGemini && this.gemini) {
            const model = this.gemini.getGenerativeModel({
                model: this.activeModel,
                tools: params.tools ? [{
                    functionDeclarations: params.tools.map(t => ({
                        name: t.function.name,
                        description: t.function.description,
                        parameters: t.function.parameters
                    }))
                }] : undefined
            });
            const chat = model.startChat({
                history: params.messages.slice(0, -1).map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content || '' }]
                }))
            });
            const lastMessage = params.messages[params.messages.length - 1];
            const result = await chat.sendMessage(lastMessage.content || '');
            const response = result.response;
            const functionCalls = response.functionCalls();
            return {
                choices: [{
                    message: {
                        role: 'assistant',
                        content: response.text() || null,
                        tool_calls: functionCalls ? functionCalls.map((fc, idx) => ({
                            id: `call_${idx}`,
                            type: 'function',
                            function: {
                                name: fc.name,
                                arguments: JSON.stringify(fc.args)
                            }
                        })) : []
                    }
                }]
            };
        }
        return await this.groq.chat.completions.create(params);
    }
    getConversation(chatId) {
        const key = String(chatId);
        if (!this.conversationHistory.has(key)) {
            this.conversationHistory.set(key, []);
        }
        return this.conversationHistory.get(key);
    }
    addMessage(chatId, role, content) {
        const key = String(chatId);
        const conversation = this.getConversation(key);
        if (role === "user" && conversation.length > 0 && conversation[conversation.length - 1].role === "user") {
            conversation[conversation.length - 1].content = content;
        } else {
            conversation.push({ role, content });
        }
        if (conversation.length > 10) {
            conversation.splice(0, conversation.length - 10);
        }
        saveHistoryToFile(this.conversationHistory);
    }
    clearHistory(chatId) {
        const key = String(chatId);
        this.conversationHistory.delete(key);
        saveHistoryToFile(this.conversationHistory);
    }
    async processUserRequest(chatId, userMessage, userLocation = null) {
        const location = userLocation || this.defaultLocation;
        this.addMessage(chatId, "user", userMessage);
        const tools = [
            {
                type: "function",
                function: {
                    name: "search_restaurants",
                    description: "Search for restaurants. Returns list of restaurants with name, ID, rating, cuisine, and price info.",
                    parameters: {
                        type: "object",
                        properties: {
                            addressId: {
                                type: "string",
                                description: "The Swiggy address ID (default: " + (swiggyClient.defaultAddressId || "clc56hdghv47q7okshn0__AMTpzwSeqDwH1fusz4g_vh") + ")"
                            },
                            query: {
                                type: "string",
                                description: "Search query like dish name, cuisine type, or restaurant name"
                            }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "search_menu",
                    description: "Search for specific items across restaurant menus. Find dishes by name.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Dish or item name to search for"
                            },
                            addressId: {
                                type: "string",
                                description: "The Swiggy address ID (optional, defaults to home)"
                            }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_restaurant_menu",
                    description: "Get the full menu of a specific restaurant with item names, IDs, prices, and descriptions. Requires restaurantId and addressId.",
                    parameters: {
                        type: "object",
                        properties: {
                            restaurantId: {
                                type: "string",
                                description: "The ID of the restaurant"
                            },
                            addressId: {
                                type: "string",
                                description: "The delivery address ID (optional, defaults to home)"
                            }
                        },
                        required: ["restaurantId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_food_cart",
                    description: "View current cart contents with items, quantities, and total price.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_food_cart",
                    description: "Add items to food delivery cart. Provide restaurantId and cartItems array. Each cart item must have menu_item_id (from menu/search), quantity, and optionally variants/addons.",
                    parameters: {
                        type: "object",
                        properties: {
                            restaurantId: {
                                type: "string",
                                description: "Restaurant ID for all items"
                            },
                            cartItems: {
                                type: "array",
                                description: "Array of items to add to cart",
                                items: {
                                    type: "object",
                                    properties: {
                                        menu_item_id: {
                                            type: "string",
                                            description: "Menu item ID (must match exactly from menu/search response)"
                                        },
                                        quantity: {
                                            type: "number",
                                            description: "Quantity to add"
                                        },
                                        variants: {
                                            type: "array",
                                            description: "Optional variants for customization",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    group_id: { type: "string" },
                                                    variation_id: { type: "string" }
                                                }
                                            }
                                        },
                                        addons: {
                                            type: "array",
                                            description: "Optional addons",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    group_id: { type: "string" },
                                                    id: { type: "string" },
                                                    quantity: { type: "number" }
                                                }
                                            }
                                        }
                                    },
                                    required: ["menu_item_id", "quantity"]
                                }
                            },
                            addressId: {
                                type: "string",
                                description: "Address ID for delivery charges"
                            }
                        },
                        required: ["restaurantId", "cartItems", "addressId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "flush_food_cart",
                    description: "Clear/empty the entire cart. Remove all items.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "fetch_food_coupons",
                    description: "Get available coupons and offers for food delivery. Returns ALL coupons including online payment offers. Show which coupons require online payment vs COD.",
                    parameters: {
                        type: "object",
                        properties: {
                            restaurantId: {
                                type: "string",
                                description: "Restaurant ID for the cart"
                            },
                            addressId: {
                                type: "string",
                                description: "Address ID where order will be delivered"
                            },
                            couponCode: {
                                type: "string",
                                description: "Optional specific coupon code to check applicability"
                            }
                        },
                        required: ["restaurantId", "addressId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "apply_food_coupon",
                    description: "Apply a coupon code to the food delivery cart. Returns updated cart with applied discount. Treat coupon as applied only when coupon_discount > 0.",
                    parameters: {
                        type: "object",
                        properties: {
                            couponCode: {
                                type: "string",
                                description: "Coupon code to apply"
                            },
                            addressId: {
                                type: "string",
                                description: "Address ID for the delivery"
                            },
                            cartId: {
                                type: "string",
                                description: "Optional cart ID"
                            }
                        },
                        required: ["couponCode", "addressId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "place_food_order",
                    description: "Place the order from cart with delivery address and payment method.",
                    parameters: {
                        type: "object",
                        properties: {
                            address_id: {
                                type: "string",
                                description: "Address ID from saved addresses"
                            },
                            payment_method: {
                                type: "string",
                                description: "Payment method (e.g., COD, UPI, Card)"
                            }
                        },
                        required: []
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_food_orders",
                    description: "Get list of past and current food orders.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_food_order_details",
                    description: "Get detailed information about a specific order including items, price, status.",
                    parameters: {
                        type: "object",
                        properties: {
                            order_id: {
                                type: "string",
                                description: "The order ID to get details for"
                            }
                        },
                        required: ["order_id"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "track_food_order",
                    description: "Track delivery status of an active order. Shows delivery partner info and ETA.",
                    parameters: {
                        type: "object",
                        properties: {
                            order_id: {
                                type: "string",
                                description: "The order ID to track"
                            }
                        },
                        required: ["order_id"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_food_delivery_status",
                    description: "Get real-time delivery status and location of delivery partner.",
                    parameters: {
                        type: "object",
                        properties: {
                            order_id: {
                                type: "string",
                                description: "The order ID"
                            }
                        },
                        required: ["order_id"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_addresses",
                    description: "Get all saved delivery addresses.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_payment_options",
                    description: "Get available payment methods for checkout.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            }
        ];
        const activeAddressId = swiggyClient.defaultAddressId || "clc56hdghv47q7okshn0__AMTpzwSeqDwH1fusz4g_vh";
        const systemPrompt = `You are a helpful food ordering assistant for Swiggy called Bhook.exe.
CRITICAL USER DETAILS:
- Delivery Address: SF-02, JSSATE BOYS HOSTEL, Rajarajeshwari Nagar, Bengaluru
- Address ID: "${activeAddressId}"
- NEVER ask the user to confirm their location or address. It is already set to the JSSATE Hostel address.
- When calling tools that need an address (e.g. search_restaurants, search_menu, get_restaurant_menu, place_food_order, fetch_food_coupons), use addressId: "${activeAddressId}".
AVAILABLE SWIGGY MCP TOOLS & USAGE:
- search_restaurants: { addressId: "${activeAddressId}", query: "dish/cuisine name" } -> Finds restaurants serving the query near the hostel address.
- search_menu: { addressId: "${activeAddressId}", query: "item name" } -> Searches for specific dishes across menus.
- get_restaurant_menu: { addressId: "${activeAddressId}", restaurantId: "id" } -> Gets full menu items, prices, and descriptions. Always pass addressId and restaurantId!
- fetch_food_coupons: { addressId: "${activeAddressId}", restaurantId: "id" } -> Fetches active coupons, discount %, caps, and eligibility for a restaurant. Always pass addressId and restaurantId!
- get_food_cart: {} -> Views current cart contents.
- update_food_cart: { restaurantId: "id", cartItems: [{ itemId: "id", quantity: 1 }] } -> Adds items to cart. restaurantId is required at top level.
- flush_food_cart: {} -> Empties the cart.
- apply_food_coupon: { coupon_code } -> Applies a coupon code to the cart.
- get_addresses: {} -> Retrieves saved addresses.
- place_food_order: { address_id: "${activeAddressId}", payment_method } -> Places order.
- get_food_orders: {} -> Lists order history.
- track_food_order: { order_id } -> Tracks active delivery status.
ERROR HANDLING:
- If update_food_cart returns "item is NO LONGER AVAILABLE" error:
  1. DO NOT retry update_food_cart again with the same item
  2. Immediately tell the user: "Sorry, that item is no longer available"
  3. Call get_restaurant_menu to get fresh menu
  4. Show alternative items from the same category
- If you get rate limit errors (429), tell the user "Swiggy's servers are busy. Please try again in a minute." DO NOT retry immediately.
- If a restaurant is closed, inform the user and suggest alternatives
- Never retry the same failed operation more than once
CONVERSATION MEMORY & PAST CONTEXT:
- You have access to the entire previous conversation history.
- ALWAYS remember what was previously asked, which restaurants/dishes were shown, prices, item IDs, restaurant IDs, and past answers.
- If the user asks a follow-up (e.g. "which of these have 70% off coupon?", "what was option 1?", "what did I say earlier?"), directly reference the options and conversation from earlier turns.
DECISIVE ACTION - BE CONFIDENT, NOT CAUTIOUS:
- When the user clearly indicates a choice (e.g., "add spring rolls", "lets go with 4pc", "get the chicken one", "add it"), IMMEDIATELY call update_food_cart with the item.
- DO NOT ask "Do you want me to add this?" or "Should I proceed?" when the user has already decided.
- DO NOT ask for confirmation after presenting options if the user has made a clear selection.
- Phrases like "add", "get", "order", "lets go with", "I'll take", "give me" = IMMEDIATE ACTION, not questions.
- After successfully adding to cart, confirm with "✅ Added [item name] to your cart!" and show the updated cart or ask what's next.
- If add to cart fails because item unavailable, immediately fetch fresh menu and suggest alternatives.
COUPONS & DISCOUNTS HANDLING:
- DO NOT check or fetch coupons by default! When the user asks to find food or restaurants (e.g. "I want cake", "Find ice cream", "Show pizza places"), ONLY call search_restaurants or search_menu and present the restaurants immediately.
- ONLY call fetch_food_coupons if the user EXPLICITLY asks for coupons, discounts, offers, deals, or cheaper prices.
- When explicitly checking coupons, supply addressId: "${activeAddressId}" and restaurantId.
- Show ALL available coupons including online payment coupons - DO NOT filter to COD-only.
- Clearly indicate which coupons require online payment vs COD.
- If the user asks for a specific discount (like "70% off") and no restaurant offers 70% off, clearly tell them the best available discounts instead.
RULES & EFFICIENCY:
1. ALWAYS fulfill the user's LATEST message. If the user changes what they want (e.g. from ice cream to cake), immediately search for the new item!
2. Standard food queries should only require ONE tool call (search_restaurants). Show the results immediately.
3. DO NOT check coupons unless explicitly requested by the user.
4. DO NOT return placeholder or status messages like "Checking...", "One moment...", or "I'll be back". Call the tool directly and return the final answer.
5. Show restaurant names, dishes, prices, ratings, and delivery times clearly in clean Markdown with emojis.
6. BE DECISIVE: When user makes a choice, execute it immediately without asking for confirmation again.
7. Handle errors gracefully: If item unavailable, suggest alternatives. If rate limited, ask user to wait.`;
        const conversation = this.getConversation(chatId);
        const messages = [
            { role: "system", content: systemPrompt },
            ...conversation
        ];
        try {
            let response = await this.callAI({
                model: this.activeModel,
                messages: messages,
                tools: tools,
                tool_choice: "auto",
                max_tokens: 2048
            });
            let finalResponse = "";
            const maxIterations = 10;
            let iterations = 0;
            const failedOperations = new Set(); // Track failed operations to prevent retries
            while (response.choices[0].message?.tool_calls?.length > 0 && iterations < maxIterations) {
                iterations++;
                const toolCalls = response.choices[0].message.tool_calls;
                messages.push(response.choices[0].message);
                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    let operationSignature;
                    if (functionName === 'update_food_cart') {
                        const items = functionArgs.items || functionArgs.cartItems || [];
                        const itemIds = items.map(item => item.itemId).sort().join(',');
                        operationSignature = `${functionName}:${functionArgs.restaurantId}:${itemIds}`;
                    } else {
                        operationSignature = `${functionName}:${JSON.stringify(functionArgs)}`;
                    }
                    if (failedOperations.has(operationSignature)) {
                        console.log(`Skipping retry of failed operation: ${functionName}`);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: functionName,
                            content: `⚠️ RETRY BLOCKED: This operation already failed. Do not retry the same operation. Try a different approach or inform the user.`
                        });
                        continue;
                    }
                    console.log(`AI calling tool: ${functionName}`, functionArgs);
                    try {
                        const result = await swiggyClient.callTool(functionName, functionArgs);
                        let contentParts = [];
                        if (result?.structuredContent) {
                            contentParts.push(typeof result.structuredContent === "string"
                                ? result.structuredContent
                                : JSON.stringify(result.structuredContent, null, 2));
                        }
                        if (result?.content && Array.isArray(result.content)) {
                            contentParts.push(...result.content.map(c => c.text || JSON.stringify(c)));
                        }
                        if (contentParts.length === 0) {
                            contentParts.push(JSON.stringify(result || {}));
                        }
                        let resultContent = contentParts.join("\n\n");
                        try {
                            const parsedResult = result?.structuredContent ||
                                (result?.content?.[0]?.text ? JSON.parse(result.content[0].text) : null);
                            if (parsedResult) {
                                if (parsedResult.statusCode === 1 && parsedResult.titleMessage?.includes("no longer available")) {
                                    resultContent = `⚠️ ERROR: The item is NO LONGER AVAILABLE on the menu.\n\nSwiggy says: "${parsedResult.titleMessage}"\n\n🔧 ACTION REQUIRED: Immediately call get_restaurant_menu to fetch the current menu and suggest similar alternatives to the user.`;
                                }
                                else if (parsedResult.statusMessage?.includes("closed")) {
                                    resultContent = `⚠️ ERROR: Restaurant is CLOSED.\n\nMessage: "${parsedResult.statusMessage}"\n\n🔧 ACTION REQUIRED: Inform the user the restaurant is closed and suggest checking opening hours or finding another restaurant.`;
                                }
                                else if (parsedResult.reportId || resultContent.includes("Report ID:")) {
                                    resultContent = `⚠️ ERROR: ${parsedResult.statusMessage || "Something went wrong"}\n\nFull error:\n${resultContent}`;
                                }
                            }
                        } catch (e) {
                        }
                        if (resultContent.length > 8000) {
                            resultContent = resultContent.slice(0, 8000) + "... [truncated for brevity]";
                        }
                        console.log(`Tool ${functionName} success. Response length: ${resultContent.length}`);
                        console.log(`Tool ${functionName} preview:`, resultContent.slice(0, 250));
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: functionName,
                            content: resultContent
                        });
                    } catch (error) {
                        console.error(`Tool error for ${functionName}:`, error.message);
                        failedOperations.add(operationSignature);
                        let errorMessage = `Error: ${error.message}`;
                        if (error.code === 429 || error.message?.includes('429') || error.message?.includes('rate limit')) {
                            errorMessage = `⚠️ RATE LIMIT ERROR: Swiggy's servers are busy right now.\n\n🔧 ACTION REQUIRED: Stop making more requests. Tell the user: "Swiggy's servers are busy at the moment. Please try again in a few minutes." Do not retry or make any more tool calls.`;
                        }
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: functionName,
                            content: errorMessage
                        });
                    }
                }
                response = await this.callAI({
                    model: this.activeModel,
                    messages: messages,
                    tools: tools,
                    tool_choice: "auto",
                    max_tokens: 2048
                });
            }
            finalResponse = response.choices[0].message.content || "I processed your request.";
            this.addMessage(chatId, "assistant", finalResponse);
            return finalResponse;
        } catch (error) {
            console.error("AI Agent error:", error);
            throw error;
        }
    }
    clearHistory(chatId) {
        this.conversationHistory.delete(chatId);
    }
}
