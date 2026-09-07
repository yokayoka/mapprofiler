import { describe, expect, it } from "vitest";
import {
  buildShapefileParts,
  buildTransectShapefileFilename,
  buildTransectShapefileZip,
  crc32,
} from "../../src/map/shapefileExport";

const transect = {
  startLatLng: { lat: 37.42, lng: 137.08 },
  endLatLng: { lat: 37.43, lng: 137.1 },
};

describe("crc32", () => {
  it("標準の検査値と一致する", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("空バイト列では0を返す", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("buildShapefileParts (.shp)", () => {
  it("ファイルコード9994(big-endian)を持つ", () => {
    const { shp } = buildShapefileParts(transect);
    const view = new DataView(shp.buffer);
    expect(view.getInt32(0)).toBe(9994);
  });

  it("シェイプタイプ3(PolyLine, little-endian)を持つ", () => {
    const { shp } = buildShapefileParts(transect);
    const view = new DataView(shp.buffer);
    expect(view.getInt32(32, true)).toBe(3);
  });

  it("バウンディングボックスが始点・終点から正しく算出される", () => {
    const { shp } = buildShapefileParts(transect);
    const view = new DataView(shp.buffer);
    expect(view.getFloat64(36, true)).toBeCloseTo(137.08); // xmin
    expect(view.getFloat64(44, true)).toBeCloseTo(37.42); // ymin
    expect(view.getFloat64(52, true)).toBeCloseTo(137.1); // xmax
    expect(view.getFloat64(60, true)).toBeCloseTo(37.43); // ymax
  });

  it("レコードのパート数1・頂点数2を持つ", () => {
    const { shp } = buildShapefileParts(transect);
    const view = new DataView(shp.buffer);
    // レコードヘッダ(8バイト)+ shapeType(4) + box(32) の後にnumParts/numPointsが続く
    const numPartsOffset = 100 + 8 + 4 + 32;
    expect(view.getInt32(numPartsOffset, true)).toBe(1);
    expect(view.getInt32(numPartsOffset + 4, true)).toBe(2);
  });

  it("頂点座標が始点→終点の順で格納される", () => {
    const { shp } = buildShapefileParts(transect);
    const view = new DataView(shp.buffer);
    const pointsOffset = 100 + 8 + 4 + 32 + 4 + 4 + 4; // parts配列(4バイト)の後
    expect(view.getFloat64(pointsOffset, true)).toBeCloseTo(137.08); // 始点 x(lng)
    expect(view.getFloat64(pointsOffset + 8, true)).toBeCloseTo(37.42); // 始点 y(lat)
    expect(view.getFloat64(pointsOffset + 16, true)).toBeCloseTo(137.1); // 終点 x(lng)
    expect(view.getFloat64(pointsOffset + 24, true)).toBeCloseTo(37.43); // 終点 y(lat)
  });

  it("ファイル長(words)がファイル全体の実バイト数と一致する", () => {
    const { shp } = buildShapefileParts(transect);
    const view = new DataView(shp.buffer);
    expect(view.getInt32(24) * 2).toBe(shp.length);
  });
});

describe("buildShapefileParts (.shx)", () => {
  it("メインファイルと同じヘッダ構造(ファイルコード・シェイプタイプ)を持つ", () => {
    const { shx } = buildShapefileParts(transect);
    const view = new DataView(shx.buffer);
    expect(view.getInt32(0)).toBe(9994);
    expect(view.getInt32(32, true)).toBe(3);
  });

  it("レコードのオフセット(50ワード=100バイト)とコンテンツ長を正しく指す", () => {
    const { shx, shp } = buildShapefileParts(transect);
    const shxView = new DataView(shx.buffer);
    const shpView = new DataView(shp.buffer);
    expect(shxView.getInt32(100)).toBe(50);
    expect(shxView.getInt32(104)).toBe(shpView.getInt32(104));
  });
});

describe("buildShapefileParts (.dbf)", () => {
  it("フィールド記述子にnameフィールド(型C, 長さ40)を持つ", () => {
    const { dbf } = buildShapefileParts(transect, "transect");
    const fieldName = new TextDecoder().decode(dbf.slice(32, 32 + 4));
    expect(fieldName).toBe("name");
    expect(dbf[32 + 11]).toBe(0x43); // 'C'
    expect(dbf[32 + 16]).toBe(40); // フィールド長
  });

  it("レコード数1を持つ", () => {
    const { dbf } = buildShapefileParts(transect);
    const view = new DataView(dbf.buffer);
    expect(view.getUint32(4, true)).toBe(1);
  });

  it("レコードの値が左詰め・空白パディングされる", () => {
    const { dbf } = buildShapefileParts(transect, "transect");
    const recordStart = 65 + 1; // ヘッダ(65) + 削除フラグ(1)
    const value = new TextDecoder().decode(dbf.slice(recordStart, recordStart + 40));
    expect(value).toBe("transect" + " ".repeat(40 - "transect".length));
  });
});

describe("buildShapefileParts (.prj)", () => {
  it("WGS84を表すWKT文字列を含む", () => {
    const { prj } = buildShapefileParts(transect);
    const wkt = new TextDecoder().decode(prj);
    expect(wkt).toContain("GCS_WGS_1984");
    expect(wkt).toContain("WGS_1984");
  });
});

/** テスト用の最小限のZIP読み取り(セントラルディレクトリからエントリ一覧を取得する)。 */
function readZipEntryNames(zip: Uint8Array): { name: string; compressionMethod: number }[] {
  const view = new DataView(zip.buffer);
  // End of Central Directory(末尾22バイト、コメントなし前提)を探す
  const eocdOffset = zip.length - 22;
  expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  const entries: { name: string; compressionMethod: number }[] = [];
  let pos = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    expect(view.getUint32(pos, true)).toBe(0x02014b50);
    const compressionMethod = view.getUint16(pos + 10, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const nameBytes = zip.slice(pos + 46, pos + 46 + nameLength);
    entries.push({ name: new TextDecoder().decode(nameBytes), compressionMethod });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

describe("buildTransectShapefileZip", () => {
  it("ローカルファイルヘッダのシグネチャを持つ", () => {
    const zip = buildTransectShapefileZip(transect);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
  });

  it("4つのファイル(.shp/.shx/.dbf/.prj)を圧縮方式「格納」で含む", () => {
    const zip = buildTransectShapefileZip(transect);
    const entries = readZipEntryNames(zip);
    expect(entries.map((e) => e.name).sort()).toEqual([
      "transect.dbf",
      "transect.prj",
      "transect.shp",
      "transect.shx",
    ]);
    for (const entry of entries) {
      expect(entry.compressionMethod).toBe(0);
    }
  });

  it("nameを指定すると.dbfの値に反映される", () => {
    const zip = buildTransectShapefileZip(transect, "mysection");
    // ZIP内のバイト列を単純に検索して値が含まれることを確認する(格納方式=無圧縮のため可能)
    const text = new TextDecoder("latin1").decode(zip);
    expect(text).toContain("mysection");
  });
});

describe("buildTransectShapefileFilename", () => {
  it("拡張子.zipのファイル名を生成する", () => {
    expect(buildTransectShapefileFilename()).toMatch(/^transect_.+\.zip$/);
  });

  it("prefixを指定できる", () => {
    expect(buildTransectShapefileFilename("line")).toMatch(/^line_.+\.zip$/);
  });
});
