# Implementation Plan: 能登半島DEM断面図WebGIS(DEM Cross-Section Viewer)

**Branch**: `001-dem-cross-section` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-dem-cross-section/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

ユーザーが地図上で指定した測線について、複数時期のDEM(COG形式、EPSG:6675、0.5m解像度)から
距離-標高の断面図を生成し、断面図・測線オーバーレイ地図をそれぞれPNGでダウンロードできる、
GitHub Pages上で動作する静的Webアプリ。Leafletで地図、geotiff.jsでCOG読込(HTTP Range Request)、
proj4jsで座標変換、Chart.jsで断面図描画を行い、サーバーサイド処理を一切持たない
(Vite + TypeScript、フレームワークなし)。

## Technical Context

**Language/Version**: TypeScript 5.x(Viteでビルド、対象は主要モダンブラウザ最新版 = ES2020+相当)

**Primary Dependencies**: Leaflet(地図表示・測線オーバーレイ・縮尺コントロール)、geotiff(COG読込、
HTTP Range Request対応)、proj4(WGS84 ⇔ EPSG:6675座標変換)、chart.js(断面図描画、系列トグル、
canvasベースPNG化)、html2canvas(地図PNGエクスポート。DOMベースの縮尺コントロールも確実に含められる
ため`leaflet-image`から変更、research.md R5参照。ダウンロード操作時のみ動的importで読込)

**Storage**: N/A — DEM COGファイル・背景タイルはいずれも外部の静的ファイル/配信サービスをURL参照
するのみで、本アプリ自身はデータベースやファイルストレージを持たない

**Testing**: vitest(コア地理空間ロジックのユニットテスト。憲法 原則Vにより必須)

**Target Platform**: デスクトップ向けモダンWebブラウザ(Chrome/Edge/Firefox最新版)。GitHub Pages
での静的サイトホスティング

**Project Type**: 単一のフロントエンドWebアプリ(バックエンドなし、SPA1画面構成)

**Performance Goals**: 測線・サンプリング間隔指定から10秒以内に断面図を表示(SC-001)。COGは
オーバービュー/必要範囲のみをRange Requestで取得し、ファイル全体のダウンロードを避ける(原則II)

**Constraints**: サーバーサイド実行環境を一切使用しない(原則I)。DEMはEPSG:6675・0.5m解像度の
COG形式を前提とする。タイル配信アドレスはビルド前に運用者が設定ファイルへ固定し、エンドユーザー
向け入力UIは提供しない(FR-015)。地図PNGエクスポートを機能させるには、タイル・COG双方の配信元が
CORSを許可している必要がある(research.md R2, R5)

**Scale/Scope**: 単一機能・単一画面のツール。DEMデータセットは標準3時期(地震前/地震後/豪雨後)
を想定するが可変。同時アクセス数への特別な性能要件なし(静的配信のためホスティング基盤に依存)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 静的サイト・サーバーレス | PASS | Vite製の静的ビルド成果物(`dist/`)をGitHub Pagesで配信。座標変換・DEMサンプリング・断面図生成・PNG出力すべてブラウザ内で完結(research.md R2, R5) |
| II. 軽量性・パフォーマンス優先 | PASS | geotiff.jsのRange Requestで部分読込。フレームワークなしのVanilla TSで依存を最小化 |
| III. 地理空間データの正確性 | PASS | proj4jsでEPSG:6675(Zone VII〈7系〉)変換を実装。定義文字列はT008実装時にepsg.io等の一次情報と照合済み(research.md R3) |
| IV. シンプルさ優先(YAGNI) | PASS | 認証・マルチユーザー・サーバー永続化は実装しない。フレームワークも導入しない |
| V. コアロジックのテスト必須 | PASS(計画済み) | `contracts/core-geo-api.md` に定義した座標変換・サンプリング・DEM取得・断面図生成の各関数をvitestでユニットテストする方針を確定 |

**Post-Phase 1 再評価**: data-model.md / contracts/ 作成後も上記の判定に変更なし。違反なし
(Complexity Trackingへの記載は不要)。

## Project Structure

### Documentation (this feature)

```text
specs/001-dem-cross-section/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── core-geo-api.md
│   └── config-schema.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

**Structure Decision**: Option 1(単一プロジェクト)を採用。バックエンドを持たないフロントエンド
専用の静的Webアプリのため、`backend/`・`frontend/`分割やモバイル用構成は不要。

```text
mapprofiler/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                     # エントリーポイント、UI配線
│   ├── config/
│   │   └── datasets.ts             # TileLayerConfig / DemDatasetConfig[](contracts/config-schema.md)
│   ├── map/
│   │   ├── mapView.ts              # Leaflet初期化、背景タイル、縮尺コントロール(US5, FR-001, FR-010)
│   │   ├── transectDraw.ts         # 始点/終点クリック取得、測線オーバーレイ(US1, FR-002)
│   │   └── mapExport.ts            # 地図PNGエクスポート(US4, FR-011)
│   ├── geo/
│   │   ├── coordinateTransform.ts  # wgs84ToEpsg6675(contracts/core-geo-api.md)
│   │   ├── demSource.ts            # sampleElevation, COG読込(geotiff.js)
│   │   └── profileSampler.ts       # buildSamplePoints, generateProfile
│   ├── profile/
│   │   ├── profileChart.ts         # Chart.jsによる断面図描画・系列トグル(US2, FR-007, FR-008, FR-014)
│   │   └── profileExport.ts        # 断面図PNGエクスポート(US3, FR-009)
│   └── types.ts                    # TransectLine / DemDatasetConfig / ProfilePoint / CrossSectionProfile 型定義
└── tests/
    └── unit/
        ├── coordinateTransform.test.ts
        ├── profileSampler.test.ts
        ├── demSource.test.ts
        └── profileGenerator.test.ts
```

## Complexity Tracking

*Constitution Check に違反なし。本セクションへの記載は不要。*
