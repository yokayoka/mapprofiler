import proj4 from "proj4";
import type { XY } from "../types";

/**
 * EPSG:6675 = JGD2011 / Japan Plane Rectangular CS zone VII(平面直角座標系 7系)。
 * 原点: 北緯36°0′0″, 東経137°10′0″。石川県・富山県・岐阜県・愛知県が属し、能登半島を含む。
 * 出典: 国土地理院 平面直角座標系原点一覧(epsg.ioのEPSG:6675定義と照合済み)。
 */
const EPSG_6675_DEF =
  "+proj=tmerc +lat_0=36 +lon_0=137.16666666666666 +k=0.9999 +x_0=0 +y_0=0 " +
  "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";

proj4.defs("EPSG:6675", EPSG_6675_DEF);

/** WGS84 (lon, lat) を EPSG:6675 (x, y メートル) に変換する。 */
export function wgs84ToEpsg6675(lon: number, lat: number): XY {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new Error(`Invalid WGS84 coordinate: lon=${lon}, lat=${lat}`);
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error(`WGS84 coordinate out of range: lon=${lon}, lat=${lat}`);
  }
  const [x, y] = proj4("WGS84", "EPSG:6675", [lon, lat]);
  return { x, y };
}
