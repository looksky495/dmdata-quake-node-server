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
  "5-": "5l",
  "5+": "5h",
  "6-": "6l",
  "6+": "6h",
  "7": "7",
  "不明": "unknown"
};

/**
 * @param {import("@dmdata/telegram-json-types").EewInformation.v1_0_0.Main} data
 * @return {{classes: string[], header: string, epicenter: string, magnitude: string, depth: string}} 表示用の文字列
 */
export function getVXSE45Item (data){
  if (data.type !== "緊急地震速報（地震動予報）") throw new Error("[VXSE45] Data type mismatched: " + data.type);

  const earthquake = data.body.earthquake;
  const intensity = data.body.intensity;

  // 仮定震源要素ではなく、MagnitudeCalculation が 8 の場合、レベル法による推定と判定する
  const isTemporalHypocenter = earthquake?.condition === "仮定震源要素";
  const magnitudeCalculation = Number.parseInt(earthquake?.hypocenter?.accuracy?.magnitudeCalculation ?? "", 10);
  const isThresholdExceeded = !isTemporalHypocenter && magnitudeCalculation === 8;
  const isCanceled = data.body.isCanceled;

  // レベル法による推定、またはキャンセル報である場合は、震度を非表示にする
  /** @type {string[]} */
  const classes = [];
  if (!isCanceled){
    const maxInt = intensity?.forecastMaxInt;
    const shindoClassId = (isThresholdExceeded || !maxInt)
      ? "hidden"
      : dmdataShindo2ClassId[maxInt.to === "over" ? maxInt.from : maxInt.to] ?? "hidden";
    classes.push("shindo-" + shindoClassId);
  }
  if (!data.body.isLastInfo) classes.push("event-recent");
  if (data.body.isWarning) classes.push("event-warn");
  if (data.body.isCanceled) classes.push("event-cancelled");

  const header = `Rev. ${data.serialNo} - ${earthquake?.originTime ? new Date(earthquake.originTime).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " 発生" : new Date(earthquake?.arrivalTime ?? data.targetDateTime ?? data.reportDateTime).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " 検知"}`;
  const epicenter = earthquake?.hypocenter?.name ?? "";

  // レベル法である場合、またはキャンセル報である場合、または仮定震源要素である場合は、深さとマグニチュードの値を非表示にする
  const magnitude = ((magnitude, isThresholdExceeded, isCanceled, isTemporalHypocenter) => {
    if (isThresholdExceeded) return "5弱程度以上の揺れに注意";
    if (isTemporalHypocenter) return "（仮定震源要素）";
    if (isCanceled) return "（キャンセル済み）";
    return "M " + (magnitude ?? "不明") + "";
  })(earthquake?.magnitude?.value, isThresholdExceeded, isCanceled, isTemporalHypocenter);

  const depth = ((depth, condition, isThresholdExceeded, isCanceled, isTemporalHypocenter) => {
    if (isCanceled || isTemporalHypocenter || isThresholdExceeded) return "";
    if (condition === 0 || condition === "0") return "ごく浅い";
    if (condition === 700 || condition === "700") return "700 km 以上";
    if (depth === null) return "深さ 不明";
    if (depth === undefined) return "深さ 不明";
    return depth + " km";
  })(earthquake?.hypocenter?.depth?.value, earthquake?.hypocenter?.depth?.condition, isThresholdExceeded, isCanceled, isTemporalHypocenter);

  return { classes, header, epicenter, magnitude, depth };
}
