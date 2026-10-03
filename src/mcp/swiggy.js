import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { swiggyOAuthProvider } from "./oauth.js";

const client = new Client({
    name: "Bhook.exe",
    version: "1.0.0",
});

const tokens = await swiggyOAuthProvider.login();

console.log("\nSwiggy authentication complete!");

const transport = new StreamableHTTPClientTransport(
    new URL("https://mcp.swiggy.com/food"),
    {
        requestInit: {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        },
    }
);

await client.connect(transport);

console.log("Connected to Swiggy MCP!");

const tools = await client.listTools();

console.log("\nAvailable Swiggy tools:");

for (const tool of tools.tools) {
    console.log(`- ${tool.name}`);
}

const result = await client.callTool({
  name: "search_restaurants",
  arguments: {
    addressId: "clc56hdghv47q7okshn0__AMTpzwSeqDwH1fusz4g_vh",
    query: "Belgian waffles",
  },
});

console.log("\nRestaurant search result:");
console.dir(result, { depth: null });