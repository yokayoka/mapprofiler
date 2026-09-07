# Tasks: 測線Shapefileダウンロード

**Input**: Design documents from `/specs/004-transect-shapefile-export/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md(すべて存在)

**Tests**: 憲法(`.specify/memory/constitution.md`)原則V「コアロジックのテスト必須」により、
Shapefile/DBF/ZIP生成ロジックのユニットテストを含める。UI部分のテストは任意。

**Organization**: タスクはユーザーストーリー(spec.mdのP1〜P2)ごとにグループ化する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可能(別ファイル、未完了タスクへの依存なし)
- **[Story]**: 対応するユーザーストーリー(US1〜US2)
- ファイルパスは `plan.md` のProject Structureに準拠

## Path Conventions

001〜003と同一の単一プロジェクト。`src/`, `tests/` はリポジトリルート直下。

---

## Phase 1: Setup

**Purpose**: 本機能固有のセットアップ(新規依存なし、既存プロジェクト構成をそのまま使用)

- [X] T001 既存の`src/map/transectExport.ts`(KMLエクスポート)と`TransectPoints`
  (`src/map/transectDraw.ts`)の型定義を確認し、Shapefileエクスポートが同じ入力
  (始点・終点の緯度経度)を再利用できることを確認する(前提確認のみ、コード変更なし)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shapefile/DBF/ZIP生成に共通する低レベルのバイナリ書き込みユーティリティ

**⚠️ CRITICAL**: このフェーズが完了するまでユーザーストーリーの実装を開始しない

- [X] T002 `research.md` R2に基づき、標準の検査値(`crc32("123456789") === 0xCBF43926`)で
  検証可能なCRC-32実装を `src/map/shapefileExport.ts` 内のプライベート関数として追加する

**Checkpoint**: CRC-32が実装され、ZIP・Shapefile生成の実装に着手できる

---

## Phase 3: User Story 1 - 測線をShapefileでダウンロードしてGISソフトで開く (Priority: P1) 🎯 MVP

**Goal**: 測線を1本のポリライン(始点→終点)として含むESRI Shapefile一式(.shp/.shx/.dbf/.prj)を
zipにまとめてダウンロードできる

**Independent Test**: 地図上で測線を指定し、「測線をShapefileでダウンロード」ボタンを押してzipを
取得、展開してGISソフトウェア(またはバイト列検証)で内容を確認する

### Tests for User Story 1 ⚠️

> これらのテストを先に作成し、実装前に失敗することを確認する

- [X] T003 [P] [US1] `contracts/shapefile-export-api.md` に基づき、`.shp`のバイト列
  (ファイルコード9994・シェイプタイプ3・バウンディングボックス・パート数1・頂点数2・
  始点→終点の座標順)を検証するユニットテストを `tests/unit/shapefileExport.test.ts` に作成する
- [X] T004 [P] [US1] 同ファイルに、`.dbf`のバイト列(フィールド`name`, 型`C`, 長さ40、
  レコード数1、値が左詰め・空白パディングされること)を検証するテストを追加する
- [X] T005 [P] [US1] 同ファイルに、`.prj`がWGS84を表すWKT文字列であることを検証するテストを
  追加する
- [X] T006 [P] [US1] 同ファイルに、生成されたZIP全体(ローカルファイルヘッダ・セントラル
  ディレクトリ・End of Central Directoryの各シグネチャ、ファイル名、圧縮方式=格納)を
  読み戻して検証するテストを追加する
- [X] T007 [P] [US1] 同ファイルに、`buildTransectShapefileFilename()`が`.zip`拡張子のファイル名を
  返すことを検証するテストを追加する

### Implementation for User Story 1

- [X] T008 [US1] `contracts/shapefile-export-api.md` の`.shp`仕様に基づき、測線を
  shapeType=3(PolyLine)・頂点2点のレコードとしてバイト列化する処理を
  `src/map/shapefileExport.ts` に実装する(T003に対応)
- [X] T009 [US1] 上記のレコードに対応する`.shx`(インデックス)を生成する処理を
  `src/map/shapefileExport.ts` に実装する(T008に依存)
- [X] T010 [US1] `data-model.md` の`.dbf`フィールド定義(`name`, Character, 長さ40)に基づき、
  dBase III形式の`.dbf`バイト列を生成する処理を `src/map/shapefileExport.ts` に実装する
  (T004に対応)
- [X] T011 [US1] [P] WGS84(EPSG:4326)を表すWKT文字列を返す`.prj`生成処理を
  `src/map/shapefileExport.ts` に実装する(T005に対応)
- [X] T012 [US1] T002のCRC-32を用い、`.shp`・`.shx`・`.dbf`・`.prj`の4ファイルを
  圧縮方式「格納」でZIPにまとめる処理を `src/map/shapefileExport.ts` に実装する
  (T006に対応、T008〜T011に依存)
- [X] T013 [US1] `buildTransectShapefileZip(transect, name?)` と
  `buildTransectShapefileFilename(prefix?)` を `src/map/shapefileExport.ts` の公開APIとして
  実装する(T007に対応、T012に依存)
- [X] T014 [US1] Shapefile(zip、バイナリ)をダウンロードするための`downloadBlob()`ヘルパーを
  `src/map/shapefileExport.ts` に追加し(`Blob` + `URL.createObjectURL`を使用、既存の
  `downloadDataUrl`はテキスト/data URL向けのため別関数とする)、「測線をShapefileでダウンロード」
  ボタンを既存の「測線をKMLでダウンロード」ボタンの隣に追加して `src/main.ts` に配線する
  (KMLボタンと同じ有効化条件、FR-004, FR-005)

**Checkpoint**: User Story 1が単独で完全に動作し、テスト可能な状態(MVP)

---

## Phase 4: User Story 2 - 測線が未指定の間はダウンロードできないことが分かる (Priority: P2)

**Goal**: 測線が未指定の間、Shapefileダウンロードボタンが無効化されている

**Independent Test**: 測線を指定する前にボタンが無効化されていること、指定すると有効化される
ことを確認する

### Implementation for User Story 2

- [X] T015 [US2] `transectDraw.onChange()`のコールバック(`src/main.ts`、既存の
  `downloadKmlBtn.disabled`と同じ箇所)に、Shapefileダウンロードボタンの有効/無効切り替えを
  追加する(T014に依存)

**Checkpoint**: 全ユーザーストーリーが独立して機能する

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 複数ストーリーにまたがる仕上げ作業

- [ ] T016 [P] `quickstart.md` のシナリオ1〜3を実ブラウザ・GISソフトウェアで手動検証し、
  結果を記録する(憲法: バイナリダウンロード機能は実環境での目視確認が望ましい。本セッションでは
  ブラウザ拡張機能が未接続のためUI操作の実ブラウザ確認は未実施。代わりに、生成したzipを
  `unzip -t`で構造検証、`.shp`/`.dbf`/`.prj`をPythonの`struct`で独立に読み戻し、ファイルコード・
  シェイプタイプ・バウンディングボックス・頂点座標・DBFフィールド定義・WKTが期待通りであることを
  確認済み。UIのクリック操作自体の目視確認は運用者による再確認が必要)
- [X] T017 [P] `README.md` に測線Shapefileダウンロード機能の使い方を追記する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし、即着手可能
- **Foundational (Phase 2)**: Setup完了後。User Story 1をブロックする(CRC-32はZIP生成に必須)
- **User Stories (Phase 3-4)**: Foundational完了後に着手可能
  - US2はUS1のボタン実装(T014)に依存するため、US1完了後の着手が現実的
- **Polish (Phase 5)**: 実装対象のユーザーストーリーが完了した後

### User Story Dependencies

- **US1 (P1)**: Foundational完了後に着手可能。他ストーリーへの依存なし(MVP)
- **US2 (P2)**: US1のボタン実装(T014)に依存

### Within Each User Story

- テストを実装前に作成し、失敗することを確認する(原則V)
- 低レベル(CRC-32)→ 各フォーマット生成(.shp/.shx/.dbf/.prj)→ ZIP格納 → 公開API → UI配線 の順
- 各ストーリー完了後、次の優先度へ進む

### Parallel Opportunities

- User Story 1のテストタスク(T003-T007)は並行実行可能
- T011(`.prj`生成)は他のフォーマット実装と独立しているため並行実行可能
- Polishの[P]タスク(T016, T017)は並行実行可能

---

## Parallel Example: User Story 1

```bash
# User Story 1のテストを並行実行:
Task: ".shpのバイト列を検証するテストを tests/unit/shapefileExport.test.ts に作成"
Task: ".dbfのバイト列を検証するテストを追加"
Task: ".prjの内容を検証するテストを追加"
Task: "ZIP全体の構造を検証するテストを追加"
Task: "buildTransectShapefileFilename() のテストを追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup を完了する
2. Phase 2: Foundational(CRC-32)を完了する
3. Phase 3: User Story 1 を完了する
4. **一旦停止して検証**: User Story 1 を独立してテストする(quickstart.mdシナリオ1・2)
5. 準備が整えばデプロイ/デモする

### Incremental Delivery

1. Setup + Foundational 完了 → 基盤が整う
2. User Story 1(Shapefileダウンロード)追加 → 独立テスト → デプロイ/デモ(MVP!)
3. User Story 2(ボタン有効化条件)追加 → 独立テスト → デプロイ/デモ
4. Polish フェーズで仕上げ

---

## Notes

- `[P]` タスク = 別ファイル、依存なし
- `[Story]` ラベルはユーザーストーリーとのトレーサビリティのために付与
- 各ユーザーストーリーは独立して完了・テスト可能であること
- 実装前にテストが失敗することを確認する(コアロジックのみ、憲法 原則V)
- 論理的なまとまりごとにコミットする
- 各チェックポイントでストーリー単独の動作を検証してから次に進む
