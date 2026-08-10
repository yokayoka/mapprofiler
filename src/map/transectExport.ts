import type { LatLng } from "../types";

export interface TransectForKmlExport {
  startLatLng: LatLng;
  endLatLng: LatLng;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toKmlCoordinate(point: LatLng): string {
  return `${point.lng},${point.lat},0`;
}

/**
 * 測線(始点・終点)をKML(LineString + 始点/終点のPoint)として書き出す(他アプリでの再利用向け)。
 * KMLの座標順序は経度,緯度,標高(lng,lat,alt)である点に注意(GeoJSONと同じ順序、緯度経度の
 * 表記順とは逆)。
 */
export function buildTransectKml(transect: TransectForKmlExport, name = "測線"): string {
  const { startLatLng, endLatLng } = transect;
  const escapedName = escapeXml(name);
  const lineCoordinates = `${toKmlCoordinate(startLatLng)} ${toKmlCoordinate(endLatLng)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapedName}</name>
    <Placemark>
      <name>${escapedName}</name>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${lineCoordinates}</coordinates>
      </LineString>
    </Placemark>
    <Placemark>
      <name>始点</name>
      <Point>
        <coordinates>${toKmlCoordinate(startLatLng)}</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>終点</name>
      <Point>
        <coordinates>${toKmlCoordinate(endLatLng)}</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>
`;
}

/** `buildTransectKml()`の出力をそのままダウンロードできるdata URLに変換する。 */
export function buildTransectKmlDataUrl(transect: TransectForKmlExport, name?: string): string {
  const kml = buildTransectKml(transect, name);
  return `data:application/vnd.google-earth.kml+xml;charset=utf-8,${encodeURIComponent(kml)}`;
}

export function buildTransectKmlFilename(prefix = "transect"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${timestamp}.kml`;
}
