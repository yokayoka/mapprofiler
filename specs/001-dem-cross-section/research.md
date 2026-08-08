# Phase 0 Research: 能登半島DEM断面図WebGIS

## R1. フロントエンド実装方式

**Decision**: Vite + TypeScript(フレームワークなし、Vanilla)。

**Rationale**: 画面構成は「地図 + 操作フォーム + 断面図グラフ」の単一ページで、複雑な画面遷移や
状態管理を要しない。憲法 原則II(軽量性)・IV(シンプルさ/YAGNI)に照らすと、React 等の
UIフレームワークを導入する必然性がない。Vite はビルドが高速で、`vite build` の成果物は
そのまま GitHub Pages にデプロイできる静的ファイル一式になる(原則I: 静的サイト・サーバーレス)。

**Alternatives considered**:
- React + Vite: コンポーネント化の恩恵はあるが、本機能規模には過剰(ユーザーが選択せず)。
- 素の HTML/JS(ビルドレス): TypeScript の型チェックと npm パッケージ管理(Leaflet, geotiff 等)の
  恩恵を失うため不採用。

## R2. DEM(COG)読み込み

**Decision**: `geotiff`(geotiff.js)を使用し、`fromUrl()` + 内部の HTTP Range Request による
部分読み込みで COG から必要なウィンドウ/オーバービューのみを取得する。

**Rationale**: geotiff.js はブラウザ上で Cloud Optimized GeoTIFF を扱う事実上の標準ライブラリで、
サーバー処理なしに任意座標のピクセル値を取得できる。憲法 原則II(COG全体をダウンロードしない)
に直接対応する。

**Alternatives considered**: サーバーサイドでのラスタ処理(GDAL 等) — 原則I(サーバーレス)に反するため不採用。

**リスクと対応方針**:
- COG ファイル配信元は HTTP Range Request(`Accept-Ranges: bytes`)と CORS を許可している必要がある。
- 0.5m解像度・能登半島北部を覆う複数時期の DEM は、GitHub の単一ファイルサイズ上限(実用上 100MB 目安)
  を超える可能性が高い。そのため COG 本体は GitHub Pages が配信する同一リポジトリ内ではなく、
  Range Request と CORS を許可する外部の静的ストレージ(例: オブジェクトストレージ、CDN)に
  配置し、アプリはその URL を設定(`DemDatasetConfig.cogUrl`)経由で参照する構成を前提とする
  (spec.md の Assumptions と整合)。
- **性能リスク(SC-001対応)→実際に顕在化し対応済み**: 当初 `sampleElevation()` をサンプル点1点ずつ
  呼び出す実装だったが、実データ(能登半島北部・町野地区のテストDEM、EPSG:6675実測)を用いた
  実機検証で、6km超の測線・5mサンプリング間隔(約1,300点×3データセット ≈ 3,900回の個別読込)を
  指定したところ、ページが1分以上応答不能になることを確認した。原因は点ごとに個別のHTTP Range
  Requestと`readRasters`呼び出しが発生し、リクエスト数・Promiseスケジューリングのオーバーヘッドが
  点数に比例して増大したため。
  1回目の対応として、測線のバウンディングボックス全体を1回の`readRasters({ window })`で読み込む
  方式を試みたが、この測線(始点・終点の位置関係により対角線に近い形状)では矩形ウィンドウに
  測線が実際に通らない領域が大量に含まれ、1データセットあたり数百MBの読込・展開が発生し、
  依然としてページが応答不能になることを実機で確認した。
  最終的に `sampleElevationsAlongLine(dataset, points)` を、サンプル点が属するCOGの内部タイル
  (`image.getTileWidth()/getTileHeight()`、本アプリのCOGはBLOCKSIZE=512)ごとにグループ化し、
  タイル境界に一致したウィンドウで読み込む方式に変更した。同一タイルに属する点は読込を共有するため、
  読込量は「測線が実際に通過するタイル数」にのみ比例し、矩形面積(=対角線では測線長の2乗)には
  比例しない。この方式で実データによる実機検証が正常に完了することを確認した(quickstart.md
  シナリオ実行結果参照)。`generateProfile` は本関数を使用する。

## R3. 座標変換(WGS84 → EPSG:6675)

**Decision**: `proj4`(proj4js)を使用し、EPSG:6675(JGD2011 / Japan Plane Rectangular CS
Zone VII〈7系〉)の定義を登録して変換する。

**Rationale**: EPSG:6675 は石川県(能登半島を含む)・富山県・岐阜県・愛知県が属する平面直角座標系
7系であり、対象地域(能登半島北部)と整合する。proj4js は主要な EPSG コードを手動定義文字列で
サポートしており、ブラウザ内で追加のネットワークアクセスなしに変換できる。

**定義文字列**(T008実装時にepsg.io/GSIの一次情報と照合し確定。原点: 北緯36°0′0″, 東経137°10′0″):
```
+proj=tmerc +lat_0=36 +lon_0=137.16666666666666 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs
```

> 計画時点(plan.md作成時)では誤って「Zone XIII〈13系〉・lon_0=136.25」と記載していたが、
> 実装時(T008)に一次情報と照合した結果、正しくは「Zone VII〈7系〉・lon_0=137°10′(約137.1667)」
> であることが判明し、本ドキュメントを訂正した。

**Alternatives considered**: 自前の平面直角座標系変換式の実装 — 車輪の再発明であり、原則IV(YAGNI)
に反するため不採用。

