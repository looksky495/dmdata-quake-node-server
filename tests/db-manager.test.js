import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllVXSE45,
  getEventList,
  getLatestVXSE45,
  initializeDatabaseIfNeeded,
  saveVXSE45
} from "../dmdata/db-manager.js";

function createMockDb(initialStores = {}){
  const stores = {
    "vxse45-raw": [],
    "vxse45-latest": [],
    "vxse45-list": [],
    ...structuredClone(initialStores)
  };
  const indexCalls = [];

  function matchesQuery(doc, query = {}){
    return Object.entries(query).every(([key, value]) => doc[key] === value);
  }

  function collection(name){
    if (!stores[name]) stores[name] = [];

    return {
      async createIndex(keys, options){
        indexCalls.push({ name, keys, options });
      },
      find (query = {}){
        let results = stores[name].filter((doc) => matchesQuery(doc, query));

        const cursor = {
          sort (sortSpec){
            const [[field, direction]] = Object.entries(sortSpec);
            const sign = direction >= 0 ? 1 : -1;
            results = [...results].sort((a, b) => (a[field] - b[field]) * sign);
            return cursor;
          },
          limit (n){
            results = results.slice(0, n);
            return cursor;
          },
          async toArray(){
            return structuredClone(results);
          }
        };

        return cursor;
      },
      async findOne(query = {}){
        const doc = stores[name].find((item) => matchesQuery(item, query));
        return doc ? structuredClone(doc) : null;
      },
      async insertOne(doc){
        stores[name].push(structuredClone(doc));
        return { acknowledged: true };
      },
      async updateOne(filter, update, options = {}){
        const idx = stores[name].findIndex((doc) => matchesQuery(doc, filter));
        const nextDoc = {
          ...filter,
          ...(update?.$set ?? {})
        };

        if (idx === -1){
          if (options.upsert){
            stores[name].push(nextDoc);
            return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
          }
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        }

        stores[name][idx] = {
          ...stores[name][idx],
          ...(update?.$set ?? {})
        };
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }
    };
  }

  return {
    collection,
    stores,
    indexCalls
  };
}

function createEew(overrides = {}){
  return {
    type: "緊急地震速報（地震動予報）",
    eventId: "202603120001",
    serialNo: 1,
    body: {
      isCanceled: false
    },
    ...overrides
  };
}

test("initializeDatabaseIfNeeded(force=true) でインデックスを初期化する", async () => {
  const db = createMockDb();

  await initializeDatabaseIfNeeded(db, true);

  assert.equal(db.indexCalls.length, 3);
  assert.deepEqual(
    db.indexCalls.map((x) => x.name).sort(),
    ["vxse45-latest", "vxse45-list", "vxse45-raw"].sort()
  );
});

test("initializeDatabaseIfNeeded(force=false) は既存データがあれば初期化しない", async () => {
  const db = createMockDb({
    "vxse45-raw": [createEew()]
  });

  await initializeDatabaseIfNeeded(db, false);

  assert.equal(db.indexCalls.length, 0);
});

test("saveVXSE45 は raw/latest/list を保存する", async () => {
  const db = createMockDb();
  const data = createEew({ serialNo: 2, eventId: "event-a" });

  await saveVXSE45(db, data);

  assert.equal(db.stores["vxse45-raw"].length, 1);
  assert.equal(db.stores["vxse45-latest"].length, 1);
  assert.equal(db.stores["vxse45-list"].length, 1);

  const latest = await getLatestVXSE45(db, "event-a");
  assert.equal(latest?.serialNo, 2);
});

test("saveVXSE45 は古い serialNo では latest を更新しない", async () => {
  const db = createMockDb({
    "vxse45-latest": [createEew({ eventId: "event-b", serialNo: 3 })]
  });

  await saveVXSE45(db, createEew({ eventId: "event-b", serialNo: 2 }));

  const latest = await getLatestVXSE45(db, "event-b");
  assert.equal(latest?.serialNo, 3);
});

test("saveVXSE45 は不正な type を保存しない", async () => {
  const db = createMockDb();

  await saveVXSE45(db, createEew({ type: "OTHER" }));

  assert.equal(db.stores["vxse45-raw"].length, 0);
  assert.equal(db.stores["vxse45-latest"].length, 0);
  assert.equal(db.stores["vxse45-list"].length, 0);
});

test("getAllVXSE45/getEventList は期待通りの件数を返す", async () => {
  const raw = [
    createEew({ eventId: "event-c", serialNo: 1 }),
    createEew({ eventId: "event-c", serialNo: 2 }),
    createEew({ eventId: "event-d", serialNo: 1 })
  ];
  const list = Array.from({ length: 120 }, (_, i) => ({
    eventId: `id-${i}`,
    updatedDate: i,
    addedDate: i
  }));
  const db = createMockDb({
    "vxse45-raw": raw,
    "vxse45-list": list
  });

  const all = await getAllVXSE45(db, "event-c");
  assert.equal(all.length, 2);

  const events = await getEventList(db, 150);
  assert.equal(events.length, 100);
  assert.equal(events[0].eventId, "id-119");
});
