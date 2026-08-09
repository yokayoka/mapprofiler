import type { DemDatasetConfig, TileLayerConfig } from "../types";

/**
 * 背景タイル配信の一覧。運用者があらかじめ設定する(FR-001, FR-015)。エンドユーザーは
 * この中からLeafletのレイヤー切替コントロールで選択できるが、任意URLの自由入力UIは提供しない。
 *
 * CORSを許可しない配信元を指定すると、地図PNGダウンロード(User Story 4)が
 * 失敗する可能性がある(research.md R5)。
 *
 * maxZoom は暫定値(18)。配信元ごとのタイル提供範囲が判明次第、個別に調整すること。
 */
export const tileLayers: TileLayerConfig[] = [
  {
    id: "gsi-standard",
    label: "地理院地図(国土地理院)",
    urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution: "出典: 国土地理院(地理院地図)",
    maxZoom: 18,
  },
  {
    id: "post-rainfall-ortho",
    label: "豪雨後オルソ(2024年9月・国土地理院)",
    urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/20240923rain_wajima_0923do_sokuho/{z}/{x}/{y}.png",
    attribution: "出典: 国土地理院(令和6年9月能登豪雨 災害状況把握用オルソ画像)",
    maxZoom: 18,
  },
  {
    id: "post-earthquake-ortho",
    label: "地震後オルソ(2024年4月・国土地理院)",
    urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/20240102noto_0405_0426do/{z}/{x}/{y}.png",
    attribution: "出典: 国土地理院(令和6年能登半島地震 災害状況把握用オルソ画像)",
    maxZoom: 18,
  },
  {
    id: "pre-earthquake-cs",
    label: "地震前CS立体図(森林総合研究所)",
    urlTemplate: "https://www2.ffpri.go.jp/soilmap/tile/cs_noto/{z}/{x}/{y}.png",
    attribution: "出典: 森林総合研究所 CS立体図(能登)",
    maxZoom: 18,
  },
  {
    id: "post-earthquake-cs",
    label: "地震後CS立体図(林野庁)",
    urlTemplate: "https://rinya.geospatial.jp/tile/csmaptile_noto/{z}/{x}/{y}.png",
    attribution: "出典: 林野庁 CS立体図(能登)",
    maxZoom: 18,
  },
  {
    id: "post-earthquake-rrim",
    label: "地震後赤色立体図(林野庁)",
    urlTemplate: "https://forestgeo.info/opendata/17_ishikawa/noto/rrim_2024/{z}/{x}/{y}.webp",
    attribution: "出典: 林野庁 赤色立体図(能登)",
    maxZoom: 18,
  },
];

/** 初期表示する背景タイル。ユーザーはレイヤー切替コントロールでいつでも変更できる。 */
export const defaultTileLayerId: string = "post-rainfall-ortho";

/**
 * 比較対象とするDEM(COG)データセット一覧。運用者があらかじめ設定する(FR-006)。
 * 標準構成は「地震前」「地震後・豪雨前」「豪雨後」の3時期を想定するが、可変(spec.md Assumptions)。
 *
 * cogUrl は HTTP Range Request と CORS を許可する配信元である必要がある(research.md R2)。
 *
 * 町野地区(能登半島北部)のテスト用DEM。Google Cloud Storage(公開バケット
 * `mapprofiler-noto-dem`、HTTP Range Request・CORS対応済み)でホスティングしている
 * (research.md R2)。ローカル動作確認時は `npm run dem:serve` で `dem/cog/` を
 * http://localhost:8787 で配信する構成に切り替えてもよい。
 */
const GCS_BUCKET_BASE = "https://storage.googleapis.com/mapprofiler-noto-dem";

export const demDatasets: DemDatasetConfig[] = [
  {
    id: "pre-earthquake",
    label: "地震前(〜2022年)",
    cogUrl: `${GCS_BUCKET_BASE}/bfdem_machino.tif`,
    crs: "EPSG:6675",
    resolutionM: 0.5,
    color: "#4C72B0",
  },
  {
    id: "post-earthquake",
    label: "地震後・豪雨前(2024年4月)",
    cogUrl: `${GCS_BUCKET_BASE}/afdem_machino.tif`,
    crs: "EPSG:6675",
    resolutionM: 0.5,
    color: "#DD8452",
  },
  {
    id: "post-rainfall",
    label: "豪雨後(2024年10月)",
    cogUrl: `${GCS_BUCKET_BASE}/afstdem_machino.tif`,
    crs: "EPSG:6675",
    resolutionM: 0.5,
    color: "#55A868",
  },
];
