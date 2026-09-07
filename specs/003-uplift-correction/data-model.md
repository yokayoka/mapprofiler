# Data Model: 隆起補正断面図

001-dem-cross-sectionの`CrossSectionProfile` / `ProfilePoint` / `DemDatasetConfig`
(`src/types.ts`)を変更せずに再利用する。本機能で追加する概念は以下の2つ。

## UpliftCorrectionSettings(新規)

現在の断面図に対して適用する隆起補正の設定。measured値ではなくユーザー入力値であり、
`CrossSectionProfile`本体には含めず、UI状態(`main.ts`)として保持する。

| フィールド | 型 | 説明 |
|---|---|---|
| `baseDatasetId` | `string` | 補正対象のベースデータセットID。固定値`"pre-earthquake"`(research.md R2) |
| `upliftM` | `number` | 隆起量(メートル)。正=隆起、負=沈降、0=補正なしと同値。有限数値であること(`Number.isFinite`) |
| `enabled` | `boolean` | 補正後系列を断面図に表示するかどうか(FR-006)。無効な入力値の間は`false`として扱う |

- **Validation**: `upliftM`は`Number.isFinite(upliftM)`を満たさない場合、`enabled`を`false`
  扱いにして補正後系列を描画しない(FR-010)。
- **Lifecycle**: 測線を引き直して断面図を再作成しても、UI上の入力値・チェック状態は
  自動リセットしない(spec.md Edge Cases)。

## 隆起補正後データセット(派生値、永続化しない)

`UpliftCorrectionSettings`と既存の`CrossSectionProfile`から、表示直前に導出する
「仮想データセット」。実体は既存の型をそのまま使う(新しい型を追加しない)。

- **`DemDatasetConfig`としての表現**:
  - `id`: `` `${baseDatasetId}-uplift-corrected` ``(例: `pre-earthquake-uplift-corrected`)
  - `label`: ベースデータセットのラベルに隆起量を付記(例: 「地震前(隆起補正 +1.5m)」/
    `"Pre-earthquake (uplift-corrected +1.5m)"`)
  - `color` / その他: ベースデータセットの表示スタイル管理(色・太さ)とは独立に、
    専用のデフォルト色を持ち、既存のスタイル変更UIで個別に上書きできる
- **各距離点の値**: `elevationByDataset[baseDatasetId]`が`null`でなければ
  `elevationByDataset[baseDatasetId] + upliftM`、`null`であれば`null`のまま(FR-004)。

### 関係性

```text
CrossSectionProfile (既存, 変更なし)
  └─ points[].elevationByDataset["pre-earthquake"] ──┐
                                                       │ + upliftM (UpliftCorrectionSettings)
                                                       ▼
                                     仮想系列 "pre-earthquake-uplift-corrected"
                                     (ProfileChartへの描画時にのみ存在。再取得・永続化なし)
```
