# Research: 隆起補正断面図

Technical Contextに`NEEDS CLARIFICATION`は残っていない。本フェーズでは、実装方式に関する
設計判断を記録する。

## R1: 補正後系列をどこで・どう保持するか

**Decision**: `CrossSectionProfile`本体(DEMサンプリング結果)は変更しない。表示直前に、
既存の`pre-earthquake`データセットの標高値へ隆起量を加算した「仮想データセット」を
その場で組み立て、`ProfileChart.render()`に渡す`datasets`/`points`に追加する形にする。

**Rationale**:
- FR-003(DEM再取得の禁止)を素直に満たせる。既存の`generateProfile`(DEMサンプリング)は
  隆起量に一切依存しないため、隆起量を何度変更してもDEMアクセスが発生しない。
- `ProfileChart`は「`DemDatasetConfig[]` + 各点の`elevationByDataset`」という既存の
  データ構造をそのまま描画できる設計になっている(001)。補正後系列を実データセットと
  同じ形(`id`, `label`, `color`を持つ`DemDatasetConfig`+`elevationByDataset`への
  エントリ追加)で作れば、凡例・色/太さカスタマイズ・PNGダウンロード・NoData時の線切れ
  (`spanGaps: false`)など既存機能をすべて無改造で再利用できる。

**Alternatives considered**:
- `CrossSectionProfile`生成時(`generateProfile`)に補正後系列を含めて返す方式:
  隆起量を変更するたびに断面図全体を再生成する必要があり、UIの操作性(FR-003, SC-001)を
  満たしにくい。却下。
- 独立した専用チャート系列型(`DemDatasetConfig`を使わない別データ構造)を新設する方式:
  `ProfileChart`・PNGダウンロード・系列スタイルUIをすべて二重実装する必要がありYAGNI違反。却下。

## R2: 補正対象データセットの特定方法

**Decision**: 補正対象は`demDatasets`(`src/config/datasets.ts`)の中から`id === "pre-earthquake"`
を固定的に参照する。

**Rationale**: spec.md Assumptionsで「補正対象は地震前データセットのみ」と明記済み。
運用者がデータセット構成を変更する可能性(002での実績)はあるが、現状「地震前」に相当する
データセットは常に1つであり、汎用的な「補正対象選択UI」を設けるのはYAGNI(原則IV)。
将来的に対象を切り替えたくなった場合は、`datasets.ts`側で対象データセットIDを定数化する
小さな変更で対応できる。

## R3: UI更新のタイミング(いつ補正後系列を再計算するか)

**Decision**: 隆起量入力欄の`input`イベントで即座に再計算・再描画する(適用ボタンは設けない)。
数値が無効(非数値・空欄)の間は直前の有効な描画状態を維持し、エラー表示は行わない
(spec.md Edge Cases: 無効値では既存表示に影響を与えない)。

**Rationale**: 補正計算はサンプル点数に対する単純な加算(O(n))であり、既存の
`showPointsToggleToggle`・系列色/太さ変更と同じ「入力するたびに即時反映」というUIパターンに
既に慣れている(`main.ts`の`applyStyle`と同様のパターン)。適用ボタンを追加すると
一貫性を損ない、SC-001(1秒未満での反映)の体感を悪化させるだけで利点がない。

**Alternatives considered**: 明示的な「適用」ボタン方式。デバウンス処理。いずれも
計算コストが軽いため不要と判断し、YAGNI(原則IV)により採用しない。
