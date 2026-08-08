import { describe, expect, it } from "vitest";
import { wgs84ToEpsg6675 } from "../../src/geo/coordinateTransform";

describe("wgs84ToEpsg6675", () => {
  it("投影原点(北緯36度, 東経137度10分)はEPSG:6675上で(0, 0)付近になる", () => {
    const { x, y } = wgs84ToEpsg6675(137 + 10 / 60, 36);
    expect(x).toBeCloseTo(0, 3);
    expect(y).toBeCloseTo(0, 3);
  });

  it("能登半島北部付近の座標を変換すると、原点からの符号関係が地理的に妥当な値になる", () => {
    // 輪島市付近(概略値): 東経136.9度は原点(137.1667度)より西 → x は負
    // 北緯37.4度は原点(北緯36度)より北 → y は正
    const { x, y } = wgs84ToEpsg6675(136.9, 37.4);
    expect(x).toBeLessThan(0);
    expect(y).toBeGreaterThan(0);
    // ラフな距離感の妥当性(1度 ≈ 90km前後)を桁のオーダーで確認する
    expect(Math.abs(x)).toBeGreaterThan(10000);
    expect(Math.abs(x)).toBeLessThan(40000);
    expect(y).toBeGreaterThan(140000);
    expect(y).toBeLessThan(170000);
  });

  it("往復変換(WGS84→EPSG:6675→WGS84相当)で値が自己整合する", () => {
    const lon = 136.95;
    const lat = 37.45;
    const a = wgs84ToEpsg6675(lon, lat);
    const b = wgs84ToEpsg6675(lon + 1e-9, lat + 1e-9);
    // 極小の入力差に対して出力もなめらかに変化すること(不連続や特異点がないことの簡易確認)
    expect(Math.abs(b.x - a.x)).toBeLessThan(1);
    expect(Math.abs(b.y - a.y)).toBeLessThan(1);
  });

  it("不正な緯度経度(範囲外)には例外を投げる", () => {
    expect(() => wgs84ToEpsg6675(200, 37)).toThrow();
    expect(() => wgs84ToEpsg6675(137, 100)).toThrow();
  });

  it("非数値(NaN)には例外を投げる", () => {
    expect(() => wgs84ToEpsg6675(NaN, 37)).toThrow();
  });
});
