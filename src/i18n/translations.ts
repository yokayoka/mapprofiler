import type { Lang } from "./i18n";

/**
 * UI文言の翻訳辞書(FOSS4G Hiroshima 2026向け英語表示対応)。
 * `Translations`型により、日本語・英語の両方が同じキー集合を持つことをコンパイル時に保証する。
 */
export type TranslationKey =
  | "appTitle"
  | "instructionText"
  | "samplingIntervalLabel"
  | "generateButton"
  | "downloadMapButton"
  | "downloadKmlButton"
  | "datasetStyleHeading"
  | "datasetColorAriaLabel"
  | "datasetWidthAriaLabel"
  | "showPointsToggleLabel"
  | "downloadProfileButton"
  | "formErrorNoTransect"
  | "formErrorInvalidInterval"
  | "confirmLargeTransect"
  | "profileErrorSameLocation"
  | "profileErrorGeneric"
  | "mapExportErrorGeneric"
  | "tileFallbackNotice"
  | "elevationChangeLayerName"
  | "elevationChangeAttribution"
  | "elevationChangeLegendTitle"
  | "chartAxisDistance"
  | "chartAxisElevation"
  | "kmlTransectName"
  | "kmlStartPointName"
  | "kmlEndPointName"
  | "langSwitchLabel";

type Translations = Record<TranslationKey, string>;

const ja: Translations = {
  appTitle: "能登半島DEM断面図ビューア",
  instructionText: "地図上で2点クリックして測線(始点・終点)を指定してください。",
  samplingIntervalLabel: "サンプリング間隔 (m)",
  generateButton: "断面図を作成",
  downloadMapButton: "地図をPNGでダウンロード",
  downloadKmlButton: "測線をKMLでダウンロード",
  datasetStyleHeading: "断面図の線の色・太さ",
  datasetColorAriaLabel: "{label}の線の色",
  datasetWidthAriaLabel: "{label}の線の太さ(px)",
  showPointsToggleLabel: "標高サンプル点を表示する",
  downloadProfileButton: "断面図をPNGでダウンロード",
  formErrorNoTransect: "地図上で測線(始点・終点)を指定してください。",
  formErrorInvalidInterval: "サンプリング間隔は0より大きい数値を指定してください。",
  confirmLargeTransect:
    "測線長は約{lengthM}m、推定サンプル点数は約{count}点です。処理に時間がかかる可能性があります。続行しますか?",
  profileErrorSameLocation: "始点と終点が同じ地点です。異なる2点をクリックし直してください。",
  profileErrorGeneric: "断面図の作成に失敗しました。測線やDEM設定を確認してください。",
  mapExportErrorGeneric:
    "地図のPNG化に失敗しました。背景タイルの配信元がCORSを許可していない可能性があります。",
  tileFallbackNotice:
    "背景タイル地図を読み込めませんでした(配信元設定を確認してください)。断面図の作成機能は引き続き利用できます。",
  elevationChangeLayerName: "地形変化量(5m色別)",
  elevationChangeAttribution: "出典: 林野庁(標高差分タイルを地形変化量として色分け表示)",
  elevationChangeLegendTitle: "地形変化量(5m色別)",
  chartAxisDistance: "始点からの距離 (m)",
  chartAxisElevation: "標高 (m)",
  kmlTransectName: "測線",
  kmlStartPointName: "始点",
  kmlEndPointName: "終点",
  langSwitchLabel: "English",
};

const en: Translations = {
  appTitle: "Noto Peninsula DEM Cross-Section Viewer",
  instructionText: "Click two points on the map to set the transect line (start and end).",
  samplingIntervalLabel: "Sampling interval (m)",
  generateButton: "Generate profile",
  downloadMapButton: "Download map as PNG",
  downloadKmlButton: "Download transect as KML",
  datasetStyleHeading: "Line color & width for each dataset",
  datasetColorAriaLabel: "Line color for {label}",
  datasetWidthAriaLabel: "Line width (px) for {label}",
  showPointsToggleLabel: "Show elevation sample points",
  downloadProfileButton: "Download profile as PNG",
  formErrorNoTransect: "Please specify the transect (start and end points) on the map.",
  formErrorInvalidInterval: "Please enter a sampling interval greater than 0.",
  confirmLargeTransect:
    "The transect is about {lengthM} m long, with an estimated {count} sample points. This may take a while to process. Continue?",
  profileErrorSameLocation: "The start and end points are the same. Please click two different points.",
  profileErrorGeneric: "Failed to generate the profile. Please check the transect and DEM settings.",
  mapExportErrorGeneric:
    "Failed to export the map as PNG. The background tile source may not allow CORS.",
  tileFallbackNotice:
    "Failed to load the background tile map (please check the tile source). The profile generation feature is still available.",
  elevationChangeLayerName: "Elevation change (5 m color-coded)",
  elevationChangeAttribution:
    "Source: Forestry Agency of Japan (elevation-difference tiles rendered as color-coded terrain change)",
  elevationChangeLegendTitle: "Elevation change (5 m color-coded)",
  chartAxisDistance: "Distance from start (m)",
  chartAxisElevation: "Elevation (m)",
  kmlTransectName: "Transect",
  kmlStartPointName: "Start point",
  kmlEndPointName: "End point",
  langSwitchLabel: "日本語",
};

export const translations: Record<Lang, Translations> = { ja, en };
