import type { CrossSectionProfile, DemDatasetConfig, ProfilePoint, TransectLine, XY } from "../types";
import { sampleElevationsAlongLine } from "./demSource";

export interface SamplePlan {
  startXY: XY;
  endXY: XY;
  samplingIntervalM: number;
}

export interface SamplePosition {
  distanceM: number;
  xy: XY;
}

/**
 * 測線を等間隔サンプリングし、各点の(始点からの距離d, 平面座標xy)を返す。
 * 端点(distanceM=0と測線長)は必ず含む(distances[last]は測線長と厳密に一致する)。
 */
export function buildSamplePoints(plan: SamplePlan): SamplePosition[] {
  const { startXY, endXY, samplingIntervalM } = plan;

  if (!(samplingIntervalM > 0)) {
    throw new Error(`samplingIntervalM must be > 0, got ${samplingIntervalM}`);
  }

  const dx = endXY.x - startXY.x;
  const dy = endXY.y - startXY.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    throw new Error("start and end point must not be the same location");
  }

  // 加算の繰り返し(d += interval)は浮動小数点誤差が蓄積しサンプル数がずれる場合があるため、
  // 添字 i × interval による算出とし、境界判定には微小な許容誤差(EPS)を用いる。
  const EPS = 1e-9;
  const stepCount = Math.floor(length / samplingIntervalM + EPS);

  const points: SamplePosition[] = [];
  for (let i = 0; i <= stepCount; i++) {
    const d = i * samplingIntervalM;
    const t = d / length;
    points.push({ distanceM: d, xy: { x: startXY.x + dx * t, y: startXY.y + dy * t } });
  }

  const lastDistance = points.length > 0 ? points[points.length - 1].distanceM : -1;
  if (lastDistance < length - EPS) {
    points.push({ distanceM: length, xy: { x: endXY.x, y: endXY.y } });
  }

  return points;
}

/**
 * 測線・サンプリング間隔・複数DEMデータセットから CrossSectionProfile を生成する(FR-005, FR-006)。
 * データ範囲外・NoDataの場合は elevationByDataset[dataset.id] が null になる(FR-012)。
 *
 * データセットごとに {@link sampleElevationsAlongLine} で全サンプル点をまとめて1回で読み込む。
 * 当初は点ごとに個別読込していたが、実データ(数千サンプル点規模)での実機検証でページが長時間
 * 応答不能になることを確認したため(research.md R2の性能リスクが実際に顕在化)、バッチ読込に変更した。
 */
export async function generateProfile(
  line: TransectLine,
  datasets: DemDatasetConfig[],
): Promise<CrossSectionProfile> {
  const positions = buildSamplePoints({
    startXY: line.startXY,
    endXY: line.endXY,
    samplingIntervalM: line.samplingIntervalM,
  });
  const xyList = positions.map((pos) => pos.xy);

  const perDatasetElevations = await Promise.all(
    datasets.map((dataset) => sampleElevationsAlongLine(dataset, xyList)),
  );

  const points: ProfilePoint[] = positions.map((pos, i) => {
    const elevationByDataset: Record<string, number | null> = {};
    datasets.forEach((dataset, datasetIndex) => {
      elevationByDataset[dataset.id] = perDatasetElevations[datasetIndex][i];
    });
    return { distanceM: pos.distanceM, elevationByDataset };
  });

  return {
    line,
    points,
    datasets,
    visibleDatasetIds: new Set(datasets.map((d) => d.id)),
    generatedAt: new Date(),
  };
}
