# Phase 1 Data Model: 能登北部全域展開・1mDEM移行

001-dem-cross-sectionの[data-model.md](../001-dem-cross-section/data-model.md)で定義した型定義
(`TransectLine` / `DemDatasetConfig` / `ProfilePoint` / `CrossSectionProfile` / `TileLayerConfig`)は
**型としては無変更**。本ドキュメントは、002での**値・運用**の変更点のみを記載する。

## DemDatasetConfig の変更点

| フィールド | 001(町野地区版) | 002(能登北部全域版) |
|---|---|---|
| `resolutionM` | `0.5` | `1`(著作権保護のため。豪雨後データセットは平均法でダウンサンプル、地震前後は原本が既に1m) |
| `cogUrl` | 町野地区のみをカバーするCOG(3ファイル、GCS `mapprofiler-noto-dem`バケット) | 能登北部4市町を包含する共通クロップ範囲のCOG(3ファイル、research.md R9で作成。アップロード先URLは運用者が確定) |
| データが実際に存在する範囲 | 3データセットともほぼ同一(町野地区周辺) | **データセットごとに異なる**。豪雨後データセットは他の2時期より実測範囲が狭い(research.md R9) |

**Validation rules への追加**:
- `resolutionM` は 1 に統一する。0.5 等、1 より高精細な値をそのまま配信・使用してはならない
  (constitution.md Technology Constraints)。

## ProfilePoint / CrossSectionProfile

型定義・状態遷移は001から変更なし。ただし、`elevationByDataset` において「同一の`distanceM`でも
データセットによって`null`になる区間が互いに異なる」ケースが、町野地区限定運用時より高頻度で
発生することを前提とする(spec.md User Story 2)。既存の`spanGaps: false`によるグラフ描画
(001 T027)がこのケースを既にカバーしているため、`profileChart.ts`側の追加実装は不要と判断した。

## 対象範囲(Coverage Extent) — 新規概念

001には存在しなかった「共通クロップ範囲」を明示する。アプリのデータ型としては新規エンティティを
追加しない(地図の初期表示範囲・ズーム設定という運用パラメータとして`mapView.ts`の初期化処理に
反映するのみ)。

| 項目 | 値 |
|---|---|
| 空間参照系 | EPSG:6675 |
| 範囲(メートル) | x: -43500 〜 17500, y: 113000 〜 172500 |
| 相当するWGS84範囲(概算) | 東経 136.68°〜137.36°, 北緯 37.02°〜37.55° |
| 対象自治体 | 輪島市・珠洲市・能登町・穴水町(を包含するバウンディングボックス。行政界とは不一致) |

## エンティティ関係図

001から変更なし(参照: [001 data-model.md](../001-dem-cross-section/data-model.md)のエンティティ
関係図)。
