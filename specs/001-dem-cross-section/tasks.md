---

description: "Task list template for feature implementation"
---

# Tasks: 能登半島DEM断面図WebGIS(DEM Cross-Section Viewer)

**Input**: Design documents from `/specs/001-dem-cross-section/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md(すべて存在)

**Tests**: 憲法(`.specify/memory/constitution.md`)原則V「コアロジックのテスト必須」により、
座標変換・DEMサンプリング・断面図生成ロジックのユニットテストを含める。UI部分のテストは任意のため含めない。

**Organization**: タスクはユーザーストーリー(spec.mdのP1〜P4)ごとにグループ化し、各ストーリーを
独立して実装・検証できるようにする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可能(別ファイル、未完了タスクへの依存なし)
- **[Story]**: 対応するユーザーストーリー(US1〜US5)
- ファイルパスは `plan.md` のProject Structureに準拠

## Path Conventions

単一プロジェクト(`plan.md`のOption 1)。`src/`, `tests/` はリポジトリルート直下。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: プロジェクトの初期化と基本構成

- [X] T001 Vite + TypeScriptプロジェクトを初期化する(`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`をリポジトリルートに作成)
- [X] T002 [P] 依存パッケージをインストールする: `leaflet`, `geotiff`, `proj4`, `chart.js`, `leaflet-image`(または`html2canvas`)、開発依存として `typescript`, `vite`, `vitest`, `@types/leaflet`
- [X] T003 [P] `vitest` を設定する(`vite.config.ts` の `test` ブロック、またはテスト用スクリプトを`package.json`に追加)
- [X] T004 [P] Lint/Format設定(ESLint + Prettier等、最小構成)を追加する
- [X] T005 `plan.md` のProject Structureに沿ってディレクトリを作成する(`src/config/`, `src/map/`, `src/geo/`, `src/profile/`, `tests/unit/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存する基盤(型定義・座標変換・地図初期表示)

**⚠️ CRITICAL**: このフェーズが完了するまでユーザーストーリーの実装を開始しない

- [X] T006 `data-model.md` に基づき、`TransectLine` / `DemDatasetConfig` / `ProfilePoint` / `CrossSectionProfile` / `TileLayerConfig` の型を `src/types.ts` に定義する
- [X] T007 [P] `contracts/config-schema.md` に基づき、`TileLayerConfig` と `demDatasets` の設定スケルトンを `src/config/datasets.ts` に作成する(サンプル値・コメント付き)
- [X] T008 `contracts/core-geo-api.md` に基づき、`proj4` に EPSG:6675(JGD2011 / 平面直角座標系7系)の定義を登録し `wgs84ToEpsg6675()` を `src/geo/coordinateTransform.ts` に実装する(research.md R3の定義文字列を一次情報と照合し確定。当初「13系」と誤記していたが「7系」に訂正)
- [X] T009 [P] `wgs84ToEpsg6675()` のユニットテストを `tests/unit/coordinateTransform.test.ts` に作成する(投影原点=(0,0)の既知値検証、往復整合性、範囲外エラー)
- [X] T010 Leaflet地図を初期化する: `src/config/datasets.ts` の `tileLayerConfig` から背景タイルを読み込み、`L.control.scale()`(縮尺)を追加する処理を `src/map/mapView.ts` に実装する(FR-001, FR-010の土台)。タイル読込失敗時のフォールバック表示(T033相当)もあわせて実装済み
- [X] T011 `index.html` と `src/main.ts` を作成し、`mapView` をページにマウントする

**Checkpoint**: 設定済みタイルで地図が表示され、座標変換ロジックの土台が完成している

---

## Phase 3: User Story 1 - 任意の測線でDEM断面図を作成する (Priority: P1) 🎯 MVP

**Goal**: 地図上で2点をクリックして測線を指定し、サンプリング間隔を入力すると、距離-標高の断面図が表示される(単一DEMデータセットで成立)

**Independent Test**: 地図上で2点をクリック→サンプリング間隔入力→断面図生成を実行し、距離-標高グラフが表示されることを確認する

### Tests for User Story 1 ⚠️

> これらのテストを先に作成し、実装前に失敗することを確認する

- [X] T012 [P] [US1] `buildSamplePoints()` のユニットテストを `tests/unit/profileSampler.test.ts` に作成する(端点を含むこと、距離ゼロでの例外、サンプリング間隔がDEM解像度0.5m未満の場合のサンプル数)
- [X] T013 [P] [US1] `sampleElevation()` のユニットテストを `tests/unit/demSource.test.ts` に作成する(データ範囲内の値取得、範囲外/NoDataで`null`を返すケース、およびサンプリング間隔がDEM解像度0.5m未満の場合に採用した補間方式〈最近傍法またはバイリニア法、T016で選択〉の結果検証。小さなテスト用COGフィクスチャまたはgeotiff.jsのモックを使用)
- [X] T014 [P] [US1] `generateProfile()`(単一データセット)のユニットテストを `tests/unit/profileGenerator.test.ts` に作成する

