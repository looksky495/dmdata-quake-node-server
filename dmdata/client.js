import { EventEmitter } from "node:events";

/** @typedef {"INIT" | "OPEN" | "CLOSED"} ConnectionState */

// WebSocket が異常終了したときに自動で再接続しない
export class DMDataSocket extends EventEmitter {
  SOCKET_START_API = "https://api.dmdata.jp/v2/socket";

  #accessToken;

  /** @type {WebSocket | null} */
  client;
  /** @type {ConnectionState} */
  connectionState;

  /**
   * @param {string} accessToken
   */
  constructor (accessToken){
    super();
    this.#accessToken = accessToken;
    this.client = null;
    this.connectionState = "INIT";
  }

  /**
   * @param {ConnectionState} state
   * @throws {Error} If the WebSocket is not in the expected state.
   */
  #validateState (state = "OPEN"){
    if (state === "INIT"){
      if (this.client) throw new Error("WebSocket is already started.");
      if (this.connectionState === "OPEN") throw new Error("WebSocket is still open.");
    } else if (state === "OPEN"){
      if (this.connectionState === "INIT") throw new Error("WebSocket is not started.");
      if (!this.client || this.connectionState === "CLOSED") throw new Error("WebSocket is already closed.");
    } else if (state === "CLOSED"){
      if (this.connectionState === "INIT") throw new Error("WebSocket is not started.");
      if (!this.client || this.connectionState === "OPEN") throw new Error("WebSocket is still open.");
    }
  }

  #processMessage (message){
    try {
      const data = JSON.parse(message.data);
      // Ping メッセージを処理
      if (data.type === "ping"){
        console.log("[" + new Date().toISOString() + "] PING: " + data.pingId);
        this.client.send(JSON.stringify({
          type: "pong",
          pingId: data.pingId
        }));
        return;
      }

      // Error メッセージを処理
      if (data.type === "error"){
        console.error("Received error message:", data.error);
        return;
      }

      this.emit("message", data);
    } catch (error){
      console.error("Failed to parse message:", error);
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async start (){
    this.#validateState("INIT");

    const response = await fetch(this.SOCKET_START_API, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + this.#accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        classifications: [
          "eew.forecast"
        ],
        types: [
          "VXSE45"
        ],
        test: "no",
        appName: "DMData Quake Node Server",
        formatMode: "json"
      })
    }).then(res => res.json());

    if (response.status === "error"){
      console.error("Failed to start WebSocket:", response.error, response.error.message);
      throw new Error("Failed to start WebSocket: " + response.error.message);
    }

    // WebSocket 接続を確立
    this.client = new WebSocket(response.websocket.url);
    this.client.addEventListener("message", event => {
      this.#processMessage(event);
    });

    // 接続が開くのを待つ
    await new Promise((resolve, reject) => {
      this.client.onopen = () => {
        console.log("WebSocket connection opened.");
        resolve();
      };
      this.client.onerror = (err) => {
        console.error("WebSocket error:", err);
        reject(err);
      };
    });

    this.client.onopen = () => {};
    this.client.onerror = () => {};
  }

  async close (){
    this.#validateState("OPEN");

    this.client.close();
    this.client = null;
    this.connectionState = "CLOSED";
    console.log("WebSocket connection closed.");
  }

  [Symbol.dispose](){
    this.close();
  }
}
