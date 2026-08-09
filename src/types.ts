export interface LatLng {
  lat: number;
  lng: number;
}

export interface XY {
  x: number;
  y: number;
}

export interface TransectLine {
  startLatLng: LatLng;
  endLatLng: LatLng;
  startXY: XY;
  endXY: XY;
  samplingIntervalM: number;
}

export interface DemDatasetConfig {
  id: string;
  label: string;
  cogUrl: string;
  crs: "EPSG:6675";
  resolutionM: number;
  color: string;
}

export interface ProfilePoint {
  distanceM: number;
  elevationByDataset: Record<string, number | null>;
}

export interface CrossSectionProfile {
  line: TransectLine;
  points: ProfilePoint[];
  datasets: DemDatasetConfig[];
  visibleDatasetIds: Set<string>;
  generatedAt: Date;
}

/** ユーザーが断面図の系列ごとに変更できる表示スタイル(線の色・太さ)。 */
export interface DatasetLineStyle {
  color: string;
  lineWidthPx: number;
}

export interface TileLayerConfig {
  id: string;
  label: string;
  urlTemplate: string;
  attribution: string;
  maxZoom: number;
}
