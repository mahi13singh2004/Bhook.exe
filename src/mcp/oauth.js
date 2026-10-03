import { randomUUID } from "node:crypto";
import http from "node:http";
import open from "open";

import {
  discoverOAuthServerInfo,
  exchangeAuthorization,
  startAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";

const SWIGGY_MCP_URL = "https://mcp.swiggy.com/food";

class SwiggyOAuthProvider {
  redirectUrl = "http://localhost:3000/oauth/callback";

  clientMetadata = {
    client_name: "BhookKaAgent",
    redirect_uris: [this.redirectUrl],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "mcp:tools",
    token_endpoint_auth_method: "none",
  };

  _clientInformation;
  _tokens;
  _codeVerifier;
  _authorizationCode;
  _server;

  clientInformation() {
    return this._clientInformation;
  }

  async saveClientInformation(info) {
    this._clientInformation = info;
  }

  tokens() {
    return this._tokens;
  }

  async saveTokens(tokens) {
    this._tokens = tokens;
  }

  state() {
    return randomUUID();
  }

  saveCodeVerifier(verifier) {
    this._codeVerifier = verifier;
  }

  codeVerifier() {
    return this._codeVerifier;
  }

  async login() {
    console.log("\nDiscovering Swiggy OAuth...");

    const serverInfo = await discoverOAuthServerInfo(
      SWIGGY_MCP_URL
    );

    const authorizationServerUrl =
      serverInfo.authorizationServerUrl;

    console.log(
      "Authorization server:",
      authorizationServerUrl
    );

    // Register client if required
    const { registerClient } = await import(
      "@modelcontextprotocol/sdk/client/auth.js"
    );

    const clientInfo = await registerClient(
      authorizationServerUrl,
      {
        metadata: serverInfo.authorizationServerMetadata,
        clientMetadata: this.clientMetadata,
        scope: this.clientMetadata.scope,
      }
    );

    this._clientInformation = {
      ...clientInfo,
      issuer: authorizationServerUrl,
    };

    // Generate authorization URL + PKCE
    const { authorizationUrl, codeVerifier } =
      await startAuthorization(
        authorizationServerUrl,
        {
          metadata:
            serverInfo.authorizationServerMetadata,

          clientInformation:
            this._clientInformation,

          redirectUrl: this.redirectUrl,

          scope: this.clientMetadata.scope,

          state: this.state(),

          resource: serverInfo.resourceMetadata?.resource,
        }
      );

    this._codeVerifier = codeVerifier;

    console.log("\nOpening Swiggy login...");
    console.log(authorizationUrl.toString());

    const codePromise = this.startCallbackServer();

    await open(authorizationUrl.toString());

    const authorizationCode = await codePromise;

    console.log("\nAuthorization code received.");

    // Exchange code for access token
    const tokens = await exchangeAuthorization(
      authorizationServerUrl,
      {
        metadata:
          serverInfo.authorizationServerMetadata,

        clientInformation:
          this._clientInformation,

        authorizationCode,

        codeVerifier: this._codeVerifier,

        redirectUri: this.redirectUrl,

        resource: serverInfo.resourceMetadata?.resource,
      }
    );

    this._tokens = {
      ...tokens,
      issuer: authorizationServerUrl,
    };

    console.log("Swiggy access token received.");

    return this._tokens;
  }

  startCallbackServer() {
    return new Promise((resolve, reject) => {
      this._server = http.createServer(
        (req, res) => {
          const url = new URL(
            req.url,
            this.redirectUrl
          );

          if (
            url.pathname !==
            "/oauth/callback"
          ) {
            res.writeHead(404);
            res.end("Not Found");
            return;
          }

          const error =
            url.searchParams.get("error");

          if (error) {
            res.writeHead(400, {
              "Content-Type": "text/html",
            });

            res.end(`
              <h2>Swiggy authentication failed</h2>
              <p>${error}</p>
            `);

            this._server.close();

            reject(
              new Error(
                `Swiggy OAuth error: ${error}`
              )
            );

            return;
          }

          const code =
            url.searchParams.get("code");

          if (!code) {
            res.writeHead(400);
            res.end(
              "Authorization code missing"
            );

            this._server.close();

            reject(
              new Error(
                "Authorization code missing"
              )
            );

            return;
          }

          res.writeHead(200, {
            "Content-Type": "text/html",
          });

          res.end(`
            <h2>Swiggy authentication successful!</h2>
            <p>You can close this tab.</p>
          `);

          this._server.close();

          resolve(code);
        }
      );

      this._server.on("error", reject);

      this._server.listen(
        3000,
        "localhost",
        () => {
          console.log(
            "OAuth callback server running on port 3000"
          );
        }
      );
    });
  }
}

export const swiggyOAuthProvider =
  new SwiggyOAuthProvider();