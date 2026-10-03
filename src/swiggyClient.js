import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { swiggyOAuthProvider } from "./mcp/oauth.js";
class SwiggyClient {
    constructor() {
        this.client = null;
        this.transport = null;
        this.isConnected = false;
        this.tokens = null;
        this.defaultAddress = null;
        this.defaultAddressId = null;
    }
    async connect() {
        if (this.isConnected) {
            return;
        }
        this.client = new Client({
            name: "BhookKaAgent",
            version: "1.0.0",
        });
        console.log("Logging into Swiggy...");
        this.tokens = await swiggyOAuthProvider.login();
        this.transport = new StreamableHTTPClientTransport(
            new URL("https://mcp.swiggy.com/food"),
            {
                requestInit: {
                    headers: {
                        Authorization: `Bearer ${this.tokens.access_token}`,
                    },
                },
            }
        );
        await this.client.connect(this.transport);
        this.isConnected = true;
        console.log("Connected to Swiggy MCP!");
        try {
            console.log("Fetching available Swiggy tools...");
            const tools = await this.listTools();
            console.log("Available tools:", tools.map(t => t.name).join(", "));
            const couponTool = tools.find(t => t.name === "fetch_food_coupons");
            if (couponTool) {
                console.log("fetch_food_coupons schema:", JSON.stringify(couponTool.inputSchema));
            }
            const addressTool = tools.find(t =>
                t.name.includes("address") ||
                t.name.includes("location") ||
                t.name.includes("user")
            );
            if (addressTool) {
                console.log(`Found address tool: ${addressTool.name}`);
                try {
                    const addressResult = await this.callTool(addressTool.name, {});
                    if (addressResult.structuredContent && addressResult.structuredContent.addresses) {
                        const addresses = addressResult.structuredContent.addresses;
                        console.log(`Found ${addresses.length} addresses`);
                        const homeAddress = addresses.find(addr =>
                            addr.addressTag && addr.addressTag.toLowerCase() === 'home'
                        );
                        if (homeAddress) {
                            this.defaultAddress = homeAddress.addressLine.split(': ')[1] || homeAddress.addressLine;
                            this.defaultAddressId = homeAddress.id;
                            console.log(`✓ Using your Home address: ${this.defaultAddress}`);
                        } else if (addresses.length > 0) {
                            this.defaultAddress = addresses[0].addressLine.split(': ')[1] || addresses[0].addressLine;
                            this.defaultAddressId = addresses[0].id;
                            console.log(`✓ Using your first address: ${this.defaultAddress}`);
                        }
                    }
                } catch (err) {
                    console.log("Could not fetch addresses:", err.message);
                }
            } else {
                console.log("No address tool found in Swiggy MCP");
            }
        } catch (error) {
            console.log("Note: Could not list tools:", error.message);
        }
    }
    async listTools() {
        if (!this.isConnected) {
            await this.connect();
        }
        const tools = await this.client.listTools();
        return tools.tools;
    }
    async callTool(toolName, args = {}) {
        if (!this.isConnected) {
            await this.connect();
        }
        const normalizedArgs = { ...args };
        if (normalizedArgs.address_id && !normalizedArgs.addressId) {
            normalizedArgs.addressId = normalizedArgs.address_id;
        }
        if (normalizedArgs.addressId && !normalizedArgs.address_id) {
            normalizedArgs.address_id = normalizedArgs.addressId;
        }
        const fallbackAddressId = this.defaultAddressId || "clc56hdghv47q7okshn0__AMTpzwSeqDwH1fusz4g_vh";
        if (!normalizedArgs.addressId && toolName !== "get_addresses") {
            normalizedArgs.addressId = fallbackAddressId;
            normalizedArgs.address_id = fallbackAddressId;
        }
        if (normalizedArgs.restaurant_id && !normalizedArgs.restaurantId) {
            normalizedArgs.restaurantId = normalizedArgs.restaurant_id;
        }
        if (normalizedArgs.restaurantId && !normalizedArgs.restaurant_id) {
            normalizedArgs.restaurant_id = normalizedArgs.restaurantId;
        }
        if (normalizedArgs.item_id && !normalizedArgs.itemId) {
            normalizedArgs.itemId = normalizedArgs.item_id;
        }
        if (normalizedArgs.itemId && !normalizedArgs.item_id) {
            normalizedArgs.item_id = normalizedArgs.itemId;
        }
        if (normalizedArgs.order_id && !normalizedArgs.orderId) {
            normalizedArgs.orderId = normalizedArgs.order_id;
        }
        if (normalizedArgs.orderId && !normalizedArgs.order_id) {
            normalizedArgs.order_id = normalizedArgs.orderId;
        }
        if (normalizedArgs.coupon_code && !normalizedArgs.couponCode) {
            normalizedArgs.couponCode = normalizedArgs.coupon_code;
        }
        if (normalizedArgs.couponCode && !normalizedArgs.coupon_code) {
            normalizedArgs.coupon_code = normalizedArgs.couponCode;
        }
        if (toolName === "apply_food_coupon" && !normalizedArgs.addressId && !normalizedArgs.address_id) {
            normalizedArgs.addressId = fallbackAddressId;
            normalizedArgs.address_id = fallbackAddressId;
        }
        if (toolName === "update_food_cart") {
            if (normalizedArgs.cartItems) {
                normalizedArgs.cartItems = normalizedArgs.cartItems.map(item => {
                    const converted = { ...item };
                    if (item.itemId && !item.menu_item_id) {
                        converted.menu_item_id = item.itemId;
                        delete converted.itemId;
                    }
                    return converted;
                });
            }
            if (normalizedArgs.items && !normalizedArgs.cartItems) {
                normalizedArgs.cartItems = normalizedArgs.items.map(item => {
                    const converted = { ...item };
                    if (item.itemId && !item.menu_item_id) {
                        converted.menu_item_id = item.itemId;
                        delete converted.itemId;
                    }
                    return converted;
                });
                delete normalizedArgs.items;
            }
            if (!normalizedArgs.restaurantId && normalizedArgs.restaurant_id) {
                normalizedArgs.restaurantId = normalizedArgs.restaurant_id;
            }
        }
        try {
            console.log(`[Swiggy MCP] Calling ${toolName} with:`, JSON.stringify(normalizedArgs));
            const result = await this.client.callTool({
                name: toolName,
                arguments: normalizedArgs,
            });
            console.log(`[Swiggy MCP] ${toolName} response received`);
            return result;
        } catch (error) {
            console.error(`Error calling tool ${toolName}:`, error);
            throw error;
        }
    }
    async searchRestaurants(addressId, query = "") {
        return await this.callTool("search_restaurants", {
            addressId: addressId || this.defaultAddressId || "clc56hdghv47q7okshn0__AMTpzwSeqDwH1fusz4g_vh",
            query,
        });
    }
    async getRestaurantMenu(restaurantId) {
        return await this.callTool("get_restaurant_menu", {
            restaurantId: restaurantId,
            restaurant_id: restaurantId,
        });
    }
    async addToCart(itemId, restaurantId, quantity = 1) {
        return await this.callTool("add_to_cart", {
            itemId,
            item_id: itemId,
            restaurantId,
            restaurant_id: restaurantId,
            quantity,
        });
    }
    async viewCart() {
        return await this.callTool("get_food_cart", {});
    }
    async placeOrder(addressId, paymentMethod = "COD") {
        return await this.callTool("place_food_order", {
            addressId: addressId || this.defaultAddressId,
            paymentMethod,
        });
    }
    async trackOrder(orderId) {
        return await this.callTool("track_food_order", {
            orderId,
            order_id: orderId,
        });
    }
    async getAddress() {
        return await this.callTool("get_addresses", {});
    }
}
export const swiggyClient = new SwiggyClient();