## R4. 断面図(距離-標高グラフ)描画

**Decision**: `chart.js` の折れ線グラフ(line chart)を使用する。

**Rationale**: 複数時期の系列(データセット)を重ねて表示し、凡例クリックで個別に表示/非表示を
切り替える機能(FR-014)を標準機能として持つため追加実装が最小で済む。Canvas ベースであり
PNG エクスポート(`canvas.toDataURL('image/png')`)も標準APIのみで完結する(FR-009)。

**Alternatives considered**: 自前 SVG/Canvas 描画 — 凡例トグル・軸描画・複数系列対応を自前実装する
コストが高く、原則IV(YAGNI)に反するため不採用。

## R5. 地図・断面図の PNG エクスポート

**Decision**: 断面図は Chart.js の canvas を直接 `toDataURL()` して PNG 化する。地図(Leaflet)は
`html2canvas` を用いて地図コンテナ全体(タイル+測線オーバーレイ+縮尺コントロール)を DOM ごと
キャプチャして PNG 化する。

**Rationale**: いずれも追加サーバーを必要とせず、ブラウザの Canvas API のみで完結する(原則I)。

> **実装時の決定(T030)**: 当初 `leaflet-image` を候補としていたが、`leaflet-image` は
> Leafletのレイヤー(タイル・ベクタ)のみをcanvasに再構成する仕組みであり、`L.control.scale()`
> のようなDOMベースのコントロールはレンダリング対象に含まれない。`html2canvas` は対象要素の
> DOM全体を描画するため縮尺コントロールを確実に含められることから、`html2canvas` に一本化した
> (`leaflet-image` は依存関係から削除)。バンドルサイズへの影響を避けるため、`html2canvas` は
> 地図PNGダウンロード操作時にのみ動的import(`import("html2canvas")`)で読み込む(原則II)。

**リスクと対応方針**:
- 背景タイル画像が CORS を許可していない場合、canvas が「汚染(tainted)」され `toDataURL()` が
  失敗する。運用者がタイルアドレスを設定する際(FR-015)は、CORS ヘッダー(`Access-Control-Allow-Origin`)
  を返すタイル配信元を選定する必要がある。この制約は quickstart.md および運用者向け設定ドキュメントに明記する。
  あわせて `src/map/mapView.ts` の `L.tileLayer` に `crossOrigin: true` を設定し、タイル画像の
  `<img>` 要素がCORSモードで読み込まれるようにした。

## R6. テスト方針

**Decision**: `vitest` を使用する。

**Rationale**: Vite プロジェクトとの親和性が高く(設定共有・高速実行)、憲法 原則V(コアロジックの
テスト必須)が要求する座標変換・DEMサンプリング・断面図生成ロジックのユニットテストを
Jest 互換の書き味で実装できる。

**Alternatives considered**: Jest — Vite プロジェクトでは追加の変換設定が必要になり、vitest に比べ
セットアップコストが高いため不採用。

## R7. ホスティング/デプロイ

**Decision**: `vite build` の成果物(`dist/`)を GitHub Pages(GitHub Actions によるビルド&デプロイ、
または `gh-pages` ブランチ配信)で公開する。

**Rationale**: 憲法 原則I・Technology Constraints に明記されたホスティング方針。

## R8. 実データ検証で判明したデータ品質事項 → 解決済み

町野地区テストDEM(dem/tif/ → dem/cog/)を用いた実機検証(2026-08-09)で、`afstdem_machino.tif`
(豪雨後・2024年10月)に、ファイルの登録NoData値(3.4e+38)とは異なる「ダミー値」が標高として
そのまま埋め込まれていることを発見した。

- `-111.0999984741211` が数百メートル区間にわたって完全に同一の値で連続(自然地形ではあり得ない)
- `-999.9000244140625`(`gdalinfo -stats` で確認したファイル全体の統計上の最小値と一致)

同じ地点で `bfdem_machino`・`afdem_machino` は0〜1m程度の妥当な値を示しており、ArcGIS Pro側での
水域・欠測域マスク処理時の仮値が正しくNoDataとして設定されずエクスポートされたものと推測された。

**対応(完了)**: ユーザーがArcGIS Proで「-100未満をSetNullでNoData化」した修正版
(`afstdem_machino_2.tif`)を作成。`gdalinfo -stats`で最小値が`-999.9`→`-1.0`、標準偏差が
他の2時期と同水準(約89.6)に改善したことを確認した上でCOG変換(`dem/cog/afstdem_machino.tif`を
置き換え)。ブラウザでの実機検証(約10kmの測線、5mサンプリング間隔)で異常な垂直スパイクが解消され、
3時期の断面線が地形に沿って自然に一致することを確認した。

## 未解決事項(実装フェーズで確認)

- ~~EPSG:6675 の proj4 定義文字列~~ → T008で一次情報と照合し確定(R3)。
- ~~地図PNGエクスポートで `leaflet-image` と `html2canvas` のどちらが縮尺コントロールを含められるか~~
  → `html2canvas` に決定(R5)。
- ~~`afstdem_machino.tif` のNoDataダミー値混入~~ → 修正版データで解決(R8)。
- 実際のDEM COGファイルの本番配置先(外部ストレージのURL)は、データ準備担当者が別途決定する
  (spec.md Assumptions に基づき、本機能はURL参照のみを行う)。町野地区テストDEMは現在
  `npm run dem:serve` によるローカル配信を前提としている(`src/config/datasets.ts` 参照)。
