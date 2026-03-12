const SCOPES = [
  "eew.get.forecast",
  "socket.start",
];

const authServer = {
  issuer: "https://manager.dmdata.jp/",
  authorization_endpoint: "https://manager.dmdata.jp/account/oauth2/v1/auth",
  token_endpoint: "https://manager.dmdata.jp/account/oauth2/v1/token",
  revocation_endpoint: "https://manager.dmdata.jp/account/oauth2/v1/revoke",
  code_challenge_methods_supported: ["S256"],
};

/**
 * Authenticate with DMData API and get an access token.
 * @param {string} clientId
 * @param {string} secretKey
 */
export async function auth(clientId, secretKey){
  if (!secretKey || !clientId){
    throw new Error("The API secret key and client ID must be provided.");
  }

  const response = await fetch(authServer.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      "client_id": clientId,
      "client_secret": secretKey,
      "grant_type": "client_credentials",
      "scope": SCOPES.join(" ")
    })
  }).then(res => res.json());

  if (response.error){
    console.error("(" + clientId + ") Authentication error:", response.error, response.error_description);
    throw new Error("Failed to authenticate: " + response.error_description);
  }

  return response.access_token;
}
