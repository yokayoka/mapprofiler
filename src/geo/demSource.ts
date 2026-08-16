import { fromUrl, type GeoTIFF, type GeoTIFFImage } from "geotiff";
import type { DemDatasetConfig, XY } from "../types";

const tiffCache = new Map<string, Promise<GeoTIFF>>();

function getTiff(dataset: DemDatasetConfig): Promise<GeoTIFF> {
  let cached = tiffCache.get(dataset.cogUrl);
  if (!cached) {
    cached = fromUrl(dataset.cogUrl);
    tiffCache.set(dataset.cogUrl, cached);
  }
  return cached;
}

interface RasterGeometry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
}

function getRasterGeometry(image: GeoTIFFImage): RasterGeometry {
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    pixelWidth: (maxX - minX) / width,
    pixelHeight: (maxY - minY) / height,
  };
}

/** 最近傍法: 対象座標が属するピクセルのインデックスを求める(Y軸は北が原点側で下向きに増加)。範囲外は null。 */
function toPixelIndex(geom: RasterGeometry, xy: XY): { px: number; py: number } | null {
  if (xy.x < geom.minX || xy.x > geom.maxX || xy.y < geom.minY || xy.y > geom.maxY) {
    return null;
  }
  const px = Math.min(Math.max(Math.floor((xy.x - geom.minX) / geom.pixelWidth), 0), geom.width - 1);
  const py = Math.min(Math.max(Math.floor((geom.maxY - xy.y) / geom.pixelHeight), 0), geom.height - 1);
  return { px, py };
}

function toElevationOrNull(value: number | undefined, noData: number | null): number | null {
  if (value === null || value === undefined) return null;
  if (noData !== null && value === noData) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * 指定したEPSG:6675座標における標高値をCOGから取得する(HTTP Range Requestによる部分読込)。
 * データ提供範囲外・NoDataの場合は null を返す(FR-012)。
 *
 * 補間方式: 最近傍法(nearest-neighbor)を採用。DEMは1m解像度と十分に高精細であり、
 * 実装の単純さ・速度を優先した(contracts/core-geo-api.md 参照。バイリニア法へ切り替える場合は
 * 対応するユニットテストも更新すること)。
 *
 * 単一点の取得用。複数点をまとめて取得する場合は {@link sampleElevationsAlongLine} を使うこと
 * (1点ずつ呼ぶとリクエスト数が点数×データセット数に比例して増え、実測でSC-001を満たせないことを
 * 確認したため、断面図生成では使用しない。research.md R2参照)。
 */
export async function sampleElevation(
  dataset: DemDatasetConfig,
  xy: XY,
): Promise<number | null> {
  const tiff = await getTiff(dataset);
  const image = await tiff.getImage();
  const geom = getRasterGeometry(image);

  const pixel = toPixelIndex(geom, xy);
  if (!pixel) return null;

  const rasters = await image.readRasters({
    window: [pixel.px, pixel.py, pixel.px + 1, pixel.py + 1],
  });
  const band = rasters[0] as ArrayLike<number>;
  return toElevationOrNull(band[0], image.getGDALNoData());
}

/**
 * 測線上の複数サンプル点の標高値を、COGのタイル(内部ブロック)単位でまとめて取得する。
 * 点ごとに個別のHTTP Range Requestを発行する {@link sampleElevation} の繰り返し呼び出しに比べ、
 * リクエスト数を大幅に削減できる(research.md R2の性能リスク対応)。
 *
 * 実装メモ: 当初は全サンプル点を囲む矩形バウンディングボックスを1回で読み込む方式を試みたが、
 * 対角線に近い測線では矩形内に測線が実際に通らない領域が大量に含まれ、実データ(6km超の測線)で
 * 読込データ量が数百MBに達しページが応答不能になることを実機で確認した。そのため、サンプル点が
 * 属するCOGタイル(`image.getTileWidth()/getTileHeight()`、本アプリでは512x512px)ごとにグループ化し、
 * タイル境界に一致したウィンドウで読み込む方式に変更した。同じタイルに属する点は1回の読込を共有する
 * ため、読込量は「測線が実際に通過するタイル数」に比例し、矩形面積には比例しない。
 */
export async function sampleElevationsAlongLine(
  dataset: DemDatasetConfig,
  points: XY[],
): Promise<Array<number | null>> {
  if (points.length === 0) return [];

  const tiff = await getTiff(dataset);
  const image = await tiff.getImage();
  const geom = getRasterGeometry(image);
  const tileWidth = image.getTileWidth();
  const tileHeight = image.getTileHeight();
  const noData = image.getGDALNoData();

  const pixelCoords = points.map((xy) => toPixelIndex(geom, xy));

  const tileGroups = new Map<string, { tx: number; ty: number; pointIndices: number[] }>();
  pixelCoords.forEach((coord, i) => {
    if (!coord) return;
    const tx = Math.floor(coord.px / tileWidth);
    const ty = Math.floor(coord.py / tileHeight);
    const key = `${tx}:${ty}`;
    let group = tileGroups.get(key);
    if (!group) {
      group = { tx, ty, pointIndices: [] };
      tileGroups.set(key, group);
    }
    group.pointIndices.push(i);
  });

  const results: Array<number | null> = points.map(() => null);

  await Promise.all(
    Array.from(tileGroups.values()).map(async ({ tx, ty, pointIndices }) => {
      const px0 = tx * tileWidth;
      const py0 = ty * tileHeight;
      const px1 = Math.min(px0 + tileWidth, geom.width);
      const py1 = Math.min(py0 + tileHeight, geom.height);
      const windowWidth = px1 - px0;

      const rasters = await image.readRasters({ window: [px0, py0, px1, py1] });
      const band = rasters[0] as ArrayLike<number>;

      for (const i of pointIndices) {
        const coord = pixelCoords[i]!;
        const idx = (coord.py - py0) * windowWidth + (coord.px - px0);
        results[i] = toElevationOrNull(band[idx], noData);
      }
    }),
  );

  return results;
}
