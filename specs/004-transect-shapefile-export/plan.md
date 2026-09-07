# Implementation Plan: 測線Shapefileダウンロード

**Branch**: `004-transect-shapefile-export` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-transect-shapefile-export/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

既存の`src/map/transectExport.ts`(KMLダウンロード、001)と同じ入力(測線の始点・終点の緯度経度)から、ESRI Shapefile形式(.shp/.shx/.dbf/.prj)をzipにまとめて生成する機能を追加する。バイナリフォーマット(Shapefile本体・DBF属性テーブル・ZIPコンテナ)は、新規の外部ライブラリを追加せず、対象データが「1本の2点ポリライン+最小限の属性」という極めて単純な構造であることを活かして自前実装する(research.md R1参照)。既存のアプリケーションアーキテクチャ(単一フロントエンド、サーバーレス)・UIパターン(ボタン+ダウンロード)は変更しない。

## Technical Context

**Language/Version**: TypeScript 5.x(変更なし)

**Primary Dependencies**: 新規の外部ライブラリは追加しない(research.md R1)。既存のLeaflet, geotiff, proj4, chart.js, html2canvasは変更なし

**Storage**: N/A(変更なし)

**Testing**: vitest。バイナリフォーマット(Shapefile/DBF/ZIP)はコアロジックとして、既知のバイト列・チェックサム値によるユニットテストを追加する(憲法 原則V)

**Target Platform**: デスクトップ向けモダンWebブラウザ、GitHub Pages(変更なし)

**Project Type**: 単一のフロントエンドWebアプリ(変更なし)

**Performance Goals**: 測線1本(頂点2点)分のデータ生成であり、生成物は数百バイト〜数KB程度。体感的に瞬時(クリックから1秒未満)にダウンロードが開始されること。

**Constraints**: 001の制約(サーバーレス、CORS等)を継承。新規依存ライブラリの追加は行わない(憲法 原則II「依存ライブラリは必要最小限に絞る」、research.md R1)。

**Scale/Scope**: UI変更(既存のKMLダウンロードボタンの隣にボタン1つを追加)と、Shapefile/DBF/ZIPの3つのバイナリフォーマットを生成する新規モジュール1つが中心。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 静的サイト・サーバーレス | PASS | Shapefile/ZIP生成はブラウザ内のバイト列組み立て処理のみで完結。サーバー等は追加しない |
| II. 軽量性・パフォーマンス優先 | PASS | 新規外部ライブラリを追加しない(research.md R1)。生成物も数KB程度でバンドルサイズ・実行時性能への影響は無視できる |
| III. 地理空間データの正確性 | PASS | 座標はKML出力と同じ入力(測線の緯度経度)をそのままWGS84として出力し、変換処理を挟まない。バイナリレイアウトはESRI Shapefile白書・dBase III仕様に厳密に従い、ユニットテストでバイト単位に検証する |
| IV. シンプルさ優先(YAGNI) | PASS | 対応ジオメトリはポリライン1本のみ、属性は最小限に限定する(spec.md Assumptions)。汎用的なShapefile/GISエクスポートフレームワークは構築しない |
| V. コアロジックのテスト必須 | PASS | 新規のバイナリ生成ロジック(CRC32・Shapefile・DBF・ZIP)はコアロジックであり、ユニットテストを必須とする(`tests/unit/shapefileExport.test.ts`) |

**Post-Phase 1 再評価**: data-model.md 作成後も上記の判定に変更なし。違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/004-transect-shapefile-export/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── shapefile-export-api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

**Structure Decision**: 001〜003と同一の単一フロントエンドプロジェクト構成を継続する。

```text
mapprofiler/
├── src/
│   └── map/
│       └── shapefileExport.ts   # 新規: 測線→Shapefile一式(.shp/.shx/.dbf/.prj)をZIPにまとめて
│                                  # 生成する(CRC32・ZIP格納も同ファイル内のプライベート関数で実装)
└── tests/
    └── unit/
        └── shapefileExport.test.ts  # 新規
```

## Complexity Tracking

*Constitution Check に違反なし。本セクションへの記載は不要。*
