import { auth } from "./dmdata/oauth.js";
import { DMDataSocket } from "./dmdata/client.js";
import { initializeDatabaseIfNeeded, getLatestVXSE45, getEventList } from "./dmdata/db-manager.js";
import { handleMessage } from "./dmdata/message-handler.js"
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

// プロセス終了時に WebSocket と MongoDB の接続を解除
process.on("SIGINT", async () => {
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

// process.exit(0);

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
    depth: ""
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
    }

    res.render(path.resolve(import.meta.dirname, "views/index.ejs"), replacer);
  }
});

app.get("/list", (req, res) => {
  res.sendFile(path.resolve(import.meta.dirname, "views/list.html"));
});

app.use("/static", express.static(path.join(import.meta.dirname, "views/static")));

app.api("/api/list", async (req, res) => {
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

console.log("Starting WebSocket connection...");
await socket.start();

app.listen(args.values.port, () => {
  console.log(`Server is running on port ${args.values.port}`);
});
