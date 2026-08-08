# MapProfiler

能登半島北部を対象とした、複数時期のDEM(数値標高モデル)から任意の測線の断面図を作成するWebGISツールです。
GitHub Pages上で動作する静的サイトとして実装されています(サーバー処理なし)。

詳細な仕様は [`specs/001-dem-cross-section/`](./specs/001-dem-cross-section/) を参照してください。

## 開発者向けセットアップ

### 必要環境

- Node.js（LTS推奨)

### セットアップ

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

### ユニットテスト

```bash
npm run test
```

座標変換・DEMサンプリング・断面図生成ロジックのユニットテストを実行します(憲法 原則V)。

### ビルド

```bash
npm run build
```

`dist/` に静的ファイル一式が生成されます。

### Lint

```bash
npm run lint
```

## 運用者向け設定

エンドユーザー向けの設定変更UIは提供していません(FR-015)。以下の設定はビルド前に
`src/config/datasets.ts` を編集し、`npm run build` で反映してください。

### 背景タイル地図(`tileLayerConfig`)

```ts
export const tileLayerConfig: TileLayerConfig = {
  urlTemplate: "https://.../{z}/{x}/{y}.png",
  attribution: "...",
  maxZoom: 18,
};
```

- `urlTemplate`: LeafletのタイルURLテンプレート。
- **CORSを許可する配信元を指定してください。** 「地図をPNGでダウンロード」機能(User Story 4)は
  タイル画像をcanvasに合成するため、配信元が `Access-Control-Allow-Origin` を返さない場合は
  ダウンロードに失敗します(画面にエラーメッセージが表示されます)。
- 無効・到達不能なアドレスを設定した場合でも、地図はフォールバック表示となり、断面図の作成機能は
  引き続き利用できます(Edge Cases)。

### DEMデータセット(`demDatasets`)

```ts
export const demDatasets: DemDatasetConfig[] = [
  {
    id: "pre-earthquake",
    label: "地震前",
    cogUrl: "https://.../pre-earthquake.tif",
    crs: "EPSG:6675",
    resolutionM: 0.5,
    color: "#4C72B0",
  },
  // ...
];
```

- `cogUrl`: COG(Cloud Optimized GeoTIFF)形式、EPSG:6675のDEMファイルのURL。
  **HTTP Range Requestおよび(必要に応じて)CORSを許可する配信元を指定してください。**
  0.5m解像度のDEMは容量が大きく、GitHubの単一ファイルサイズ上限を超える可能性が高いため、
  リポジトリ内ではなく外部の静的ストレージ(オブジェクトストレージ・CDN等)への配置を推奨します。
- `id` は配列内で一意にしてください。
- `color` は断面図上でのその時期の線の色(CSSカラー文字列)です。
- 1件以上を設定してください(0件の場合、断面図が生成できません)。

## デプロイ(GitHub Pages)

`main` ブランチへのpushをトリガーに `.github/workflows/deploy.yml` が自動的に
テスト → ビルド → GitHub Pagesへのデプロイを行います。

初回のみ、GitHubリポジトリの Settings → Pages で Source を「GitHub Actions」に設定してください。

手動でデプロイする場合は `workflow_dispatch` からワークフローを実行するか、以下でビルド成果物を
確認できます。

```bash
npm run build
npm run preview
```

`vite.config.ts` の `base: "./"` により、相対パスでアセットを参照するためリポジトリ名に
依存せずどのGitHub Pagesパス構成でも動作します。
