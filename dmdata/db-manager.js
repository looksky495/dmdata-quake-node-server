/** @typedef {import("@dmdata/telegram-json-types").EewInformation.v1_0_0.Main} EewInformation */
/** @typedef {{eventId: string, updatedDate: number, addedDate: number}} TelegramListItem */

/**
 * データベースの初期化
 * @param {import("mongodb").Db} db
 * @param {boolean} force 強制的に初期化するか
 */
export async function initializeDatabaseIfNeeded(db, force){
  if (force || (await db.collection("vxse45-raw").find().toArray()).length === 0){
    await initializeDatabase(db);
  }
}

export async function initializeDatabase(db){
  try {
    await db.collection("vxse45-raw").createIndex({
      eventId: 1,
      serialNo: 1
    }, { unique: false });
    await db.collection("vxse45-latest").createIndex({
      eventId: 1
    }, { unique: true });
    await db.collection("vxse45-list").createIndex({
      eventId: 1
    }, { unique: true });
    console.log("Database initialized successfully.");
  } catch (error){
    console.error("Failed to initialize database.");
    throw error;
  }
}

/**
 * 緊急地震速報（地震動予報）
 * @param {import("mongodb").Db} db
 * @param {EewInformation} data
 */
export async function saveVXSE45(db, data){
  try {
    if (data.type !== "緊急地震速報（地震動予報）") throw new Error("[VXSE45] Data type mismatched: " + data.type);

    // ----- 生データを保存 -----
    await db.collection("vxse45-raw").insertOne(data);

    // ----- 最新のデータを保存 -----
    /** @type {EewInformation | null} */
    const existingLatest = await db.collection("vxse45-latest").findOne({ eventId: data.eventId });
    // 既存のデータが存在しない、または serial が新しい、またはキャンセル報である場合に更新
    if (!existingLatest || existingLatest.serialNo <= data.serialNo || data.body.isCanceled){
      await db.collection("vxse45-latest").updateOne({ eventId: data.eventId }, { $set: data }, { upsert: true });
    }

    // ----- 一覧用のデータを保存 -----
    /** @type {TelegramListItem | null} */
    const existingListItem = await db.collection("vxse45-list").findOne({ eventId: data.eventId });
    if (!existingListItem){
      await db.collection("vxse45-list").insertOne({
        eventId: data.eventId,
        updatedDate: Date.now(),
        addedDate: Date.now()
      });
    } else {
      await db.collection("vxse45-list").updateOne({ eventId: data.eventId }, { $set: {
        eventId: data.eventId,
        updatedDate: Date.now(),
        addedDate: existingListItem.addedDate
      } });
    }

    console.log("EEW data saved to database.");
    console.log("\u001b[32m" + JSON.stringify(data) + "\u001b[0m");
  } catch (error){
    console.error("Failed to save EEW data to database:", error);
  }
}

/**
 * 指定された Event ID に紐づく最新の緊急地震速報（地震動予報）を取得
 * @param {import("mongodb").Db} db
 * @param {string} eventId 取得する対象の Event ID
 * @return {Promise<EewInformation | null>} 取得したデータ（存在しない場合は null）
 */
export async function getLatestVXSE45(db, eventId){
  try {
    // eventId に紐づく最新のデータを取得
    const data = await db.collection("vxse45-latest").findOne({ eventId });
    return data;
  } catch (error){
    console.error("Failed to get latest EEW data from database:", error);
    throw error;
  }
}

/**
 * 指定された Event ID に紐づく全ての緊急地震速報（地震動予報）を取得
 * @param {import("mongodb").Db} db
 * @param {string} eventId 取得する対象の Event ID
 * @return {Promise<EewInformation[]>} 取得したデータの配列
 */
export async function getAllVXSE45(db, eventId){
  try {
    // eventId に紐づく全てのデータを取得
    /** @type {EewInformation[]} */
    const data = await db.collection("vxse45-raw").find({ eventId }).toArray();
    return data;
  } catch (error){
    console.error("Failed to get all EEW data from database:", error);
    throw error;
  }
}

/**
 * 受信した緊急地震速報（地震動予報）の一覧を取得
 * @param {import("mongodb").Db} db
 * @return {Promise<TelegramListItem[]>} 取得したデータの配列（100 まで）
 */
export async function getEventList(db, limit = 10){
  limit = Math.min(limit, 100);

  try {
    // eventId に紐づく全てのデータを取得
    /** @type {TelegramListItem[]} */
    const data = await db.collection("vxse45-list").find().sort({ addedDate: -1 }).limit(limit).toArray();
    return data;
  } catch (error){
    console.error("Failed to get event list from database:", error);
    throw error;
  }
}
