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
    console.log("Database initialized successfully.");
  } catch (error){
    console.error("Failed to initialize database.");
    throw error;
  }
}

/**
 * 緊急地震速報（地震動予報）
 * @param {import("mongodb").Db} db
 * @param {import("@dmdata/telegram-json-types").EewInformation.v1_0_0.Main} data
 */
export async function saveVXSE45(db, data){
  try {
    if (data.type !== "緊急地震速報（地震動予報）") throw new Error("[VXSE45] Data type mismatched: " + data.type);
    await db.collection("vxse45-raw").insertOne(data);
    console.log("EEW data saved to database.");
    console.log("\u001b[32m" + JSON.stringify(data) + "\u001b[0m");
  } catch (error){
    console.error("Failed to save EEW data to database:", error);
  }
}
