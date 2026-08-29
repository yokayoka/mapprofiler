/** 日本語・英語の2言語対応テキスト(FOSS4G Hiroshima 2026向けの英語表示対応)。 */
export interface LocalizedText {
  ja: string;
  en: string;
}

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
  label: LocalizedText;
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
  label: LocalizedText;
  urlTemplate: string;
  attribution: LocalizedText;
  maxZoom: number;
}
