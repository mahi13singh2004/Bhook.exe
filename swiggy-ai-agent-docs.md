# Swiggy AI Ordering Agent — Developer Documentation

## 1. Project Overview

This project is an AI-powered Swiggy ordering agent that lets a user interact with Swiggy through natural language instead of manually navigating the Swiggy application.

The agent is designed around the **Swiggy Builders Club MCP platform**. Swiggy exposes commerce capabilities through MCP (Model Context Protocol), allowing an AI agent to discover restaurants, inspect menus, customize items, manage carts, apply coupons, make payments, place orders, and track deliveries.

The provided Swiggy documentation describes:

- **66 MCP tools**
- **4 MCP servers**
  - Food — 20 tools
  - Instamart — 19 tools
  - Dineout — 12 tools
  - Scenes — 15 tools
- Streamable HTTP MCP
- OAuth 2.1 with PKCE
- MCP-compatible clients/frameworks
- Local development before requesting production access

Primary focus of this project: **Food ordering through Swiggy MCP**.

Source: Swiggy Builders Club documentation supplied with this project.

---

# 2. Problem Statement

Traditional food ordering requires the user to:

1. Open the food delivery application.
2. Select or search for a restaurant.
3. Browse the menu.
4. Select variants and add-ons.
5. Add items to the cart.
6. Apply coupons.
7. Select an address.
8. Select a payment method.
9. Complete payment.
10. Track the order manually.

The goal is to allow the user to say something such as:

> "Order me a paneer biryani under ₹300 from a highly rated restaurant near my saved address."

The AI agent should interpret the request, use the appropriate Swiggy MCP tools, ask for information only when necessary, present important choices to the user, and execute the order safely.

---

# 3. High-Level Architecture

```text
                         USER
                           |
                           v
                +----------------------+
                |   Chat / UI Layer    |
                | Text / Voice Input   |
                +----------+-----------+
                           |
                           v
                +----------------------+
                |    AI Agent / LLM    |
                | Intent + Planning    |
                +----------+-----------+
                           |
                           v
                +----------------------+
                | MCP Tool Orchestrator|
                | Tool selection/state |
                +----------+-----------+
                           |
              +------------+-------------+
              |                          |
              v                          v
       Swiggy Food MCP             Other MCP Servers
       /food endpoint              /im /dineout /scenes
              |
              v
       +------------------+
       | Swiggy Services  |
       +------------------+
              |
              v
        Order / Delivery
```

The LLM should not directly manipulate Swiggy APIs. It should operate through the MCP tools exposed by Swiggy.

---

# 4. Swiggy MCP Platform

Swiggy Builders Club exposes commerce functionality through MCP.

## 4.1 MCP Servers

| Server | Endpoint | Tools | Purpose |
|---|---|---:|---|
| Food | `POST mcp.swiggy.com/food` | 20 | Restaurant discovery, food ordering and tracking |
| Instamart | `POST mcp.swiggy.com/im` | 19 | Grocery / quick commerce |
| Dineout | `POST mcp.swiggy.com/dineout` | 12 | Restaurant table reservations and deals |
| Scenes | `POST mcp.swiggy.com/scenes` | 15 | Events, gigs, comedy, screenings and ticket booking |

This project primarily uses the **Food MCP server**.

---

# 5. Food MCP Toolset

The Food server has 20 tools grouped by journey stage.

## 5.1 Discover

| Tool | Purpose |
|---|---|
| `create_address` | Create a new delivery address |
| `delete_address` | Delete a saved delivery address |
| `get_addresses` | Retrieve saved delivery addresses |
| `get_restaurant_menu` | Browse a restaurant's complete menu |
| `search_menu` | Search for specific dishes/menu items |
| `search_restaurants` | Discover restaurants for food delivery |

## 5.2 Cart

| Tool | Purpose |
|---|---|
| `apply_food_coupon` | Apply a coupon or discount |
| `fetch_food_coupons` | Retrieve available food coupons |
| `flush_food_cart` | Clear the current cart |
| `get_food_cart` | Read the current cart |
| `update_food_cart` | Add/update cart items |

## 5.3 Payment

| Tool | Purpose |
|---|---|
| `check_payment_status` | Check the status of an in-flight UPI payment |
| `confirm_order` | Complete the order after successful payment |
| `get_payment_options` | Retrieve currently available payment methods |

