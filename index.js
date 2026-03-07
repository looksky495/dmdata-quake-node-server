import { auth } from "./dmdata/oauth.js";
import { DMDataSocket } from "./dmdata/client.js";

import express from "express";
import path from "node:path";
import os from "node:os";

const clientId = process.env.API_CLIENT_ID;
const secretKey = process.env.API_SECRET_KEY;

const token = await auth(clientId, secretKey);
const app = express();

const socket = new DMDataSocket(token);

const middleLogger = (req, res, next) => {
  console.log(req.method + " " + req.url);
  next();
};

app.use(middleLogger);
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render(path.resolve(import.meta.dirname, "views/index.ejs"), {});
});

app.listen(80, () => {
  console.log("Server is running on port 80");
});
