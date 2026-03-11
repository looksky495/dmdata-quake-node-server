import { auth } from "./dmdata/oauth.js";
import { DMDataSocket } from "./dmdata/client.js";
import { initializeDatabaseIfNeeded } from "./dmdata/db-manager.js";
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

const socket = new DMDataSocket(token);
socket.on("message", async data => {
  const response = await handleMessage(db, data);
  if (response) socket.send(response);
});

process.on("SIGINT", async () => {
  console.log("Closing WebSocket connection...");
  await socket.close();
  console.log("Closing MongoDB connection...");
  await dbClient.close();

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

app.get("/", (req, res) => {
  res.render(path.resolve(import.meta.dirname, "views/index.ejs"), {});
});

console.log("Starting WebSocket connection...");
await socket.start();

app.listen(args.values.port, () => {
  console.log(`Server is running on port ${args.values.port}`);
});
