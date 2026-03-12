import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { getVXSE45Item } from "../dmdata/data-processor.js";

const sampleDir = path.join(import.meta.dirname, "sample");

test("vxse45 サンプル JSON を読み込める", async () => {
  const files = await readdir(sampleDir);
  const vxse45Files = files.filter((file) => file.startsWith("vxse45-") && file.endsWith(".json"));

  for (const file of vxse45Files){
    const data = await readFile(path.join(sampleDir, file), "utf8").then(JSON.parse);
    assert.equal(data.type, "緊急地震速報（地震動予報）", `File ${file} has incorrect type`);
  }
});

test("thresholdexceeded サンプルは正しい情報を返す", async () => {
  const data = await readFile(path.join(sampleDir, "vxse45-thresholdexceeded.json"), "utf8").then(JSON.parse);
  const item = getVXSE45Item(data);

  assert.deepEqual(item, {
    classes: ["shindo-hidden", "event-recent"],
    header: "Rev. 1 - 2023/5/13 16:10:31 検知",
    epicenter: "九州地方",
    magnitude: "5弱程度以上の揺れに注意",
    depth: ""
  });
});

test("temporalhypocenter サンプルは正しい情報を返す", async () => {
  const data = await readFile(path.join(sampleDir, "vxse45-temporalhypocenter.json"), "utf8").then(JSON.parse);
  const item = getVXSE45Item(data);

  assert.deepEqual(item, {
    classes: ["shindo-6l", "event-recent", "event-warn"],
    header: "Rev. 6 - 2023/5/5 21:58:08 発生",
    epicenter: "富山湾",
    magnitude: "（仮定震源要素）",
    depth: ""
  });
});

test("cancel サンプルは正しい情報を返す", async () => {
  const data = await readFile(path.join(sampleDir, "vxse45-cancel.json"), "utf8").then(JSON.parse);
  const item = getVXSE45Item(data);

  assert.deepEqual(item, {
    classes: ["event-cancelled"],
    header: "Rev. 2 - 2023/9/6 6:37:52 検知",
    epicenter: "",
    magnitude: "（キャンセル済み）",
    depth: ""
  });
});
