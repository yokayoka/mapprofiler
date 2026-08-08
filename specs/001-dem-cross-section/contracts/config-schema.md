# Contract: 運用者向け設定スキーマ

タイル配信アドレス(FR-015)とDEMデータセット一覧(FR-006)は、エンドユーザー向けUIではなく、
運用者がビルド前に編集する設定として提供する。`src/config/datasets.ts` に配置する想定。

## TileLayerConfig[] (FR-001, FR-015, FR-016)

```ts
export const tileLayers: Array<{
  id: string;             // 一意な識別子。defaultTileLayerIdの参照先
  label: string;          // レイヤー切替コントロールに表示する名称
  urlTemplate: string;    // 例: "https://example.com/tiles/{z}/{x}/{y}.png"
  attribution: string;
  maxZoom: number;
}> = [
  // 例:
  // { id: "post-rainfall-ortho", label: "豪雨後オルソ(2024年9月)", urlTemplate: "https://.../{z}/{x}/{y}.png", attribution: "出典: ...", maxZoom: 18 },
];

export const defaultTileLayerId: string = "post-rainfall-ortho";
```

**Contract**:
- `tileLayers` は1件以上を含むこと。`id` は一覧内で一意。
- `defaultTileLayerId` は `tileLayers` のいずれかの `id` と一致すること(一致しない場合、実装は
  配列の先頭を既定値として扱う)。
- `urlTemplate` はLeafletの `L.tileLayer()` にそのまま渡せるURLテンプレートであること。
  地図PNGエクスポート(User Story 4)を利用する場合、配信元はCORSヘッダーを返すことが必要
  (research.md R5)。
- エンドユーザーは `tileLayers` の中から選択するのみで、任意URLを自由入力するUIは提供しない
  (FR-015)。

## DemDatasetConfig[]

```ts
export const demDatasets: Array<{
  id: string;            // 一意な識別子
  label: string;         // UI表示名(例: "地震前(2023年)")
  cogUrl: string;        // COGファイルのURL(HTTP Range Request + CORS対応が必要)
  crs: "EPSG:6675";
  resolutionM: number;   // 例: 0.5
  color: string;         // 断面図での系列色(CSSカラー文字列)
}> = [
  // 例:
  // { id: "pre-earthquake", label: "地震前", cogUrl: "https://.../pre.tif", crs: "EPSG:6675", resolutionM: 0.5, color: "#4C72B0" },
  // { id: "post-earthquake", label: "地震後・豪雨前", cogUrl: "https://.../mid.tif", crs: "EPSG:6675", resolutionM: 0.5, color: "#DD8452" },
  // { id: "post-rainfall", label: "豪雨後", cogUrl: "https://.../post.tif", crs: "EPSG:6675", resolutionM: 0.5, color: "#55A868" },
];
```

**Contract**:
- `demDatasets` は1件以上を含むこと(0件の場合はUser Story 1が成立しない)。
- `id` は配列内で一意。
- `cogUrl` はCOG(Cloud Optimized GeoTIFF)であり、HTTP Range Requestおよび(必要であれば)CORSを
  許可する配信元でなければならない(research.md R2)。
- この設定ファイルの変更は再ビルド(`vite build`)によって初めて反映される。実行時の動的読み込みは
  スコープ外(FR-015の「運用者があらかじめ設定」という前提に合致)。