## 5.4 Order

| Tool | Purpose |
|---|---|
| `place_food_order` | Place the food order |

## 5.5 Tracking

| Tool | Purpose |
|---|---|
| `get_food_delivery_status` | Get latest delivery ETA/state |
| `get_food_order_details` | Retrieve details for a specific order |
| `get_food_orders` | Retrieve active/past order history |
| `track_food_order` | Track delivery progress |

## 5.6 Support

| Tool | Purpose |
|---|---|
| `report_error` | Generate an error report for Swiggy MCP support |

---

# 6. Authentication

Swiggy MCP uses:

- **OAuth 2.1**
- **PKCE**
- Authenticated MCP sessions

The application should not manually pass user identity/access tokens to individual tool calls.

The Swiggy documentation states that session credentials are supplied automatically by the authenticated MCP session.

Authentication should therefore be treated as an infrastructure/session concern rather than application-level parameters for each Food tool.

---

# 7. Core Food Ordering Workflow

The agent should follow this general flow:

```text
User Request
    |
    v
Understand intent
    |
    v
Determine delivery address
    |
    +---- Existing address? ----+
    |                            |
   Yes                          No
    |                            |
    v                            v
get_addresses              create_address
    |                            |
    +------------+---------------+
                 |
                 v
       search_restaurants
       OR search_menu
                 |
                 v
       Restaurant selection
                 |
                 v
       get_restaurant_menu
       / search_menu
                 |
                 v
       Item customization
                 |
                 v
       update_food_cart
                 |
                 v
       get_food_cart
                 |
                 v
       fetch_food_coupons
                 |
                 v
       apply_food_coupon
                 |
                 v
       get_payment_options
                 |
                 v
       User payment/confirmation
                 |
                 v
       place_food_order
                 |
                 v
       Payment pending?
          /          \
        No            Yes
        |              |
        v              v
      Order       check_payment_status
                       |
                       v
                  confirm_order
                       |
                       v
                Order confirmed
                       |
                       v
             track_food_order /
             get_food_delivery_status
```

---

# 8. Address Management

## 8.1 Existing Address

Use:

```text
get_addresses
```

The tool returns saved addresses sorted by most recent order.

Important behavior:

- Results are paginated.
- Default page size is 10.
- The response includes pagination metadata.
- Addresses do not include latitude/longitude for privacy.
- The agent must show the addresses and ask the user which address to use.
- The selected `addressId` must be reused in subsequent operations.
- Do not continue ordering before the user selects an address.

### Required agent behavior

```text
1. Fetch addresses.
2. Display available addresses.
3. Ask:
   "Which address would you like to use for delivery?"
4. Wait for selection.
5. Store selected addressId.
6. Use that addressId for the rest of the order.
```

If `hasMore` is true and the desired address is not visible, request the next page.

---

# 9. Creating a New Address

Use:

```text
create_address
```

The agent should ask the user for:

1. Complete delivery address
2. Name
3. Phone number
4. Address type
5. Optional address label
6. Whether the address belongs to the user or someone else

Address types:

```text
HOME
WORK
OFFICE
FRIENDS_AND_FAMILY
OTHER
```

## Important Parsing Rule

The agent should ask for the **complete address as one string**.

It should NOT ask the user separately for:

- addressLine
- addressLine2
- city
- postalCode

Instead, the agent parses these values from the complete address.

Example:

```text
User:
"Flat 402, ABC Residency, MG Road, Bengaluru, Karnataka 560001"
```

The agent extracts:

```text
addressLine
addressLine2
locality
city
postalCode
```

Coordinates are optional and can be automatically resolved if omitted.

---

# 10. Restaurant Discovery

Use:

```text
search_restaurants
```

when the user wants to discover/order food from restaurants.

Example user requests:

```text
"Find me good biryani."
"Show restaurants near my delivery address."
"Find vegetarian restaurants."
"Order pizza under ₹500."
```

The agent should convert the natural-language request into appropriate search parameters supported by the tool.

The agent should not invent restaurant IDs. IDs must come from the tool response.

---

# 11. Menu Discovery

There are two main menu tools.

## 11.1 get_restaurant_menu

Use when the user wants to browse a restaurant's menu.

Required:

```text
addressId
restaurantId
```

The tool returns a flat, deduplicated menu.

