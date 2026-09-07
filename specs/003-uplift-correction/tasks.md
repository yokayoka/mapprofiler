# Tasks: 隆起補正断面図

**Input**: Design documents from `/specs/003-uplift-correction/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md(すべて存在)

**Tests**: 憲法(`.specify/memory/constitution.md`)原則V「コアロジックのテスト必須」により、
隆起補正の値計算ロジック(`applyUpliftCorrection`)のユニットテストを含める。UI部分のテストは任意。

**Organization**: タスクはユーザーストーリー(spec.mdのP1〜P3)ごとにグループ化する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可能(別ファイル、未完了タスクへの依存なし)
- **[Story]**: 対応するユーザーストーリー(US1〜US3)
- ファイルパスは `plan.md` のProject Structureに準拠

## Path Conventions

001/002と同一の単一プロジェクト。`src/`, `tests/` はリポジトリルート直下。

---

## Phase 1: Setup

**Purpose**: 本機能固有のセットアップ(新規依存なし、既存プロジェクト構成をそのまま使用)

- [X] T001 既存の型定義(`src/types.ts`)・データセット設定(`src/config/datasets.ts`)・
  断面図生成/描画(`src/geo/profileSampler.ts`, `src/profile/profileChart.ts`)を確認し、
  `demDatasets`に`id === "pre-earthquake"`のデータセットが存在することを確認する(前提確認のみ、
  コード変更なし)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存する型定義

**⚠️ CRITICAL**: このフェーズが完了するまでユーザーストーリーの実装を開始しない

- [X] T002 `data-model.md` に基づき、`UpliftCorrectionSettings`型(`baseDatasetId`, `upliftM`,
  `enabled`)を `src/types.ts` に追加する
- [X] T003 [P] 隆起補正UIの文言(隆起量入力ラベル、補正系列トグルラベル、補正系列のラベル書式
  等)の翻訳キーを `TranslationKey` に追加し、`src/i18n/translations.ts` の `ja`/`en` 両方に
  値を追加する

**Checkpoint**: 型定義・翻訳キーが揃い、ユーザーストーリーの実装に着手できる

---

## Phase 3: User Story 1 - 隆起量を入力して補正後の地震前地形を重ね描画する (Priority: P1) 🎯 MVP

**Goal**: 断面図作成後に隆起量(m)を入力すると、地震前系列に隆起量を加算した「隆起補正後」系列が
DEM再取得なしで断面図に追加表示される

**Independent Test**: 断面図を作成済みの状態で隆起量欄に数値を入力し、地震前系列を平行移動した
補正後系列が追加表示されること、隆起量を変更してもDEM再取得が発生せず即座に更新されることを確認する

### Tests for User Story 1 ⚠️

> これらのテストを先に作成し、実装前に失敗することを確認する

- [X] T004 [P] [US1] `contracts/uplift-correction-api.md` に基づき、`applyUpliftCorrection()`の
  ユニットテストを `tests/unit/upliftCorrection.test.ts` に作成する(正の隆起量・負の隆起量・
  隆起量0・ベースデータセットの値がNoData(null)の点でも補正後がnullのままであること・
  `enabled: false`の場合は`profile`が変更されずそのまま返ること・`upliftM`が`NaN`/`Infinity`の
  場合も`profile`がそのまま返ること・元の`profile`を破壊的に変更しないこと)

### Implementation for User Story 1

- [X] T005 [US1] `contracts/uplift-correction-api.md` に基づき、`applyUpliftCorrection()` を
  `src/geo/upliftCorrection.ts` に実装する(T004に対応)。仮想データセットの`id`は
  `` `${baseDatasetId}-uplift-corrected` ``、`label`は隆起量を付記した書式(ja/en、T003の
  翻訳キーを使用)とする
- [X] T006 [US1] 隆起量の入力欄(`<input type="number">`)と、内部状態としての
  `UpliftCorrectionSettings`(既定値: `upliftM=0`, `enabled=false`)を `src/main.ts` に追加する
- [X] T007 [US1] 隆起量入力欄の`input`イベントで、`Number.isFinite`による検証を行い
  `UpliftCorrectionSettings`を更新した上で、直近の`CrossSectionProfile`に対して
  `applyUpliftCorrection()`を適用した結果を`profileChart.render()`に渡す処理を `src/main.ts` に
  実装する(research.md R3: DEM再取得なし・即時反映)。無効な値の間は`enabled=false`として扱い、
  既存の3系列表示に影響を与えない(FR-010)
- [X] T008 [US1] 断面図生成(`generateProfile`)完了時にも、その時点の`UpliftCorrectionSettings`を
  適用した状態で再描画されるよう `src/main.ts` の`handleGenerateProfile()`を更新する(測線を
  引き直しても直前の隆起量入力値を保持し続けられるようにする、spec.md Edge Cases)

**Checkpoint**: User Story 1が単独で完全に動作し、テスト可能な状態(MVP)

---

## Phase 4: User Story 2 - 補正後系列の表示・非表示を切り替える (Priority: P2)

**Goal**: 補正後系列の表示/非表示を、他の3系列の表示状態とは独立に切り替えられる

**Independent Test**: 補正後系列が表示された状態で表示切替コントロールを操作し、系列が非表示に
なること、再度操作すると表示に戻ること、他の3系列の表示状態に影響しないことを確認する

### Implementation for User Story 2

- [X] T009 [US2] 補正後系列の表示/非表示を切り替えるチェックボックス(隆起量入力欄と対になる
  `enabled`トグル)を `src/main.ts` に追加する。トグルOFFの間は`applyUpliftCorrection()`を
  呼び出さず(または`enabled: false`を渡し)、既存3系列のみの`profile`を`profileChart.render()`に
  渡す(T007に依存)

**Checkpoint**: User Story 1・2がともに独立して動作する

---

## Phase 5: User Story 3 - 補正後系列の線の色・太さをカスタマイズし、PNG出力に含める (Priority: P3)

**Goal**: 補正後系列の色・太さを既存のデータセットスタイルUIと同様の方法で変更でき、断面図PNG
ダウンロードにも補正後系列が含まれる

**Independent Test**: 補正後系列表示中に色・太さを変更して見た目が変わることを確認し、断面図PNGを
ダウンロードして補正後系列が画像内に描画されていることを確認する

### Implementation for User Story 3

- [X] T010 [US3] 補正後系列専用の色・線幅入力行(既存の`.dataset-style-row`と同様のUI、
  デフォルト色は既存3系列と重複しない色)を `src/main.ts` に追加し、
  `profileChart.setDatasetStyle()`(補正後系列の`id`を指定)に配線する
- [X] T011 [US3] 断面図PNGダウンロード(`src/profile/profileExport.ts`)が、`ProfileChart`の
  canvasをそのまま書き出す既存実装のままで補正後系列も含めて出力されることを確認する
  (実装変更が不要であればテストのみ、必要であれば修正する)

**Checkpoint**: 全ユーザーストーリーが独立して機能する

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 複数ストーリーにまたがる仕上げ作業

- [ ] T012 [P] `quickstart.md` のシナリオ1〜5を実ブラウザで手動検証し、結果を記録する
  (憲法: PNG機能は実ブラウザでの目視確認が必須。本セッションではブラウザ拡張機能が未接続のため
  自動検証ができず、未実施。運用者による手動確認が必要)
- [X] T013 [P] `README.md` に隆起補正機能の使い方(運用者向け: 補正対象データセットの前提、
  ユーザー向け: 隆起量入力欄の操作方法)を追記する

---

## Phase 7: 実機確認フィードバックに基づく調整(追加要望)

**Purpose**: 実機での動作確認結果を受け、チェックボックスの意味とグラフ内の補正明示を見直す
(spec.md User Story 2 / FR-005 / FR-006 を更新)

- [X] T014 [US1] 隆起量に0以外の有効な数値が入力された場合に自動的に補正後系列を表示するよう
  `src/main.ts` の`updateUpliftSettingsFromInputs()`を変更する(`enabled`をチェックボックスではなく
  入力値から判定)。あわせて`ProfileChart.setTitle()`(`src/profile/profileChart.ts`に新設)で
  グラフタイトルに適用中の隆起量(`upliftAnnotationLabel`、`formatSignedMeters()`)を表示し、
  補正済みであることを明示する(FR-005)
- [X] T015 [US2] チェックボックスの意味を「補正後系列の表示/非表示」から「隆起補正前(元)の
  地震前系列の表示/非表示」に変更する(`src/main.ts`のDOM ID・翻訳キーを
  `upliftShowOriginalToggleLabel`に変更、`renderProfileWithUplift()`で
  `visibleDatasetIds`から`baseDatasetId`を除外する処理を実装)。補正が適用されていない間は
  この切替が地震前系列の表示状態に影響しないようにする(FR-006)

**Checkpoint**: 隆起量入力だけで補正後系列が自動表示され、グラフ内に隆起量が明示され、
チェックボックスは元の地震前系列の表示切替として機能する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし、即着手可能
- **Foundational (Phase 2)**: Setup完了後。全ユーザーストーリーをブロックする
- **User Stories (Phase 3-5)**: すべてFoundational完了後に着手可能
  - 優先度順(P1→P2→P3)に進めるのが自然。US2・US3はUS1のUI配線(T006, T007)の上に追加するため、
    実質的にUS1完了後の着手が現実的
- **Polish (Phase 6)**: 実装対象のユーザーストーリーが完了した後

### User Story Dependencies

- **US1 (P1)**: Foundational完了後に着手可能。他ストーリーへの依存なし(MVP)
- **US2 (P2)**: US1の隆起量入力UI・状態管理(T006, T007)に依存
- **US3 (P3)**: US1の補正後系列描画(T005, T007)に依存

### Within Each User Story

- テストを実装前に作成し、失敗することを確認する(US1のみコアロジックにテストを課す、原則V)
- コアロジック(`applyUpliftCorrection`)→ UI配線 → 表示切替/スタイル拡張 の順
- 各ストーリー完了後、次の優先度へ進む

### Parallel Opportunities

- Foundationalの[P]タスク(T003)は並行実行可能
- Polishの[P]タスク(T012, T013)は並行実行可能

---

## Parallel Example: User Story 1

```bash
# User Story 1のテストは1本(T004)のみのため並行実行の対象は特になし
Task: "applyUpliftCorrection() のユニットテストを tests/unit/upliftCorrection.test.ts に作成"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup を完了する
2. Phase 2: Foundational を完了する(型定義・翻訳キー)
3. Phase 3: User Story 1 を完了する
4. **一旦停止して検証**: User Story 1 を独立してテストする(quickstart.mdシナリオ1・2・3)
5. 準備が整えばデプロイ/デモする

### Incremental Delivery

1. Setup + Foundational 完了 → 基盤が整う
2. User Story 1(隆起補正系列の追加表示)追加 → 独立テスト → デプロイ/デモ(MVP!)
3. User Story 2(表示/非表示トグル)追加 → 独立テスト → デプロイ/デモ
4. User Story 3(スタイル変更・PNG出力)追加 → 独立テスト → デプロイ/デモ
5. Polish フェーズで仕上げ

---

## Notes

- `[P]` タスク = 別ファイル、依存なし
- `[Story]` ラベルはユーザーストーリーとのトレーサビリティのために付与
- 各ユーザーストーリーは独立して完了・テスト可能であること
- 実装前にテストが失敗することを確認する(コアロジックのみ、憲法 原則V)
- 論理的なまとまりごとにコミットする
- 各チェックポイントでストーリー単独の動作を検証してから次に進む
