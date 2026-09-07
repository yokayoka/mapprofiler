import type { TransectForKmlExport } from "./transectExport";

const SHAPE_TYPE_POLYLINE = 3;
const DBF_FIELD_NAME = "name";
const DBF_FIELD_LENGTH = 40;
/** WGS84(EPSG:4326)を表すWKT文字列(ESRIスタイル、.prj向け)。 */
const WGS84_WKT =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// CRC-32(ZIPのローカル/セントラルディレクトリヘッダで使用)
// ---------------------------------------------------------------------------

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** 標準のCRC-32(検査値: `crc32("123456789") === 0xCBF43926`)。 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Shapefile本体(.shp)・インデックス(.shx)
// ---------------------------------------------------------------------------

/**
 * 測線(始点→終点)をshapeType=3(PolyLine)・頂点2点のレコード1件として`.shp`/`.shx`を生成する
 * (ESRI Shapefile Technical Description準拠)。座標系はWGS84(緯度経度)、変換は行わない。
 */
function buildShpAndShx(transect: TransectForKmlExport): { shp: Uint8Array; shx: Uint8Array } {
  const points = [
    { x: transect.startLatLng.lng, y: transect.startLatLng.lat },
    { x: transect.endLatLng.lng, y: transect.endLatLng.lat },
  ];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);

  const numParts = 1;
  const numPoints = points.length;
  // shapeType(4) + box(32) + numParts(4) + numPoints(4) + parts(4*numParts) + points(16*numPoints)
  const contentLengthBytes = 4 + 32 + 4 + 4 + 4 * numParts + 16 * numPoints;
  const contentLengthWords = contentLengthBytes / 2;

  const shpTotalBytes = 100 + 8 + contentLengthBytes;
  const shp = new Uint8Array(shpTotalBytes);
  const shpView = new DataView(shp.buffer);

  // メインファイルヘッダ(100バイト)。File Code/Unused/File LengthはBig-Endian、
  // Version/Shape TypeはLittle-Endian(ESRI仕様)。
  shpView.setInt32(0, 9994);
  shpView.setInt32(24, shpTotalBytes / 2);
  shpView.setInt32(28, 1000, true);
  shpView.setInt32(32, SHAPE_TYPE_POLYLINE, true);
  shpView.setFloat64(36, xmin, true);
  shpView.setFloat64(44, ymin, true);
  shpView.setFloat64(52, xmax, true);
  shpView.setFloat64(60, ymax, true);
  // bytes 68-99 (Zmin/Zmax/Mmin/Mmax) は未使用のため0のまま

  // レコードヘッダ(Record Number・Content LengthはBig-Endian)
  let pos = 100;
  shpView.setInt32(pos, 1);
  pos += 4;
  shpView.setInt32(pos, contentLengthWords);
  pos += 4;

  // レコード内容(Shape Type以降はLittle-Endian)
  shpView.setInt32(pos, SHAPE_TYPE_POLYLINE, true);
  pos += 4;
  shpView.setFloat64(pos, xmin, true);
  pos += 8;
  shpView.setFloat64(pos, ymin, true);
  pos += 8;
  shpView.setFloat64(pos, xmax, true);
  pos += 8;
  shpView.setFloat64(pos, ymax, true);
  pos += 8;
  shpView.setInt32(pos, numParts, true);
  pos += 4;
  shpView.setInt32(pos, numPoints, true);
  pos += 4;
  shpView.setInt32(pos, 0, true); // parts[0] = 0(先頭パートの開始頂点インデックス)
  pos += 4;
  for (const p of points) {
    shpView.setFloat64(pos, p.x, true);
    pos += 8;
    shpView.setFloat64(pos, p.y, true);
    pos += 8;
  }

  // インデックスファイル(.shx)。ヘッダはメインファイルと同一構造。
  // レコードのOffset/Content LengthはいずれもBig-Endian、単位は16bitワード。
  const shxTotalBytes = 100 + 8;
  const shx = new Uint8Array(shxTotalBytes);
  const shxView = new DataView(shx.buffer);
  shxView.setInt32(0, 9994);
  shxView.setInt32(24, shxTotalBytes / 2);
  shxView.setInt32(28, 1000, true);
  shxView.setInt32(32, SHAPE_TYPE_POLYLINE, true);
  shxView.setFloat64(36, xmin, true);
  shxView.setFloat64(44, ymin, true);
  shxView.setFloat64(52, xmax, true);
  shxView.setFloat64(60, ymax, true);
  shxView.setInt32(100, 50); // メインファイルのレコードヘッダ開始位置(100バイト=50ワード)
  shxView.setInt32(104, contentLengthWords);

  return { shp, shx };
}