Important properties:

- Up to 150 unique items
- Categories
- Bestseller status
- Price
- Stock status
- Vegetarian status
- Ratings where available
- Variant/add-on availability

If the menu is truncated, use:

```text
search_menu
```

to find a specific item.

## 11.2 search_menu

Use when the user wants a particular dish or wants to order a specific menu item.

Example:

```text
"Find paneer butter masala."
"Get me a chicken biryani."
"Find a Margherita pizza with extra cheese."
```

For ordering, `search_menu` is important because it can provide the detailed item/customization information needed before adding the item to the cart.

---

# 12. Item Customization

Before adding an item to the cart, the agent should determine:

- Item
- Quantity
- Variant
- Required customizations
- Optional add-ons
- Availability
- Price

Never assume a variant or add-on.

If the tool reports multiple variants, the agent should ask the user to select one when the selection materially affects the order.

Example:

```text
Restaurant:
ABC Pizza

Item:
Farmhouse Pizza

Variants:
- Regular
- Medium
- Large

Add-ons:
- Extra cheese
- Olives
- Jalapenos
```

The agent should not silently choose a paid customization unless the user has clearly requested it.

---

# 13. Cart Management

Use:

```text
update_food_cart
```

to add or update items.

Use:

```text
get_food_cart
```

to inspect the current cart.

Use:

```text
flush_food_cart
```

to clear the cart.

The cart should be treated as live state.

After significant cart changes, refresh the cart before presenting the final amount.

---

# 14. Cart Safety

Before ordering, the agent should present a clear summary:

```text
Restaurant: ABC Restaurant

Items:
1. Chicken Biryani x1 — ₹250
2. Coke x1 — ₹50

Subtotal: ₹300
Discount: ₹50
Delivery/other charges: ₹XX
Final total: ₹XXX

Delivery address:
<selected address>

Payment:
<selected payment method>
```

The user should have an explicit opportunity to review the order before an irreversible action.

---

# 15. Coupons

Use:

```text
fetch_food_coupons
```

to discover available offers.

Use:

```text
apply_food_coupon
```

to apply a coupon.

Recommended workflow:

```text
get cart
   |
fetch coupons
   |
show applicable options
   |
user selects coupon
   |
apply coupon
   |
refresh cart
```

Do not claim a discount until the tool confirms that it was applied.

---

# 16. Payment

Use:

```text
get_payment_options
```

when the user is ready to pay or asks which payment methods are available.

The agent must use live payment options returned by Swiggy.

Do not invent payment methods.

---

# 17. Placing an Order

Use:

```text
place_food_order
```

to place the food order.

This is a consequential action and should happen only after:

1. Correct address is selected.
2. Restaurant is selected.
3. Items are confirmed.
4. Variants/add-ons are resolved.
5. Cart is reviewed.
6. Final amount is known.
7. User has provided the required confirmation/payment authorization.

The agent must not treat a plan such as:

> "I want to order biryani"

as authorization to immediately place an order.

Planning and execution must remain separate.

---

# 18. UPI Payment Flow

The Food MCP documentation describes a payment state where placing an order can return:

```text
PENDING_PAYMENT
```

For this flow:

```text
place_food_order
        |
        v
PENDING_PAYMENT
        |
        v
check_payment_status
        |
        +---- terminal success ----+
        |                          |
        |                          v
        |                    confirm_order
        |
        +---- pending ------------> poll according to
                                    returned status/rules
```

Important:

- `check_payment_status` should be used to determine the current payment state.
- The agent should use returned terminal flags/messages.
- `confirm_order` should only be called after successful payment.
- Never claim payment succeeded merely because an order attempt was initiated.

---

# 19. Order Tracking

After an order is confirmed, the agent can use:

```text
track_food_order
```

for user-friendly tracking.

For structured status/ETA polling:

```text
get_food_delivery_status
```

can be used.

For order-specific information:

```text
get_food_order_details
```

For order history:

```text
get_food_orders
```

The agent should distinguish:

```text
Order placed
Payment successful
Restaurant accepted
Food preparing
Out for delivery
Delivered
```

Only report states supported by the live tool response.

---

# 20. Error Handling

Swiggy MCP tools use a common response structure.

## Success

```json
{
  "success": true,
  "data": {},
  "message": "optional human-readable message"
}
```

## Failure

