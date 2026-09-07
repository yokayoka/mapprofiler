# Implementation Plan: 隆起補正断面図

**Branch**: `003-uplift-correction` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-uplift-correction/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

001-dem-cross-sectionで実装済みの断面図生成(`generateProfile`)・描画(`ProfileChart`)の
アーキテクチャは変更しない。本機能は、生成済みの`CrossSectionProfile`(既に取得済みの
地震前DEM標高データを含む)に対して、ユーザーが入力した隆起量(m)を加算した「隆起補正後」の
仮想データセット系列を導出し、既存の複数系列描画の仕組みにそのまま乗せて追加表示する、
表示層中心の軽量な拡張である。DEMの再サンプリング(`sampleElevationsAlongLine`の再呼出し)は
発生させない。

## Technical Context

**Language/Version**: TypeScript 5.x(変更なし。001を踏襲)

**Primary Dependencies**: Leaflet, geotiff, proj4, chart.js, html2canvas(変更なし。新規依存は追加しない)

**Storage**: N/A(変更なし)

**Testing**: vitest。純粋関数(隆起補正の値計算)としてユニットテストを追加する

**Target Platform**: デスクトップ向けモダンWebブラウザ、GitHub Pages(変更なし)

**Project Type**: 単一のフロントエンドWebアプリ(変更なし)

**Performance Goals**: 隆起量の入力変更からグラフ再描画までを体感的に瞬時(SC-001: 1秒未満)に
行う。DEM再取得を伴わない純粋なオフセット加算(O(サンプル点数))のため、既存のDEM読込性能
(001 research.md R2)には影響しない。

**Constraints**: 001の制約(サーバーレス、CORS必須等)をすべて継承。新規のDEM/COGデータや
外部サービス連携は追加しない。

**Scale/Scope**: UI変更(隆起量入力欄・補正系列トグル・スタイル変更行を1件追加)と、
`CrossSectionProfile`から補正後系列を導出する純粋関数の追加が中心。対象データセットは
既存の`pre-earthquake`固定(spec.md Assumptions)。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 静的サイト・サーバーレス | PASS | 補正計算はブラウザ内の純粋関数(加算のみ)で完結。サーバー・API等は追加しない |
| II. 軽量性・パフォーマンス優先 | PASS | 新規依存ライブラリなし。DEM再取得を発生させない設計そのものが本機能の核心要件(FR-003)であり、原則IIに直接合致する |
| III. 地理空間データの正確性 | PASS | 距離-標高のデータ構造・NoData(null)の扱いは既存ロジックをそのまま踏襲し、補正はオフセット加算のみ。捏造値を生成しない(FR-004) |
| IV. シンプルさ優先(YAGNI) | PASS | 空間的に変動する隆起モデルや自動隆起量推定など、要求されていない機能は実装しない(spec.md Assumptionsで明示的に対象外) |
| V. コアロジックのテスト必須 | PASS | 隆起補正の値計算ロジック(オフセット加算・NoData伝播)は新規のコアロジックであり、ユニットテストを追加する(`tests/unit/upliftCorrection.test.ts`) |

**Post-Phase 1 再評価**: data-model.md 作成後も上記の判定に変更なし。違反なし
(Complexity Trackingへの記載は不要)。

## Project Structure

### Documentation (this feature)

```text
specs/003-uplift-correction/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── uplift-correction-api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

**Structure Decision**: 001/002と同一の単一フロントエンドプロジェクト構成を継続する。
新規ディレクトリ・新規モジュールファイルは最小限(補正ロジック用に1ファイル追加)とする。

```text
mapprofiler/
├── src/
│   ├── geo/
│   │   └── upliftCorrection.ts   # 新規: 隆起補正の値計算(純粋関数)
│   ├── types.ts                   # 変更: UpliftCorrection関連の型を追加
│   ├── profile/
│   │   └── profileChart.ts        # 変更: 補正後系列を仮想データセットとして描画対象に含める
│   ├── i18n/
│   │   └── translations.ts        # 変更: 隆起補正UIの文言(ja/en)を追加
│   └── main.ts                     # 変更: 隆起量入力欄・表示トグル・スタイル行のUI配線
└── tests/
    └── unit/
        └── upliftCorrection.test.ts  # 新規
```

## Complexity Tracking

*Constitution Check に違反なし。本セクションへの記載は不要。*
