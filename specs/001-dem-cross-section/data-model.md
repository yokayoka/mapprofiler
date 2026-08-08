# Phase 1 Data Model: 能登半島DEM断面図WebGIS

spec.md の Key Entities を、実装時の型として整理する。すべてクライアントサイドのメモリ上に
保持される値であり、永続化ストレージ(DB等)は存在しない(憲法 原則I)。

## TransectLine(測線)

ユーザーが地図上で指定する測線。

| フィールド | 型 | 説明 |
|---|---|---|
| `startLatLng` | `{ lat: number; lng: number }` | 始点(WGS84緯度経度) |
| `endLatLng` | `{ lat: number; lng: number }` | 終点(WGS84緯度経度) |
| `startXY` | `{ x: number; y: number }` | 始点(EPSG:6675、メートル) |
| `endXY` | `{ x: number; y: number }` | 終点(EPSG:6675、メートル) |
| `samplingIntervalM` | `number` | サンプリング間隔(メートル、正の数) |

**Validation rules**:
- `startLatLng` と `endLatLng` は同一地点であってはならない(距離ゼロ禁止、Edge Case)。
- `samplingIntervalM` は 0 より大きい値でなければならない。
- `startXY` / `endXY` は `startLatLng` / `endLatLng` から一意に導出される(FR-003)。

**Derived**:
- `lengthM = distance(startXY, endXY)`(メートル)
- `sampleCount = floor(lengthM / samplingIntervalM) + 1`

## DemDatasetConfig(DEMデータセット設定)

運用者があらかじめ用意する、比較対象となる各時期のDEM設定(FR-006)。ビルド時/設定ファイルで
定義される静的データであり、エンドユーザーは編集しない。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `string` | データセット識別子(例: `"pre-earthquake"`) |
| `label` | `string` | 表示用ラベル(例: `"地震前(2023年)"`) |
| `cogUrl` | `string` | COGファイルのURL(HTTP Range Request・CORS対応が前提、research.md R2参照) |
| `crs` | `"EPSG:6675"` | 空間参照系(固定) |
| `resolutionM` | `number` | 解像度(メートル、想定値 0.5) |
| `color` | `string` | 断面図上での系列表示色(CSSカラー) |

**Validation rules**:
- `id` はアプリ内で一意。
- 標準構成は3件(地震前・地震後・豪雨後)を想定するが、件数は可変(spec.md Assumptions)。

## ProfilePoint(断面プロファイル点)

測線上の1サンプリング位置における、各DEMデータセットの標高値。

| フィールド | 型 | 説明 |
|---|---|---|
| `distanceM` | `number` | 始点からの距離d(メートル) |
| `elevationByDataset` | `Record<datasetId, number \| null>` | データセットIDごとの標高z。データ欠損時は `null`(FR-012, Edge Cases) |

## CrossSectionProfile(断面図)

TransectLine と、複数 DemDatasetConfig に対応する ProfilePoint 配列の集合。画面表示・PNG出力の対象。

| フィールド | 型 | 説明 |
|---|---|---|
| `line` | `TransectLine` | 対象の測線 |
| `points` | `ProfilePoint[]` | 距離順にソートされたサンプル点配列 |
| `datasets` | `DemDatasetConfig[]` | この断面図に含まれるデータセット一覧 |
| `visibleDatasetIds` | `Set<datasetId>` | 現在表示中(ON)のデータセットID集合(FR-014) |
| `generatedAt` | `Date` | 生成日時(表示・デバッグ用) |

**State transitions**:
1. `line` が確定(始点・終点・サンプリング間隔が有効)→ `points` を計算 → `CrossSectionProfile` 生成。
2. ユーザーが凡例操作でデータセットの表示/非表示を切り替える → `visibleDatasetIds` のみ更新(再計算不要)。
3. `line` が再指定される → 新しい `CrossSectionProfile` を再生成(既存を置き換え)。

## TileLayerConfig(タイルレイヤー設定)

背景地図として参照するタイル配信候補(FR-001, FR-015, FR-016)。運用者が候補一覧を固定設定し、
エンドユーザーはその中からレイヤー切替コントロールで選択する(自由URL入力はできない)。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `string` | データセット識別子(例: `"post-rainfall-ortho"`)。既定タイルの指定に使用 |
| `label` | `string` | レイヤー切替コントロールに表示する名称(例: `"豪雨後オルソ(2024年9月・国土地理院)"`) |
| `urlTemplate` | `string` | タイルURLテンプレート(例: `"https://.../{z}/{x}/{y}.png"`) |
| `attribution` | `string` | 出典表記(Leafletのattributionコントロールに表示、選択中のレイヤーに応じて切り替わる) |
| `maxZoom` | `number` | 最大ズームレベル |

**Validation rules**:
- `urlTemplate` はCORSを許可する配信元であることが望ましい(地図PNGエクスポート、research.md R5参照)。
- 候補一覧は1件以上。`id` は一覧内で一意。
- 個別タイルの読込失敗(範囲外・404等)はEdge Cases通りフォールバック表示とするが、同一レイヤー内で
  1枚も読み込めなかった場合のみ通知を表示する(一部タイル欠損は正常動作として扱う)。

## エンティティ関係図

```
TileLayerConfig ──(1)──> 背景地図表示(User Story 5)

TransectLine ──(1:N)──> ProfilePoint ──(N:1 per dataset)──> DemDatasetConfig
      │
      └──(1:1)──> CrossSectionProfile ──(1:N)──> DemDatasetConfig(比較対象)
```
