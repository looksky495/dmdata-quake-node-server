/**
 * @fileoverview
 * DMData のデータを処理するモジュール
 * ここでは、DMData から受け取ったデータを元に、表示用の文字列を生成する関数を定義します。
 */

/** @type {Record<(import("@dmdata/telegram-json-types").EewInformation.v1_0_0.IntensityClass | "不明"), ("0" | "1" | "2" | "3" | "4" | "5l" | "5h" | "6l" | "6h" | "7" | "unknown")>} 震度を表すクラス ID と表示用の文字列の対応表 */
const dmdataShindo2ClassId = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5l": "5l",
  "5h": "5h",
  "6l": "6l",
  "6h": "6h",
  "7": "7",
  "不明": "unknown"
};

/**
 * @param {import("@dmdata/telegram-json-types").EewInformation.v1_0_0.Main} data
 * @return {{classes: string[], header: string, epicenter: string, magnitude: string, depth: string}} 表示用の文字列
 */
export function getVXSE45Item (data){
  if (data.type !== "緊急地震速報（地震動予報）") throw new Error("[VXSE45] Data type mismatched: " + data.type);

  // 仮定震源要素ではなく、MagnitudeCalculation が 8 の場合、レベル法による推定と判定する
  const isThresholdExceeded = data.body.earthquake.condition !== "仮定震源要素" && data.body.earthquake.magnitudeCalculation === 8;
  const isCanceled = data.body.isCanceled;

  // レベル法による推定、またはキャンセル報である場合は、震度を非表示にする
  const classes = ["shindo-" + ((isThresholdExceeded || isCanceled) ? "hidden" : dmdataShindo2ClassId[data.body])];
  if (data.body.isLastInfo) classes.push("event-recent");
  if (data.body.isWarning)  classes.push("event-warn");

  const header = `Rev. ${data.serialNo} - ${data.body.earthquake.originTime ? new Date(data.body.earthquake.originTime).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " 発生" : new Date(data.body.earthquake.arrivalTime).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " 検知"}`;
  const epicenter = data.body.earthquake.hypocenter.name;
  const magnitude = (data.body.earthquake.magnitude.value ?? "不明") + "";
  const depth = ((depth, condition) => {
    if (condition === 0) return "ごく浅い";
    if (condition === 700) return "700km以上";
    if (depth === null) return "不明";
    return depth + "km";
  })(data.body.earthquake.hypocenter.depth, data.body.earthquake.hypocenter.condition);

  return { classes, header, epicenter, magnitude, depth };
}
