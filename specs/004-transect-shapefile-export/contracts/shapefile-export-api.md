# Contract: 測線Shapefileエクスポート(内部モジュールAPI)

001の`contracts/core-geo-api.md`、003の`contracts/uplift-correction-api.md`と同様、外部公開APIは
存在しないため、`src/map/shapefileExport.ts`に新設する内部モジュールの関数契約をここに定義する。
`tests/unit/shapefileExport.test.ts`はこの契約に対して書く(憲法 原則V)。

## `shapefileExport`

```ts
export interface TransectForShapefileExport {
  startLatLng: { lat: number; lng: number };
  endLatLng: { lat: number; lng: number };
}

/**
 * 測線(始点・終点)を1本のポリライン(PolyLine)としてESRI Shapefile化し、
 * .shp/.shx/.dbf/.prjの4ファイルを含むZIP(圧縮方式: 格納/Stored)のバイト列を返す。
 * 座標系はWGS84(緯度経度、EPSG:4326)。DEMサンプリング用のEPSG:6675への変換は行わない。
 */
function buildTransectShapefileZip(
  transect: TransectForShapefileExport,
  name?: string,
): Uint8Array;

function buildTransectShapefileFilename(prefix?: string): string;
```

- **Preconditions**: `startLatLng`・`endLatLng`はWGS84の有効な緯度経度(度)。始点と終点が同一
  座標であっても例外にはしない(spec.md Edge Cases。KML出力と同様、特別なエラー処理は行わない)。
- **Postconditions**:
  - 戻り値はZIPファイルとして有効なバイト列であり、解凍すると同一のベース名を持つ
    `.shp`・`.shx`・`.dbf`・`.prj`の4ファイルが得られる。
  - `.shp`は shapeType=3(PolyLine)のレコードを1件持ち、パート数1・頂点数2(始点→終点の順)。
  - `.shx`は`.shp`の当該レコードのオフセット・長さを正しく指す1エントリを持つ。
  - `.dbf`はフィールド`name`(Character, 長さ40)を持ち、レコード1件に`name`引数(既定値あり、
    ASCII文字列)を格納する。
  - `.prj`はWGS84(EPSG:4326)を表すWKT文字列(ASCIIテキスト)。
  - ZIP内の各ファイルエントリの圧縮方式は「格納(Stored)」であり、CRC-32・圧縮後サイズ・
    展開後サイズが正しく設定されている。
  - `buildTransectShapefileFilename()`は`.zip`拡張子のファイル名を返す(`buildTransectKmlFilename()`
    と同様のタイムスタンプ付き命名規則)。

## テスト対象(憲法 原則V に基づく必須ユニットテスト)

- CRC-32実装: 標準の検査値(`crc32(new TextEncoder().encode("123456789"))`が`0xCBF43926`と
  一致すること)。
- `.shp`のバイト列: ファイルコード(9994, big-endian)、シェイプタイプ(3, little-endian)、
  バウンディングボックス(始点・終点から算出したXmin/Ymin/Xmax/Ymax)、パート数(1)、
  頂点数(2)、頂点座標(始点→終点の順、little-endian double)を`DataView`で読み戻して検証する。
- `.dbf`のバイト列: フィールド記述子(名前`name`, 型`C`, 長さ40)、レコード数(1)、
  レコード内の文字列値(左詰め・空白パディング)を検証する。
- `.prj`の内容: WGS84を表すWKT文字列であることを文字列としてassertする。
- ZIP全体: ローカルファイルヘッダのシグネチャ(`0x04034b50`)・ファイル名・圧縮方式(0=格納)、
  セントラルディレクトリのシグネチャ(`0x02014b50`)・エントリ数、
  End of Central Directoryのシグネチャ(`0x06054b50`)を読み戻して検証する
  (自作のミニマムなZIPパーサ、または手動でオフセット計算して検証する)。
- `buildTransectShapefileFilename()`: `.zip`拡張子を持つファイル名を返すこと。