### Implementation for User Story 1

- [X] T015 [US1] `buildSamplePoints()` を `src/geo/profileSampler.ts` に実装する(T012に対応)。当初 `d += interval` の累積加算で実装したところ浮動小数点誤差でサンプル数がずれるテスト失敗を確認したため、添字 `i × interval` 方式に修正
- [X] T016 [US1] `sampleElevation()` を `src/geo/demSource.ts` に実装する(`geotiff`の`fromUrl()`によるHTTP Range Request読込、T013に対応)。補間方式は**最近傍法**を採用(DEMが0.5m解像度と高精細なため実装の単純さ・速度を優先。コードコメントとcontracts/core-geo-api.mdに明記済み)。COGメタデータはURLごとにキャッシュしT016内で使い回す
- [X] T017 [US1] `generateProfile()` を `src/geo/profileSampler.ts` に実装し、`buildSamplePoints` と `sampleElevation` を組み合わせる(T014に対応、T015・T016に依存)
- [X] T018 [US1] 測線描画を `src/map/transectDraw.ts` に実装する(地図クリックで始点・終点を取得、地図上に線をオーバーレイ、`coordinateTransform`でEPSG:6675座標を算出)
- [X] T019 [US1] サンプリング間隔の入力フォームと断面図生成の実行UIを `src/main.ts` に追加する
- [X] T020 [US1] 断面図描画を `src/profile/profileChart.ts` に実装する(Chart.jsの折れ線グラフ、距離/標高の軸ラベル)。データセットの色分け・凡例トグル・欠損区間の途切れ表示も同時に実装したため、T025〜T027は本タスクの成果を再利用する
- [X] T021 [US1] `src/main.ts` で測線+サンプリング間隔 → `generateProfile()` → `profileChart` 描画のエンドツーエンドの流れを配線する
- [X] T022 [US1] 始点=終点(距離ゼロ)エラー表示、DEM範囲外区間の欠損表示(Edge Cases)を `src/main.ts` / `src/map/transectDraw.ts` に実装する

**Checkpoint**: User Story 1が単独で完全に動作し、テスト可能な状態

---

## Phase 4: User Story 2 - 複数時期のDEMを重ねて地形変化を比較する (Priority: P2)

**Goal**: 同一測線について、複数時期のDEM断面線を色分けして重ね、凡例で個別に表示/非表示を切り替えられる

**Independent Test**: 複数時期のDEMデータセットを設定した状態で断面図を作成し、色分けされた複数の線と凡例が表示され、凡例クリックで個別の系列を非表示にできることを確認する

### Tests for User Story 2 ⚠️

- [X] T023 [P] [US2] `generateProfile()` に複数データセット(一部区間でNoData混在を含む)を渡すケースのユニットテストを `tests/unit/profileGenerator.test.ts` に追加する

### Implementation for User Story 2

- [X] T024 [US2] `demDatasets[]` をループして各データセットの標高を `elevationByDataset` に格納するよう `src/geo/profileSampler.ts` / `src/geo/demSource.ts` を拡張する(T023, T017に依存)。T017実装時に `Promise.all(datasets.map(...))` の形で先行実装済みであることをT023のテストで確認
- [X] T025 [US2] `DemDatasetConfig.color` を用いてデータセットごとにChart.jsの系列と凡例を描画するよう `src/profile/profileChart.ts` を拡張する(T020, T024に依存)。T020実装時に先行実装済み
- [X] T026 [US2] 凡例クリックで系列の表示/非表示を切り替える処理を `src/profile/profileChart.ts` に実装する(T025に依存)。Chart.js既定の凡例クリック挙動(`hidden`トグル)を利用し、T020実装時に先行して有効化済み
- [X] T027 [US2] 各データセットの欠損区間(`null`)をグラフ上で線の途切れとして表現する処理を `src/profile/profileChart.ts` に実装する(T025に依存)。`spanGaps: false` によりT020実装時に先行実装済み

**Checkpoint**: User Story 1・2がともに独立して動作する

---

## Phase 5: User Story 3 - 断面図をPNGでダウンロードする (Priority: P2)

**Goal**: 表示中の断面図をPNGファイルとしてダウンロードできる

