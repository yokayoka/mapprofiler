# Contract: 隆起補正ロジック(内部モジュールAPI)

001の`contracts/core-geo-api.md`と同様、外部公開APIは存在しないため、本機能で新設する
内部モジュール(`src/geo/upliftCorrection.ts`)の関数契約をここに定義する。
`tests/unit/upliftCorrection.test.ts`はこの契約に対して書く(憲法 原則V)。

## `upliftCorrection`

```ts
export interface UpliftCorrectionSettings {
  baseDatasetId: string;
  upliftM: number;
  enabled: boolean;
}

/**
 * 生成済みの CrossSectionProfile から、baseDatasetId の標高値に upliftM を加算した
 * 「隆起補正後」の仮想データセットを1件追加した新しい CrossSectionProfile を返す。
 * DEM の再サンプリングは行わない(既存の points をもとに加算するのみ)。
 * settings.enabled が false、または settings.upliftM が有限数値でない場合は、
 * 元の profile をそのまま返す(補正系列を追加しない)。
 */
function applyUpliftCorrection(
  profile: CrossSectionProfile,
  settings: UpliftCorrectionSettings,
): CrossSectionProfile;
```

- **Preconditions**: `profile.datasets`の中に`id === settings.baseDatasetId`のデータセットが
  存在すること。存在しない場合は元の`profile`をそのまま返す(何も追加しない。エラーにはしない
  — 運用者がデータセット構成を変えた場合に備えた安全側のフォールバック)。
- **Postconditions**:
  - 戻り値の`datasets`は、元の`datasets`に加えて`id`が
    `` `${settings.baseDatasetId}-uplift-corrected` `` の`DemDatasetConfig`が1件追加される。
  - 戻り値の各`points[i].elevationByDataset`には、上記の追加`id`をキーとする値が入る。
    値は`points[i].elevationByDataset[settings.baseDatasetId]`が`null`なら`null`、
    そうでなければ`+ settings.upliftM`した値。
  - 戻り値の`visibleDatasetIds`には追加`id`が含まれる(表示対象)。
  - `settings.enabled === false`、または`Number.isFinite(settings.upliftM) === false`の場合は、
    元の`profile`を(参照そのままでよい)返す。
  - 元の`profile`オブジェクト・`points`配列を破壊的に変更しない(イミュータブル)。

## テスト対象(憲法 原則V に基づく必須ユニットテスト)

- `applyUpliftCorrection`:
  - 正の隆起量: 全点で`baseDatasetId`の値+隆起量になること。
  - 負の隆起量(沈降): 減算になること。
  - 隆起量0: 補正後系列の値が元の値と一致すること。
  - `baseDatasetId`の値が`null`(NoData)の点では、補正後系列も`null`のままであること(FR-004)。
  - `settings.enabled === false`の場合、`profile`が変更されずそのまま返る(補正系列が
    追加されない)こと。
  - `settings.upliftM`が`NaN`/`Infinity`の場合、`profile`が変更されずそのまま返ること。
  - 元の`profile.points`・`profile.datasets`が変更(mutate)されていないこと。
