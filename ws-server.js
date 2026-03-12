import { WebSocketServer } from "ws";
import { getEventList, getLatestVXSE45, databaseEventEmitter } from "./dmdata/db-manager.js";
import { getVXSE45Item } from "./dmdata/data-processor.js";

const parentData = {
  /** @type {WebSocketServer | null} */
  wss: null,
  /** @type {Array<{ws: WebSocket, lastPing: number}>} */
  clients: [],
  /** @type {number | null} */
  intervalId: null,
  /** @type {import("mongodb").Db | null} */
  db: null
};


/**
 * @param {import("@dmdata/telegram-json-types").EewInformation.v1_0_0.Main} eventData
 * @return {{eventId: string, header: {realtime: boolean, rev?: number, target?: number, suffix?: string, text?: string}, classes: string[]}} WebSocket クライアントに送信するデータ
 * @description データベースの更新イベントを受け取り、WebSocket クライアントに送信するデータを生成します。
 */
function createListMessage (eventData){
  const { header: headerText, ...others } = getVXSE45Item(eventData);
  const isRealtime = others.classes.includes("event-recent");

  return {
    eventId: eventData.eventId,
    header: {
      realtime: isRealtime,
      ...(isRealtime ? {
        rev: eventData.serialNo,
        target: new Date(eventData.body.earthquake.originTime ?? eventData.body.earthquake.arrivalTime) - 0,
        suffix: eventData.body.earthquake.originTime ? "発生" : "検知"
      } : {
        text: headerText
      })
    },
    ...others
  };
}

/**
 * @param {import("mongodb").Db} db
 * @param {number} port WebSocket サーバーを起動するポート番号（デフォルト: 6500）
 * @return {WebSocketServer} 起動した WebSocket サーバーのインスタンス
 * @description WebSocket サーバーを初期化して起動します。クライアントからの接続を待ち受け、メッセージを処理します。
 */
export function initializeWebSocketServer (db, port = 6500){
  parentData.db = db;

  const wss = parentData.wss = new WebSocketServer({ port });
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
          const client = parentData.clients.find(c => c.ws === ws);
          if (client){
            client.ping.time = Date.now();
            client.ping.id = null;
          }
        } else if (message.type === "list"){
          // クライアントからのリスト要求を処理
          console.log("[" + new Date().toISOString() + "] Received list request from client.");

          const events = await getEventList(parentData.db, 20);
          const responseData = {
            type: "list",
            data: []
          };
          for (const event of events){
            const latestData = await getLatestVXSE45(parentData.db, event.eventId);
            if (!latestData) continue;

            responseData.data.push(createListMessage(latestData));
          }

          ws.send(JSON.stringify(responseData));
        }

      } catch (error){
        console.error("Failed to process message:", error);
      }
    });

    ws.on("close", () => {
      // クライアントが切断されたときに clients 配列から削除する
      parentData.clients.splice(parentData.clients.findIndex(c => c.ws === ws), 1);
    });

    parentData.clients.push({
      ws,
      ping: {
        time: Date.now(),
        id: null
      }
    });
  });

  console.log(`WebSocket server started on port ${port}.`);

  databaseEventEmitter.on("vxse45-updated", async (eventData) => {
    for (const client of parentData.clients){
      client.ws.send(JSON.stringify({
        type: "list",
        data: [ createListMessage(eventData) ]
      }));
    }
  });

  // 定期的に ping を送信する
  parentData.intervalId = setInterval(() => {
    for (const client of parentData.clients){
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
  if (parentData.intervalId) clearInterval(parentData.intervalId);
  if (parentData.wss){
    for (const client of parentData.clients){
      try {
        client.ws.close();
      } catch {}
    }
    parentData.clients = [];

    await new Promise(resolve => parentData.wss.close(resolve));
    parentData.wss = null;
  }
}
