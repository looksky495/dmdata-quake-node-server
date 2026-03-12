import { auth } from "./dmdata/oauth.js";
import { DMDataSocket } from "./dmdata/client.js";
import { initializeDatabaseIfNeeded, getLatestVXSE45, getEventList } from "./dmdata/db-manager.js";
import { handleMessage } from "./dmdata/message-handler.js"
import { getVXSE45Item } from "./dmdata/data-processor.js";

import { initializeWebSocketServer, closeWebSocketServer } from "./ws-server.js"
import { parseArgs, printHelp, printVersion } from "./args-handler.js";
import { MongoClient } from "mongodb";

import express from "express";
import path from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));

if (args.values.help){
  printHelp();
  process.exit(0);
}

if (args.values.version){
  await printVersion();
  process.exit(0);
}

const clientId = process.env.API_CLIENT_ID;
const secretKey = process.env.API_SECRET_KEY;

// API 認証してアクセストークンを取得
const token = await auth(clientId, secretKey);

// MongoDB クライアントの初期化
const dbClient = new MongoClient("mongodb://" + args.values.dbhost);
await dbClient.connect();
const db = dbClient.db("dmdata-quake-node-server");

// データベースを初期化
await initializeDatabaseIfNeeded(db, args.values.init);

// WebSocket クライアントの初期化
const socket = new DMDataSocket(token);
socket.on("message", async data => {
  const response = await handleMessage(db, data);
  if (response) socket.send(response);
});

console.log("Starting WebSocket server...");
const wss = initializeWebSocketServer();

// プロセス終了時に WebSocket と MongoDB の接続を解除
process.on("SIGINT", async () => {
  console.log("Shutting down WebSocket server...");
  try {
    await closeWebSocketServer();
  } catch {}

  console.log("Closing WebSocket connection...");
  try {
    await socket.close();
  } catch {}

  console.log("Closing MongoDB connection...");
  try {
    await dbClient.close();
  } catch {}

  process.exit(0);
});

const middleLogger = (req, res, next) => {
  console.log(req.method + " " + req.url);
  next();
};

const app = express();
app.use(middleLogger);
app.set("view engine", "ejs");

app.get("/", async (req, res) => {
  const replacer = {
    header: "",
    epicenter: "",
    magnitude: "",
    depth: "",
    classes: []
  };
  const list = await getEventList(db, 1);

  if (list.length === 0){
    replacer.header = "受信済みデータなし";
  } else {
    const eventId = list[0].eventId;
    const latestData = await getLatestVXSE45(db, eventId);

    if (!latestData){
      replacer.header = "受信済みデータはありません";
    } else {
      const item = getVXSE45Item(latestData);
      replacer.header = item.header;
      replacer.epicenter = item.epicenter;
      replacer.magnitude = item.magnitude;
      replacer.depth = item.depth;
      replacer.classes = item.classes;
    }
  }
  res.render(path.resolve(import.meta.dirname, "views/index.ejs"), replacer);
});

app.get("/list", (req, res) => {
  res.render(path.resolve(import.meta.dirname, "views/list.ejs"), {
    ws_port: 6500
  });
});

app.use("/static", express.static(path.join(import.meta.dirname, "views/static")));

app.get("/api/list", async (req, res) => {
  try {
    const list = await getEventList(db);
    res.json({
      status: "success",
      data: list
    });
  } catch (error){
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

const localhostOnlyJson = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (ip === "::1" || ip === "127.0.0.1"){
    next();
  } else {
    res.status(403).json({
      status: "error",
      error: "Forbidden"
    });
  }
};

const localhostOnlyHtml = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (ip === "::1" || ip === "127.0.0.1"){
    next();
  } else {
    res.status(403).sendFile(path.resolve(import.meta.dirname, "views/forbidden.html"));
  }
};

app.get("/debug/upload", localhostOnlyHtml, (req, res) => {
  res.sendFile(path.resolve(import.meta.dirname, "views/upload.html"));
});

app.get("/debug/sample/list", localhostOnlyHtml, (req, res) => {
  res.sendFile(path.resolve(import.meta.dirname, "views/sample-list.html"));
});

app.post("/debug/api/upload", localhostOnlyJson, express.json(), async (req, res) => {
  try {
    const response = await handleMessage(db, req.body);
    if (response) socket.send(response);
    res.json({
      status: "success"
    });
  } catch (error){
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

console.log("Starting WebSocket connection...");
await socket.start();

app.listen(args.values.port, () => {
  console.log(`Server is running on port ${args.values.port}`);
});