```json
{
  "success": false,
  "error": {
    "message": "description of what went wrong"
  }
}
```

The agent should:

1. Detect `success: false`.
2. Read the returned error.
3. Explain the issue clearly.
4. Avoid inventing a successful result.
5. Retry only when retrying is appropriate.
6. Ask the user for missing information when necessary.
7. Use `report_error` when the user wants to report an MCP issue.

---

# 21. Never Invent Identifiers

The agent must never invent:

- `addressId`
- `restaurantId`
- item IDs
- order IDs
- payment IDs
- payment methods
- status values
- timestamps
- fallback IDs

Always use IDs and enum values exactly as returned by Swiggy MCP.

---

# 22. Agent State

The application should maintain an order-session state similar to:

```js
{
  addressId: null,
  restaurantId: null,
  restaurantName: null,

  cart: {
    items: []
  },

  coupon: null,

  payment: {
    method: null,
    status: null
  },

  order: {
    id: null,
    status: null
  }
}
```

The exact implementation can use an in-memory state object, Redis, database persistence, or framework-specific state management.

---

# 23. Recommended Agent State Machine

```text
IDLE
 |
 v
UNDERSTAND_REQUEST
 |
 v
ADDRESS_SELECTION
 |
 v
RESTAURANT_DISCOVERY
 |
 v
MENU_DISCOVERY
 |
 v
CUSTOMIZATION
 |
 v
CART_REVIEW
 |
 v
COUPON_SELECTION
 |
 v
PAYMENT_SELECTION
 |
 v
FINAL_CONFIRMATION
 |
 v
ORDER_PLACEMENT
 |
 +---- PAYMENT_PENDING ----+
 |                         |
 |                         v
 |                 PAYMENT_VERIFICATION
 |                         |
 |                         v
 |                    ORDER_CONFIRM
 |
 v
ORDER_CONFIRMED
 |
 v
ORDER_TRACKING
 |
 v
COMPLETED
```

At any point, an error should transition into an error-handling state rather than pretending the operation succeeded.

---

# 24. Natural Language Examples

## Example 1 — Simple Food Search

User:

> "I want biryani."

Agent:

```text
I can help with that. Which delivery address should I use?
```

Then:

```text
get_addresses
```

After address selection:

```text
search_menu / search_restaurants
```

---

## Example 2 — Restaurant-Specific Request

User:

> "Show me the menu of restaurant X."

Flow:

```text
get_addresses
        |
user selects address
        |
search_restaurants
        |
get_restaurant_menu
```

---

## Example 3 — Specific Dish

User:

> "Find chicken biryani and add one to my cart."

Flow:

```text
get_addresses
        |
search_menu
        |
resolve item
        |
resolve variants/add-ons if required
        |
update_food_cart
        |
get_food_cart
```

---

## Example 4 — Coupon

User:

> "Apply the best available coupon."

Flow:

```text
get_food_cart
        |
fetch_food_coupons
        |
show applicable coupons
        |
apply selected coupon
        |
get_food_cart
```

The agent should not describe a coupon as applied until Swiggy confirms the application.

---

## Example 5 — Complete Order

User:

> "Order one chicken biryani and Coke."

Flow:

```text
Address
   ↓
Restaurant
   ↓
Menu
   ↓
Items
   ↓
Cart
   ↓
Coupon
   ↓
Final amount
   ↓
Payment method
   ↓
User confirmation
   ↓
place_food_order
   ↓
Payment verification if needed
   ↓
confirm_order if required
   ↓
Tracking
```

---

# 25. Conversational Design

The agent should behave like an assistant, not a raw API wrapper.

## Good behavior

Instead of:

```text
Missing addressId.
```

Say:

```text
Which saved address would you like me to use for this order?
```

Instead of:

```text
restaurantId required.
```

Say:

```text
Which restaurant would you like to order from?
```

Instead of:

```text
PENDING_PAYMENT.
```

Say:

```text
The payment is still pending. I’m checking the payment status before confirming the order.
```

---

# 26. Avoid Excessive Questions

The agent should ask only for information that cannot be safely inferred or obtained through tools.

For example, when creating an address, ask for the complete address rather than separately asking for:

```text
House number?
Street?
City?
PIN code?
```

The documentation explicitly expects the agent to parse these fields from the full address.

---

# 27. User Confirmation Policy

