# Contract: コア地理空間ロジック(内部モジュールAPI)

本アプリはサーバーを持たないため、外部公開APIは存在しない。代わりに、憲法 原則III(地理空間データの
正確性)・原則V(コアロジックのテスト必須)の対象となる内部モジュールの関数契約をここに定義する。
`tests/unit/` はこの契約に対して書かれる。

## `coordinateTransform`

```ts
/** WGS84 (lon, lat) を EPSG:6675 (x, y メートル) に変換する。 */
function wgs84ToEpsg6675(lon: number, lat: number): { x: number; y: number };
```

- **Preconditions**: `lon`, `lat` は有効な地理座標範囲内(能登半島北部周辺を想定)。
- **Postconditions**: 戻り値はEPSG:6675のメートル単位平面座標。
- **Error handling**: 範囲外・不正値の場合は例外を投げる(呼び出し側でユーザーにエラー表示、Edge Cases参照)。

## `profileSampler`

```ts
interface SamplePlan {
  startXY: { x: number; y: number };
  endXY: { x: number; y: number };
  samplingIntervalM: number;
}

/** 測線を等間隔サンプリングし、各点の (始点からの距離d, 平面座標xy) を返す。 */
function buildSamplePoints(plan: SamplePlan): Array<{ distanceM: number; xy: { x: number; y: number } }>;
```

- **Preconditions**: `samplingIntervalM > 0`、`startXY !== endXY`(距離ゼロ禁止)。
- **Postconditions**: 返却配列は `distanceM` の昇順。最初の点は `distanceM = 0`、最後の点は測線長以下で
  測線長に最も近い値(端点を必ず含む)。

## `demSource`

```ts
/** 指定したEPSG:6675座標における標高値をCOGから取得する。データ提供範囲外はnull。 */
function sampleElevation(dataset: DemDatasetConfig, xy: { x: number; y: number }): Promise<number | null>;
```

- **Preconditions**: `dataset.cogUrl` が有効なCOG(Cloud Optimized GeoTIFF)を指す。
- **Postconditions**: 範囲内なら標高値(メートル)、範囲外・NoDataなら `null`(FR-012)。
- **補間方式**: サンプリング間隔がDEMの解像度(0.5m)より小さい場合、隣接画素から標高を補間する
  (spec.md Edge Cases)。方式は「最近傍法(nearest-neighbor)」「バイリニア法(bilinear)」のいずれを
  採用してもよい。厳密な精度が必要な用途では地形の連続性を滑らかに表現できるバイリニア法が望ましく、
  実装の単純さ・速度を優先する場合は最近傍法でもよい。**実装時にどちらを選択したかをこの関数の
  コードコメントおよび `tasks.md` T016 に明記し、選択した方式に対応するユニットテスト
  (`tests/unit/demSource.test.ts`、T013)を書くこと。**
- **Performance**: 実装はHTTP Range Requestによる部分読み込みを用い、COG全体をダウンロードしない
  (research.md R2、憲法 原則II)。

```ts
/** 測線上の複数サンプル点の標高値を、COGのタイル(内部ブロック)単位でまとめて取得する。 */
function sampleElevationsAlongLine(
  dataset: DemDatasetConfig,
  points: Array<{ x: number; y: number }>
): Promise<Array<number | null>>;
```

- **採用の経緯**: 当初 `generateProfile` は `sampleElevation` を点ごとに呼び出していたが、実データ
  (数千サンプル点規模の測線)を用いた実機検証でページが長時間応答不能になることを確認した
  (research.md R2で懸念していた性能リスクが実際に顕在化)。次に測線のバウンディングボックス全体を
  1回で読み込む方式を試みたが、対角線に近い測線では矩形に無駄な領域が大量に含まれ、依然として
  応答不能になることを確認した。最終的に、サンプル点が属するCOGタイル(`getTileWidth()`/
  `getTileHeight()`)ごとにグループ化し、タイル境界に一致したウィンドウで読み込む方式に変更した。
  `generateProfile` は `sampleElevation` ではなく `sampleElevationsAlongLine` を使用する。
  `sampleElevation`(単一点版)はAPIとして維持するが、断面図生成の内部では使用しない。

## `profileGenerator`(上記を合成)

```ts
/** 測線・サンプリング間隔・複数DEMデータセットから CrossSectionProfile を生成する。 */
function generateProfile(
  line: TransectLine,
  datasets: DemDatasetConfig[]
): Promise<CrossSectionProfile>;
```

- **Postconditions**: `points` は `profileSampler` が生成した距離配列と一致し、各点の
  `elevationByDataset` は `demSource.sampleElevationsAlongLine` の結果(欠損時 `null`)を含む
  (FR-005, FR-006, FR-012)。

## テスト対象(憲法 原則V に基づく必須ユニットテスト)

- `wgs84ToEpsg6675`: 既知の変換ペア(基準点)による往復・既知値検証。
- `buildSamplePoints`: 端点を含むこと、距離ゼロ入力での例外、サンプリング間隔がDEM解像度未満の場合の
  サンプル数検証。
- `sampleElevation`: データ範囲内/範囲外(`null`)の双方のケース、および採用した補間方式
  (最近傍法またはバイリニア法)による補間結果のケース(テスト用の小さなCOGフィクスチャ、
  またはモックを使用)。
- `sampleElevationsAlongLine`: 範囲内/NoData/範囲外が混在する複数点で正しい値を返すこと、
  複数点を渡してもreadRastersの呼び出しが1回にまとまること(性能対応の検証)、全点範囲外の場合に
  読込自体を行わずnull配列を返すこと。
- `generateProfile`: 上記を組み合わせた統合的なユニットテスト(複数データセットでの欠損混在ケースを含む)。