// ---------------------------------------------------------------------------
// 属性テーブル(.dbf、dBase III形式)
// ---------------------------------------------------------------------------

/** `name`フィールド(Character, 長さ40)1件のみを持つdBase III形式の`.dbf`を生成する。 */
function buildDbf(name: string): Uint8Array {
  const headerLength = 32 + 32 + 1; // ファイルヘッダ + フィールド記述子1件 + ターミネータ
  const recordLength = 1 + DBF_FIELD_LENGTH; // 削除フラグ + フィールド長
  const totalLength = headerLength + recordLength + 1; // + EOFマーカー

  const dbf = new Uint8Array(totalLength);
  const view = new DataView(dbf.buffer);

  const now = new Date();
  dbf[0] = 0x03; // dBase III(メモなし)
  dbf[1] = Math.max(0, now.getFullYear() - 1900) & 0xff;
  dbf[2] = now.getMonth() + 1;
  dbf[3] = now.getDate();
  view.setUint32(4, 1, true); // レコード数
  view.setUint16(8, headerLength, true);
  view.setUint16(10, recordLength, true);
  // bytes 12-31 は予約領域(0のまま)

  // フィールド記述子(offset 32から32バイト)
  const fieldNameBytes = encoder.encode(DBF_FIELD_NAME).slice(0, 10);
  dbf.set(fieldNameBytes, 32);
  dbf[32 + 11] = 0x43; // 'C' (Character)
  dbf[32 + 16] = DBF_FIELD_LENGTH;
  dbf[32 + 17] = 0; // decimal count

  dbf[64] = 0x0d; // フィールド記述子の終端

  // レコード(削除フラグ + 左詰め・空白パディングされた値)
  let pos = 65;
  dbf[pos] = 0x20; // 未削除
  pos += 1;
  const valueBytes = encoder.encode(name).slice(0, DBF_FIELD_LENGTH);
  dbf.set(valueBytes, pos);
  for (let i = valueBytes.length; i < DBF_FIELD_LENGTH; i++) {
    dbf[pos + i] = 0x20;
  }
  pos += DBF_FIELD_LENGTH;

  dbf[pos] = 0x1a; // EOFマーカー

  return dbf;
}

// ---------------------------------------------------------------------------
// 投影情報(.prj)
// ---------------------------------------------------------------------------

function buildPrj(): Uint8Array {
  return encoder.encode(WGS84_WKT);
}

// ---------------------------------------------------------------------------
// ZIPコンテナ(圧縮方式: 格納/Stored。DEFLATEは実装しない)
// ---------------------------------------------------------------------------

interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

const DOS_TIME = 0;
const DOS_DATE = 0x21; // 1980-01-01(固定値。ZIPは日時省略不可のためダミー値を使用)

