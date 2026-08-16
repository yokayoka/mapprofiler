# Implementation Plan: 能登北部全域展開・1mDEM移行

**Branch**: `002-expand-northern-noto` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-expand-northern-noto/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

001-dem-cross-sectionで実装済みの断面図生成機能(測線指定・複数時期比較・PNGダウンロード)の
アーキテクチャは変更しない。本機能は、対象とするDEMデータの**範囲**(町野地区→能登北部4市町
全域)と**解像度**(0.5m→1m、著作権保護のため)を切り替える、データ中心の拡張である。
アプリケーションコードの変更は `src/config/datasets.ts` のデータセット定義差し替えが中心であり、
技術的な作業の大部分はDEM前処理パイプライン(GDAL)とホスティングである。

## Technical Context

**Language/Version**: TypeScript 5.x(変更なし。001を踏襲)

**Primary Dependencies**: Leaflet, geotiff, proj4, chart.js, html2canvas(変更なし。001を踏襲)

**Storage**: N/A(001を踏襲)。DEM COGファイルは外部静的ストレージ(GCS)をURL参照

**Testing**: vitest(既存の001テスト群がそのまま有効。resolutionM変更に伴うテストデータ更新は
不要 — 既存テストはモックデータを用いており実データ解像度に依存しない)

**Target Platform**: デスクトップ向けモダンWebブラウザ、GitHub Pages(変更なし)

**Project Type**: 単一のフロントエンドWebアプリ(変更なし)

**Performance Goals**: 001 SC-001(10秒以内表示)を能登北部全域スケールでも維持する。COGの
タイル単位読込方式(research.md R2、`sampleElevationsAlongLine`)は読込量が「測線が通過する
タイル数」に比例する設計のため、対象範囲・ファイルサイズの拡大がそのまま性能劣化には直結
しない。実機検証(research.md R10)で、町野地区限定版よりはるかに長い約30kmの測線でも
約6秒で表示できることを確認済み

**Constraints**: 001の制約(サーバーレス、CORS必須等)をすべて継承。加えて、DEM原本の著作権
保護のため配信解像度は1mを超えてはならない(constitution.md 改定箇所)

**Scale/Scope**: 対象範囲がEPSG:6675で約61km×59.5km(能登北部4市町を包含するbbox)に拡大。
COGファイルサイズは1データセットあたり概ね1〜3GB程度(本セッションでのGDAL実行結果、research.md
R9参照)。データセット数(3時期)・UIコンポーネント数は001から変更なし

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 静的サイト・サーバーレス | PASS | DEM前処理(GDAL)はビルド前のデータ準備工程であり、アプリ本体は001同様ブラウザ内で完結。サーバー実行環境は追加しない |
| II. 軽量性・パフォーマンス優先 | PASS | COGのタイル単位読込(research.md R2)は範囲拡大に対してスケールする設計。実データでの再検証済み(research.md R10、約30km測線で約6秒表示) |
| III. 地理空間データの正確性 | PASS | 座標変換ロジックは無変更。データセットごとに実測範囲が異なる点は、既存のNoData/範囲外欠損の仕組み(FR-012相当)でそのまま正しく扱える |
| IV. シンプルさ優先(YAGNI) | PASS | コード変更を最小限(datasets.ts差し替え)に留める。DEM前処理を汎用パイプライン化・自動化するような過剰な仕組みは導入しない |
| V. コアロジックのテスト必須 | PASS | 座標変換・サンプリング・断面図生成ロジックは無変更のため既存テストがそのまま有効。新規ロジック追加はないためテスト追加は不要 |

**Post-Phase 1 再評価**: data-model.md 作成後も上記の判定に変更なし。違反なし
(Complexity Trackingへの記載は不要)。

## Project Structure

### Documentation (this feature)

```text
specs/002-expand-northern-noto/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command、001からの差分のみ)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

**Structure Decision**: 001と同一の単一フロントエンドプロジェクト構成を継続する。新規ディレクトリ・
新規モジュールは追加しない。

```text
mapprofiler/
├── src/
│   └── config/
│       └── datasets.ts   # 変更対象: demDatasets[] の cogUrl/resolutionM を新COGへ差し替え、
│                          # tileLayers[] の初期表示範囲を能登北部全域に合わせて見直す(要確認)
├── dem/
│   └── convert_to_cog.sh # 変更対象: 能登北部全域・1m版の前処理コマンド(research.md R9)を反映
│                          # (町野地区版は既存のまま残置し、全域版は別スクリプトとして追加する)
└── (その他は001から無変更)
```

DEM COGファイル本体(1データセットあたり1〜3GB)は、001と同様にリポジトリにコミットせず、
外部静的ストレージ(GCS、既存の`mapprofiler-noto-dem`バケット相当)にアップロードして
`cogUrl`で参照する(research.md R2の方針を踏襲)。

## Complexity Tracking

*Constitution Check に違反なし。本セクションへの記載は不要。*
