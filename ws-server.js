import { WebSocketServer } from "ws";

const data = {
  /** @type {WebSocketServer | null} */
  wss: null,
  /** @type {Array<{ws: WebSocket, lastPing: number}>} */
  clients: [],
  /** @type {number | null} */
  intervalId: null
};

export function initializeWebSocketServer (port = 6500){
  const wss = data.wss = new WebSocketServer({ port });
  wss.on("connection", ws => {
    ws.on("error", console.error);

    ws.on("message", (data => {
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

          ws.send(JSON.stringify({
            type: "list",
            data: [
              {
                eventId: "20240601123456",
                classes: ["shindo-5l", "event-recent"],
                header: {
                  realtime: true,
                  rev: 123,
                  target: 1717212899000,
                  suffix: "発生"
                },
                epicenter: "山梨県東部・富士五湖",
                magnitude: "M 6.0",
                depth: "10km"
              },
              {
                eventId: "20240531214354",
                classes: ["shindo-6h", "event-warn"],
                header: {
                  realtime: false,
                  text: "Rev. 62 - 2024/05/31 21:43:54 発生"
                },
                epicenter: "石川県能登地方",
                magnitude: "M 7.8",
                depth: "ごく浅い"
              },
              {
                eventId: "20240530235500",
                classes: ["shindo-hidden", "event-cancelled"],
                header: {
                  realtime: false,
                  text: "Rev. 2 - 2024/05/30 23:55:05 発生"
                },
                epicenter: "富山湾",
                magnitude: "（キャンセル済み）",
                depth: ""
              },
              {
                eventId: "20240530162534",
                classes: ["shindo-2"],
                header: {
                  realtime: false,
                  text: "Rev. 4 - 2024/05/30 16:25:34 発生"
                },
                epicenter: "富山湾",
                magnitude: "M 3.4",
                depth: "140km"
              },
              {
                eventId: "20240530071727",
                classes: ["shindo-hidden"],
                header: {
                  realtime: false,
                  text: "Rev. 1 - 2024/05/30 07:17:27 検知"
                },
                epicenter: "九州地方",
                magnitude: "5弱程度以上の揺れに注意",
                depth: ""
              },
              {
                eventId: "20240530012341",
                classes: ["shindo-unknown"],
                header: {
                  realtime: false,
                  text: "Rev. 2 - 2024/05/30 01:23:45 発生"
                },
                epicenter: "小笠原諸島近海",
                magnitude: "M 9.0",
                depth: "590km"
              }
            ]
          }));
        }

      } catch (error){
        console.error("Failed to process message:", error);
      }
    }).bind(ws));

    ws.on("close", (() => {
      // クライアントが切断されたときに clients 配列から削除する
      data.clients.splice(data.clients.findIndex(c => c.ws === ws), 1);
    }).bind(ws));

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
