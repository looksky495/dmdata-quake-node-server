import { WebSocketServer } from "ws";
import { getEventList, getLatestVXSE45 } from "./dmdata/db-manager.js";
import { getVXSE45Item } from "./dmdata/data-processor.js";

const data = {
  /** @type {WebSocketServer | null} */
  wss: null,
  /** @type {Array<{ws: WebSocket, lastPing: number}>} */
  clients: [],
  /** @type {number | null} */
  intervalId: null
};

/**
 * @param {import("mongodb").Db} db
 * @param {number} port WebSocket サーバーを起動するポート番号（デフォルト: 6500）
 * @return {WebSocketServer} 起動した WebSocket サーバーのインスタンス
 * @description WebSocket サーバーを初期化して起動します。クライアントからの接続を待ち受け、メッセージを処理します。
 */
export function initializeWebSocketServer (db, port = 6500){
  const wss = data.wss = new WebSocketServer({ port });
  wss.on("connection", ws => {
    ws.on("error", console.error);

    ws.on("message", async data => {
      try {
        const message = JSON.parse(data);
        if (message.type === "ping"){
          console.log("[" + new Date().toISOString() + "] PING: " + message.pingId);
          ws.send(JSON.stringify({
            type: "pong",
            pingId: message.pingId
          }));
        } else if (message.type === "pong"){
          // クライアントの ping 応答を処理
          const client = data.clients.find(c => c.ws === ws);
          if (client){
            client.ping.time = Date.now();
            client.ping.id = null;
          }
        } else if (message.type === "list"){
          // クライアントからのリスト要求を処理
          // 一旦ダミーのデータを返す
          console.log("[" + new Date().toISOString() + "] Received list request from client.");

          const events = await getEventList(db, 20);
          const responseData = {
            type: "list",
            data: []
          };
          for (const event of events){
            const latestData = await getLatestVXSE45(db, event.eventId);
            if (latestData) responseData.data.push(getVXSE45Item(latestData));
          }

          ws.send(JSON.stringify(responseData));
        }

      } catch (error){
        console.error("Failed to process message:", error);
      }
    });

    ws.on("close", () => {
      // クライアントが切断されたときに clients 配列から削除する
      data.clients.splice(data.clients.findIndex(c => c.ws === ws), 1);
    });

    data.clients.push({
      ws,
      ping: {
        time: Date.now(),
        id: null
      }
    });
  });

  console.log(`WebSocket server started on port ${port}.`);

  // 定期的に ping を送信する
  data.intervalId = setInterval(() => {
    for (const client of data.clients){
      // 前回の ping の応答がない場合はクライアントを切断する
      if (client.ping.id){
        client.ws.terminate();
        continue;
      }

      if (client.readyState === client.OPEN){
        const pingId = Math.random().toString(36).substring(2, 10);
        client.ws.send(JSON.stringify({
          type: "ping",
          pingId: pingId
        }));
      }
    };
  }, 20000);

  return wss;
}

export async function closeWebSocketServer (){
  if (data.intervalId) clearInterval(data.intervalId);
  if (data.wss){
    for (const client of data.clients){
      try {
        client.ws.close();
      } catch {}
    }
    data.clients = [];

    await new Promise(resolve => data.wss.close(resolve));
    data.wss = null;
  }
}