Actions should be classified as:

### Read-only

Examples:

- `get_addresses`
- `search_restaurants`
- `search_menu`
- `get_restaurant_menu`
- `get_food_cart`
- `fetch_food_coupons`
- `get_payment_options`
- `get_food_orders`
- `get_food_order_details`
- `track_food_order`
- `get_food_delivery_status`

### Mutating but reversible/low impact

Examples:

- `update_food_cart`
- `apply_food_coupon`
- `flush_food_cart`

### Consequential

Examples:

- `create_address`
- `delete_address`
- `place_food_order`
- payment-related actions
- `confirm_order`

For consequential operations, require explicit user intent and use the current tool response as the source of truth.

---

# 28. Technology Stack

A possible implementation stack:

```text
Frontend:
React

Backend:
Node.js
Express

AI:
Gemini / OpenAI-compatible LLM

Agent Framework:
LangGraph / LangChain / MCP client

Protocol:
Model Context Protocol

Transport:
Streamable HTTP

Authentication:
OAuth 2.1 + PKCE

State:
Redis / MongoDB

Integration:
Swiggy MCP Food Server
```

The architecture is framework-agnostic because Swiggy states that MCP-compatible clients/frameworks can work with the platform.

---

# 29. Suggested Project Structure

```text
swiggy-ai-agent/
│
├── src/
│   ├── agent/
│   │   ├── agent.js
│   │   ├── planner.js
│   │   ├── state.js
│   │   └── prompts.js
│   │
│   ├── mcp/
│   │   ├── client.js
│   │   ├── swiggy-food.js
│   │   └── tools.js
│   │
│   ├── services/
│   │   ├── restaurant.service.js
│   │   ├── cart.service.js
│   │   ├── payment.service.js
│   │   ├── order.service.js
│   │   └── tracking.service.js
│   │
│   ├── api/
│   │   └── routes.js
│   │
│   └── index.js
│
├── .env
├── package.json
└── README.md
```

---

# 30. MCP Client Responsibility

The MCP client layer should:

1. Establish the authenticated Swiggy MCP session.
2. Discover/maintain available tools.
3. Invoke tools with validated arguments.
4. Return structured results to the agent.
5. Handle MCP-level failures.
6. Avoid hard-coding dynamic Swiggy identifiers.

Conceptually:

```js
async function callSwiggyTool(toolName, args) {
  const result = await mcpClient.callTool({
    name: toolName,
    arguments: args
  });

  return result;
}
```

The exact MCP client implementation depends on the selected MCP SDK/framework.

---

# 31. Tool Selection Logic

A basic intent-to-tool mapping:

```text
"my saved addresses"
        → get_addresses

"add a new address"
        → create_address

"find restaurants"
        → search_restaurants

"find a specific dish"
        → search_menu

"show restaurant menu"
        → get_restaurant_menu

"add item"
        → update_food_cart

"show cart"
        → get_food_cart

"find coupons"
        → fetch_food_coupons

"apply coupon"
        → apply_food_coupon

"payment methods"
        → get_payment_options

"place order"
        → place_food_order

"payment status"
        → check_payment_status

"confirm order"
        → confirm_order

"track order"
        → track_food_order / get_food_delivery_status

"order history"
        → get_food_orders
```

The LLM can perform semantic intent detection, but the orchestration layer should enforce tool preconditions and ordering constraints.

---

# 32. Important Tool Preconditions

## `get_restaurant_menu`

Requires:

```text
addressId
restaurantId
```

Both should originate from earlier tool responses/user selection.

## `update_food_cart`

Should operate using current live menu/item information.

## `place_food_order`

Should only be invoked after cart/address/payment information is ready and the user has authorized the purchase.

## `confirm_order`

For UPI flow, call only after successful payment verification.

## `check_payment_status`

Use for an in-flight payment rather than assuming payment completion.

---

# 33. Reliability Principles

The agent should follow these principles:

### Source of truth

Live Swiggy MCP responses are authoritative for:

- availability
- prices
- cart totals
- coupons
- payment options
- order status
- ETA

### No hallucinated state

Never say:

```text
Your order is confirmed.
```

unless the tool response confirms it.

### Refresh before irreversible action

Before placing an order, refresh relevant cart/payment state where appropriate.

### Preserve identifiers