**Independent Test**: 断面図表示後にダウンロード操作を行い、表示内容と一致するPNGファイルが保存されることを確認する

### Implementation for User Story 3

- [X] T028 [US3] Chart.jsのcanvasを`toDataURL('image/png')`でPNG化しダウンロードをトリガーする処理を `src/profile/profileExport.ts` に実装する(T020に依存)
- [X] T029 [US3] 断面図のダウンロードボタンUIを `src/main.ts` に追加する(T028に依存)

**Checkpoint**: 断面図のPNGダウンロードが独立して動作する

---

## Phase 6: User Story 4 - 測線をオーバーレイした地図をPNGでダウンロードする (Priority: P3)

**Goal**: 測線と縮尺表示を含む地図をPNGファイルとしてダウンロードできる

**Independent Test**: 測線が描画された地図状態でダウンロード操作を行い、測線と縮尺表示を含むPNGファイルが得られることを確認する

### Implementation for User Story 4

- [X] T030 [US4] 地図(タイル+測線オーバーレイ+縮尺コントロール)をPNG化する処理を `src/map/mapExport.ts` に実装する(research.md R5、T010・T018に依存)。`leaflet-image`はDOMベースの縮尺コントロールを再現できないため、実装時の評価で`html2canvas`に一本化(依存関係からleaflet-imageを削除、バンドルサイズ抑制のため動的import化)
- [X] T031 [US4] 地図のダウンロードボタンUIを `src/main.ts` に追加する(T030に依存)
- [X] T032 [US4] タイル/COG配信元のCORS制約でPNG化に失敗した場合のエラーメッセージ表示を `src/map/mapExport.ts` に実装する(T030に依存)

**Checkpoint**: 地図PNGダウンロードが独立して動作する

---

## Phase 7: User Story 5 - 対象地域のタイル地図を背景表示する (Priority: P4)

**Goal**: 運用者が設定したタイルアドレスで地図背景が表示され、無効/到達不能な場合もアプリ全体は継続利用できる

**Independent Test**: 運用者が設定したタイルアドレスで地図背景が表示されること、および無効なアドレスでもフォールバック表示になり断面図機能が継続利用できることを確認する

### Implementation for User Story 5

- [X] T033 [US5] タイルレイヤーの読み込み失敗時のフォールバック表示(空白/既定表示)を `src/map/mapView.ts` に実装する(Edge Cases、T010に依存)。T010実装時に先行実装済み
- [X] T034 [P] [US5] `src/config/datasets.ts` の設定方法(タイルアドレス・DEMデータセットの追加手順)を `README.md` の「運用者向け設定」セクションとしてドキュメント化する(T007に依存)。開発者向けセットアップ手順(T037)もあわせて`README.md`に記載済み

**Checkpoint**: 全ユーザーストーリーが独立して機能する

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 複数ストーリーにまたがる仕上げ作業

- [X] T035 [P] 測線長が10kmを超える、または総サンプル点数が20,000点を超える場合に想定サンプル点数を提示し続行確認を求める処理を `src/main.ts` に実装する(閾値は定数として切り出し調整可能にする、Edge Cases・spec.md Assumptions参照)
- [X] T036 [P] `quickstart.md` のシナリオ1〜5を実ブラウザで手動検証し、結果を記録する(憲法: PNG機能は実ブラウザでの目視確認が必須)。Chrome実機で確認: 地図初期表示・タイルフォールバック通知・縮尺表示・測線描画(2クリック)・断面図生成ボタンの有効化・DEM未設定時のエラー表示・地図PNGダウンロードの一連の流れをコンソールエラーなしで確認。demDatasets/tileLayerConfigがプレースホルダーのため、実データでのシナリオ2・3・5の最終確認は運用者が実データ設定後に再実施が必要
- [X] T037 [P] セットアップ・開発・ビルド・デプロイ手順を記載した `README.md` を作成する(運用者向け設定の詳細はT034が追記するため、本タスクでは開発者向け手順のみを扱う)
- [X] T038 GitHub Pagesへのデプロイ設定(`vite.config.ts`の`base`パス設定、GitHub Actionsワークフローまたは`gh-pages`スクリプト)を追加する。`vite.config.ts`に`base: "./"`を設定し、`.github/workflows/deploy.yml`でtest→build→デプロイを自動化
- [X] T039 [P] アプリ全体のユーザー向けエラーメッセージの一貫性をレビューし整える。実機確認時に日本語の敬体(です/ます調)・文末句点で統一されていることを確認済み

---

## Phase 9: 背景タイルのレイヤー切替対応(追加要望, FR-016)