/** 複数ファイルを圧縮方式「格納(Stored)」でZIP化する(APPNOTE.TXT準拠の最小実装)。 */
function buildZip(entries: ZipEntryInput[]): Uint8Array {
  const prepared = entries.map((entry) => ({
    nameBytes: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
    localHeaderOffset: 0,
  }));

  let offset = 0;
  for (const p of prepared) {
    p.localHeaderOffset = offset;
    offset += 30 + p.nameBytes.length + p.data.length;
  }
  const localSectionSize = offset;

  let centralSize = 0;
  for (const p of prepared) {
    centralSize += 46 + p.nameBytes.length;
  }

  const totalSize = localSectionSize + centralSize + 22; // + End of Central Directory
  const zip = new Uint8Array(totalSize);
  const view = new DataView(zip.buffer);

  let pos = 0;
  for (const p of prepared) {
    view.setUint32(pos, 0x04034b50, true);
    pos += 4;
    view.setUint16(pos, 20, true); // version needed to extract
    pos += 2;
    view.setUint16(pos, 0, true); // flags
    pos += 2;
    view.setUint16(pos, 0, true); // compression method: stored
    pos += 2;
    view.setUint16(pos, DOS_TIME, true);
    pos += 2;
    view.setUint16(pos, DOS_DATE, true);
    pos += 2;
    view.setUint32(pos, p.crc, true);
    pos += 4;
    view.setUint32(pos, p.data.length, true); // compressed size
    pos += 4;
    view.setUint32(pos, p.data.length, true); // uncompressed size
    pos += 4;
    view.setUint16(pos, p.nameBytes.length, true);
    pos += 2;
    view.setUint16(pos, 0, true); // extra field length
    pos += 2;
    zip.set(p.nameBytes, pos);
    pos += p.nameBytes.length;
    zip.set(p.data, pos);
    pos += p.data.length;
  }

  const centralDirOffset = pos;
  for (const p of prepared) {
    view.setUint32(pos, 0x02014b50, true);
    pos += 4;
    view.setUint16(pos, 20, true); // version made by
    pos += 2;
    view.setUint16(pos, 20, true); // version needed to extract
    pos += 2;
    view.setUint16(pos, 0, true); // flags
    pos += 2;
    view.setUint16(pos, 0, true); // compression method
    pos += 2;
    view.setUint16(pos, DOS_TIME, true);
    pos += 2;
    view.setUint16(pos, DOS_DATE, true);
    pos += 2;
    view.setUint32(pos, p.crc, true);
    pos += 4;
    view.setUint32(pos, p.data.length, true);
    pos += 4;
    view.setUint32(pos, p.data.length, true);
    pos += 4;
    view.setUint16(pos, p.nameBytes.length, true);
    pos += 2;
    view.setUint16(pos, 0, true); // extra field length
    pos += 2;
    view.setUint16(pos, 0, true); // comment length
    pos += 2;
    view.setUint16(pos, 0, true); // disk number start
    pos += 2;
    view.setUint16(pos, 0, true); // internal attributes
    pos += 2;
    view.setUint32(pos, 0, true); // external attributes
    pos += 4;
    view.setUint32(pos, p.localHeaderOffset, true);
    pos += 4;
    zip.set(p.nameBytes, pos);
    pos += p.nameBytes.length;
  }
  const centralDirSize = pos - centralDirOffset;

  view.setUint32(pos, 0x06054b50, true);
  pos += 4;
  view.setUint16(pos, 0, true); // disk number
  pos += 2;
  view.setUint16(pos, 0, true); // disk with central directory
  pos += 2;
  view.setUint16(pos, prepared.length, true); // entries on this disk
  pos += 2;
  view.setUint16(pos, prepared.length, true); // total entries
  pos += 2;
  view.setUint32(pos, centralDirSize, true);
  pos += 4;
  view.setUint32(pos, centralDirOffset, true);
  pos += 4;
  view.setUint16(pos, 0, true); // comment length

  return zip;
}

// ---------------------------------------------------------------------------
// 公開API
// ---------------------------------------------------------------------------

export interface ShapefileParts {
  shp: Uint8Array;
  shx: Uint8Array;
  dbf: Uint8Array;
  prj: Uint8Array;
}

/** 測線から`.shp`/`.shx`/`.dbf`/`.prj`の4ファイル(ZIP化前)を生成する。 */
export function buildShapefileParts(transect: TransectForKmlExport, name = "transect"): ShapefileParts {
  const { shp, shx } = buildShpAndShx(transect);
  return { shp, shx, dbf: buildDbf(name), prj: buildPrj() };
}

/**
 * 測線(始点・終点)を1本のポリラインとして含むESRI Shapefile一式をZIP化して返す(004)。
 * 座標系はKML出力と同じWGS84(緯度経度)。DEMサンプリング用のEPSG:6675への変換は行わない。
 */
export function buildTransectShapefileZip(transect: TransectForKmlExport, name = "transect"): Uint8Array {
  const parts = buildShapefileParts(transect, name);
  return buildZip([
    { name: "transect.shp", data: parts.shp },
    { name: "transect.shx", data: parts.shx },
    { name: "transect.dbf", data: parts.dbf },
    { name: "transect.prj", data: parts.prj },
  ]);
}

export function buildTransectShapefileFilename(prefix = "transect"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${timestamp}.zip`;
}

/** バイナリのBlobをダウンロードする(data URLではなくBlob URLを使用し、サイズ制限を避ける)。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
