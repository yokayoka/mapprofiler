# Data Model: 測線Shapefileダウンロード

001の`TransectForKmlExport`(`src/map/transectExport.ts`、`{ startLatLng, endLatLng }`)を
そのまま入力として再利用する。新規の永続データモデルは追加しない。

## 生成物の構造(永続化しない、ダウンロード時にのみ組み立てる中間データ)

| ファイル | 役割 | 内容 |
|---|---|---|
| `<name>.shp` | ジオメトリ本体 | シェイプタイプ3(PolyLine)、1レコード、頂点2点(始点→終点) |
| `<name>.shx` | ジオメトリのインデックス | `.shp`内のレコード位置・長さを示す1エントリ |
| `<name>.dbf` | 属性テーブル | 1レコード、フィールド`name`(文字列、ASCII、測線名相当) |
| `<name>.prj` | 投影情報 | WGS84(EPSG:4326)を表すWKT文字列 |

上記4ファイルを1つのZIP(圧縮方式: 格納/Stored)にまとめたものが、ユーザーがダウンロードする
成果物(例: `transect_2026-09-07T12-00-00-000Z.zip`)である。

## フィールド定義(.dbf)

| フィールド名 | 型 | 長さ | 説明 |
|---|---|---|---|
| `name` | Character(C) | 40 | 測線名(ASCII文字列、既定値は`"transect"`相当の英字。日本語は使用しない、spec.md Assumptions) |

## ジオメトリ定義(.shp)

- シェイプタイプ: 3(PolyLine)
- パート数: 1
- 頂点数: 2(始点、終点の順)
- 座標: `TransectForKmlExport.startLatLng` / `endLatLng` の `{ lng, lat }` をそれぞれ X, Y として使用(WGS84、経度=X、緯度=Y)。