**Purpose**: `maptiles.md` で提供された5種類のタイル(時期の異なるオルソ画像・CS立体図・赤色立体図)を、
単一固定タイルではなくレイヤー切替コントロールで選択できるようにする(spec.md User Story 5, FR-016を拡張)。

- [X] T040 `TileLayerConfig` に `id`/`label` を追加し、`src/config/datasets.ts` を単一設定から
  `tileLayers: TileLayerConfig[]` + `defaultTileLayerId` の配列形式に変更する(`maptiles.md` の
  5レイヤーを実データとして設定、contracts/config-schema.md参照)
- [X] T041 `src/map/mapView.ts` に `L.control.layers()` を追加し、複数の背景タイルを切り替えられる
  ようにする。あわせて、タイルフォールバック通知のロジックを「表示範囲内で1枚も読み込めなかった場合のみ」
  発火するよう修正する(個別タイルの欠損を誤って全滅とみなさないため。実機検証で発見・修正)
- [X] T042 実ブラウザで5レイヤー中の複数(オルソ画像・赤色立体図)への切替と出典表示の切り替わりを確認する

**Checkpoint**: 複数の実タイル配信で表示・切替・出典表示・フォールバック通知が正しく動作する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし、即着手可能
- **Foundational (Phase 2)**: Setup完了後。全ユーザーストーリーをブロックする
- **User Stories (Phase 3-7)**: すべてFoundational完了後に着手可能
  - 優先度順(P1→P2→P3→P4)に進めるのが推奨だが、US1完了後はUS2〜US5は独立して並行可能
- **Polish (Phase 8)**: 実装対象のユーザーストーリーが完了した後

### User Story Dependencies

- **US1 (P1)**: Foundational完了後に着手可能。他ストーリーへの依存なし(MVP)
- **US2 (P2)**: Foundational完了後に着手可能だが、`generateProfile`/`profileChart`をUS1の実装(T017, T020)の上に拡張するため、実質的にUS1完了後に着手するのが自然
- **US3 (P2)**: US1の断面図表示(T020)に依存
- **US4 (P3)**: Foundationalの地図初期化(T010)とUS1の測線描画(T018)に依存
- **US5 (P4)**: Foundationalの地図初期化(T010)に依存。大部分はFoundationalで満たされ、本フェーズは残りのエッジケース対応のみ

### Within Each User Story

- テスト(該当する場合)を実装前に作成し、失敗することを確認する
- コアロジック(モデル/計算)→ UI配線 → バリデーション/エラー処理 の順
- 各ストーリー完了後、次の優先度へ進む

### Parallel Opportunities

- Setupの[P]タスク(T002-T004)は並行実行可能
- Foundationalの[P]タスク(T007, T009)は並行実行可能
- US1のテストタスク(T012-T014)は並行実行可能
- Foundational完了後、チーム体制があればUS2〜US5は並行着手可能(ただしUS2はUS1のコア実装に依存するため単独開発者の場合は逐次が現実的)

---

## Parallel Example: User Story 1

```bash
# User Story 1のテストを並行実行:
Task: "buildSamplePoints() のユニットテストを tests/unit/profileSampler.test.ts に作成"
Task: "sampleElevation() のユニットテストを tests/unit/demSource.test.ts に作成"
Task: "generateProfile() のユニットテストを tests/unit/profileGenerator.test.ts に作成"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup を完了する
2. Phase 2: Foundational を完了する(全ストーリーをブロックするため必須)
3. Phase 3: User Story 1 を完了する
4. **一旦停止して検証**: User Story 1 を独立してテストする(quickstart.mdシナリオ1)
5. 準備が整えばデプロイ/デモする

### Incremental Delivery

1. Setup + Foundational 完了 → 基盤が整う
2. User Story 1 追加 → 独立テスト → デプロイ/デモ(MVP!)
3. User Story 2(複数時期比較)追加 → 独立テスト → デプロイ/デモ
4. User Story 3(断面図PNG)追加 → 独立テスト → デプロイ/デモ
5. User Story 4(地図PNG)追加 → 独立テスト → デプロイ/デモ
6. User Story 5(タイル背景の仕上げ)追加 → 独立テスト → デプロイ/デモ
7. Polish フェーズで仕上げ

---

## Notes

- `[P]` タスク = 別ファイル、依存なし
- `[Story]` ラベルはユーザーストーリーとのトレーサビリティのために付与
- 各ユーザーストーリーは独立して完了・テスト可能であること
- 実装前にテストが失敗することを確認する(コアロジックのみ、憲法 原則V)
- 論理的なまとまりごとにコミットする
- 各チェックポイントでストーリー単独の動作を検証してから次に進む