Once the user selects an address/restaurant/item, preserve the returned ID in agent state.

### Handle pagination

If a list has more pages, fetch another page only when necessary.

---

# 34. Privacy

The Swiggy documentation specifically states that saved address results are returned without coordinates for privacy protection.

The application should also:

- Avoid logging access tokens.
- Avoid exposing authentication credentials to the LLM.
- Avoid storing sensitive personal information unnecessarily.
- Avoid printing complete phone numbers in logs.
- Keep MCP session credentials outside prompts.
- Minimize persistent storage of address information.

---

# 35. Production Readiness

The provided Swiggy Builders Club material indicates that developers can build locally first and then apply for production access.

Before production:

- Complete the full ordering flow locally.
- Test authentication.
- Test address selection.
- Test restaurant discovery.
- Test menus and customizations.
- Test cart updates.
- Test coupons.
- Test payment states.
- Test order confirmation.
- Test tracking.
- Test error handling.
- Record the required short demo video.
- Follow Swiggy's production-access requirements.

Production credentials should not be assumed merely because local MCP access works.

---

# 36. Testing Strategy

## Unit Tests

Test:

- Intent classification
- Tool argument construction
- Address parsing
- Cart state transitions
- Payment state handling
- Error handling
- Confirmation gates

## Integration Tests

Test the complete sequence:

```text
Authentication
→ Address
→ Restaurant
→ Menu
→ Cart
→ Coupon
→ Payment
→ Order
→ Tracking
```

## Failure Tests

Test:

```text
No saved addresses
Restaurant unavailable
Item unavailable
Variant unavailable
Cart changed
Coupon rejected
Payment pending
Payment failed
Order placement failed
Tracking unavailable
MCP error
```

---

# 37. Example Agent Prompt

```text
You are a Swiggy ordering assistant.

Your job is to help the user discover food, manage a cart,
complete an order, and track delivery using Swiggy MCP tools.

Rules:

1. Never invent Swiggy IDs.
2. Use IDs returned by MCP tools exactly as provided.
3. Ask the user to select a delivery address before continuing
   when multiple saved addresses exist.
4. For a new address, ask for the complete address and parse
   addressLine, addressLine2, locality, city and postalCode yourself.
5. Do not ask the user for address components separately.
6. Never invent prices, stock status, coupons, payment methods,
   order IDs or delivery status.
7. Use live MCP responses as the source of truth.
8. Resolve variants and add-ons before adding an item when required.
9. Show the final cart and total before placing a consequential order.
10. Require explicit user confirmation before the final purchase.
11. For UPI payments, verify payment status before confirming the order.
12. Never claim an order is confirmed unless the tool response confirms it.
13. If an MCP operation fails, explain the returned error and recover
    where possible.
14. Use pagination when a list contains more results.
15. Keep authentication credentials outside the LLM prompt.
```

---

# 38. Example Conversation

```text
USER:
Order me biryani.

AGENT:
Sure. Which delivery address would you like to use?

AGENT → get_addresses

AGENT:
I found these saved addresses:
1. Home
2. Office

Which one should I use?

USER:
Home.

AGENT:
Got it. What type of biryani would you like, or should I show
popular biryani options?

USER:
Chicken biryani under ₹350.

AGENT → search_menu/search_restaurants

AGENT:
I found:
1. Restaurant A — Chicken Biryani — ₹299
2. Restaurant B — Chicken Biryani — ₹329

Which one would you like?

USER:
Restaurant A.

AGENT → get_restaurant_menu / search_menu

AGENT:
The biryani has these available options...
Which size/variant would you like?

USER:
Regular.

AGENT → update_food_cart
AGENT → get_food_cart
AGENT → fetch_food_coupons

AGENT:
Your cart total is ₹XXX after the available discount.

Would you like me to place this order?

USER:
Yes.

AGENT → get_payment_options

AGENT:
Available payment options are ...

USER:
UPI.

AGENT → place_food_order

If payment is pending:

AGENT → check_payment_status

After successful payment:

AGENT → confirm_order

AGENT:
Your order has been confirmed. I can also track the delivery for you.
```

---

# 39. Extending Beyond Food

The same architecture can later support:

## Instamart

```text
User
 ↓
Intent
 ↓
Instamart MCP
 ↓
Search products
 ↓
Cart
 ↓
Payment
 ↓
Order
 ↓
Tracking
```

