import { saveVXSE45 } from "./db-manager.js";
import zlib from "node:zlib";

/**}
 * @typedef {{type: "start", socketId: number, classification: string[], types: string[], test: "no" | "including", formats: Array<"xml" | "a/n" | "binary" | "json">, appName: null | string, time: string}} WebSocketStart
 * @typedef {{type: "ping", pingId: string}} WebSocketPing
 * @typedef {{type: "pong", pingId: string}} WebSocketPong
 * @typedef {{type: "data", version: string, classification: string[], id: string, passing: {name: string, time: string}[], head: {type: string, author: string, target?: any, time: string, designation: string, test: boolean, xml?: boolean}, xmlReport?: object, format: "xml" | "a/n" | "binary" | "json", compression: "gzip" | "zip" | null, encoding: "base64" | "utf-8", body: string}} WebSocketData
 * @typedef {{type: "error", error: string, code: number, close: boolean}} WebSocketError
 * @typedef {WebSocketStart | WebSocketPing | WebSocketPong | WebSocketData | WebSocketError} WebSocketMessage
 */

/**
 * @param {import("mongodb").Db} db
 * @param {WebSocketMessage} data WebSocket メッセージ
 * @return {Promise<WebSocketPong | null>} WebSocket に返信するデータ (返信不要な場合は null)
 */
export async function handleMessage(db, data){
  if (data.type === "ping"){
    console.log("[" + new Date().toISOString() + "] PING: " + data.pingId);
    return {
      type: "pong",
      pingId: data.pingId
    };
  } else if (data.type === "error"){
    console.error("Received error message:", data.error);
    return null;
  } else if (data.type === "start"){
    console.log("WebSocket started with socket ID " + data.socketId);
    return null;
  } else if (data.type !== "pong"){
    // データをデータベースに保存
    console.log("\u001b[31m" + JSON.stringify(data) + "\u001b[0m");

    const encodedBody = data.body;
    const decodedBody = zlib.gunzipSync(Buffer.from(encodedBody, "base64")).toString("utf-8");
    const parsedBody = JSON.parse(decodedBody);

    await saveVXSE45(db, parsedBody);
    return null;
  }
}
