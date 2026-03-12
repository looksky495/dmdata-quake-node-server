import assert from "node:assert/strict";
import test from "node:test";

import { handleMessage } from "../dmdata/message-handler.js";

test("ping メッセージでは pong を返す", async () => {
  const result = await handleMessage(null, {
    type: "ping",
    pingId: "ping-123"
  });

  assert.deepEqual(result, {
    type: "pong",
    pingId: "ping-123"
  });
});

test("start メッセージでは null を返す", async () => {
  const result = await handleMessage(null, {
    "type": "start",
    "socketId": 1,
    "classifications": [
        "telegram.weather"
    ],
    "types": ["VPWW54"],
    "test": "including",
    "formats": ["xml", "a/n", "binary"],
    "appName": null,
    "time": "2020-01-01T00:00:00.000Z"
  });

  assert.equal(result, null);
});

test("error メッセージでは null を返す", async () => {
  const result = await handleMessage(null, {
    type: "error",
    error: "something went wrong",
    code: 500,
    close: true
  });

  assert.equal(result, null);
});