## Dineout

```text
Restaurant discovery
 ↓
Availability
 ↓
Deals
 ↓
Table selection
 ↓
Reservation
```

## Scenes

```text
Event discovery
 ↓
Show selection
 ↓
Ticket selection
 ↓
Booking
```

The architecture should therefore keep the MCP integration modular.

---

# 40. Why MCP Fits This Project

MCP provides a standardized interface between the AI agent and external commerce capabilities.

Instead of creating separate custom integrations for:

```text
Restaurant API
Menu API
Cart API
Payment API
Order API
Tracking API
```

the agent can interact with Swiggy through the MCP tool interface.

This allows the agent framework to focus on:

- Understanding user intent
- Planning
- Conversation
- State management
- Confirmation
- Error recovery

while Swiggy MCP handles the commerce-specific capabilities.

---

# 41. Key Constraints From the Provided Swiggy Documentation

The following constraints should be treated as implementation requirements:

1. Food MCP endpoint is `POST mcp.swiggy.com/food`.
2. Food exposes 20 tools.
3. Saved addresses are paginated.
4. Address coordinates are not returned by `get_addresses`.
5. The user must choose an address before continuing from `get_addresses`.
6. `get_restaurant_menu` requires `addressId` and `restaurantId`.
7. Restaurant menu browsing is capped at 150 unique items.
8. `search_menu` should be used for specific item/customization discovery.
9. Live availability and prices must come from tool responses.
10. Payment options must come from `get_payment_options`.
11. UPI flows can enter `PENDING_PAYMENT`.
12. Payment status should be checked before calling `confirm_order`.
13. Tool identifiers and enum values must not be invented.
14. Tool responses use a common success/error envelope.
15. Authentication is handled through the authenticated MCP session.
16. OAuth 2.1 with PKCE is used.
17. Swiggy MCP uses streamable HTTP.
18. Local development is expected before production access.

---

# 42. Official References

- Swiggy Builders Club:
  https://mcp.swiggy.com/builders/

- Swiggy Developer Docs:
  https://mcp.swiggy.com/builders/docs/

- Swiggy Food MCP Reference:
  https://mcp.swiggy.com/builders/docs/reference/food/

- Swiggy MCP Reference:
  https://mcp.swiggy.com/builders/docs/reference/

- Swiggy Authentication:
  https://mcp.swiggy.com/builders/docs/start/authenticate/

- Swiggy Production Access:
  https://mcp.swiggy.com/builders/access/

---

# 43. Final Implementation Checklist

## MCP

- [ ] MCP client configured
- [ ] Swiggy authentication configured
- [ ] Food MCP server connected
- [ ] Tool discovery verified

## Address

- [ ] Get saved addresses
- [ ] Handle pagination
- [ ] Require address selection
- [ ] Create address flow
- [ ] Parse complete address automatically

## Restaurant

- [ ] Restaurant search
- [ ] Restaurant selection
- [ ] Menu browsing
- [ ] Dish search
- [ ] Variants/add-ons

## Cart

- [ ] Add/update items
- [ ] Read cart
- [ ] Coupon discovery
- [ ] Coupon application
- [ ] Final cart refresh

## Payment

- [ ] Payment options
- [ ] Explicit purchase confirmation
- [ ] Payment state handling
- [ ] UPI pending handling
- [ ] Payment verification
- [ ] Order confirmation

## Tracking

- [ ] Order details
- [ ] Order history
- [ ] Delivery status
- [ ] Tracking

## Reliability

- [ ] Never invent IDs
- [ ] Never invent prices
- [ ] Never claim success without tool confirmation
- [ ] Handle MCP errors
- [ ] Handle unavailable items
- [ ] Handle payment failures
- [ ] Handle pagination
- [ ] Protect credentials and personal data

---

# 44. Summary

The core product is an **AI-native Swiggy ordering agent powered by MCP**.

The most important design principle is:

```text
Natural language
      ↓
AI reasoning
      ↓
Validated MCP tool sequence
      ↓
Live Swiggy state
      ↓
User confirmation
      ↓
Safe execution
      ↓
Verified order status
```

The agent should never hallucinate commerce state. Swiggy MCP is the source of truth for addresses, restaurant/menu availability, cart state, coupons, payment options, order placement, payment status and delivery tracking.
