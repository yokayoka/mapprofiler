import { describe, expect, it } from "vitest";
import { buildSamplePoints } from "../../src/geo/profileSampler";

describe("buildSamplePoints", () => {
  it("端点(始点=distance 0, 終点=測線長)を必ず含む", () => {
    const points = buildSamplePoints({
      startXY: { x: 0, y: 0 },
      endXY: { x: 10, y: 0 },
      samplingIntervalM: 3,
    });
    expect(points[0].distanceM).toBe(0);
    expect(points[points.length - 1].distanceM).toBeCloseTo(10, 9);
    expect(points[points.length - 1].xy.x).toBeCloseTo(10, 9);
  });

  it("距離が昇順であること", () => {
    const points = buildSamplePoints({
      startXY: { x: 0, y: 0 },
      endXY: { x: 20, y: 0 },
      samplingIntervalM: 4,
    });
    for (let i = 1; i < points.length; i++) {
      expect(points[i].distanceM).toBeGreaterThan(points[i - 1].distanceM);
    }
  });

  it("始点=終点(距離ゼロ)の場合は例外を投げる", () => {
    expect(() =>
      buildSamplePoints({
        startXY: { x: 5, y: 5 },
        endXY: { x: 5, y: 5 },
        samplingIntervalM: 1,
      }),
    ).toThrow();
  });

  it("サンプリング間隔が0以下の場合は例外を投げる", () => {
    expect(() =>
      buildSamplePoints({
        startXY: { x: 0, y: 0 },
        endXY: { x: 10, y: 0 },
        samplingIntervalM: 0,
      }),
    ).toThrow();
  });

  it("DEM解像度(0.5m)より小さいサンプリング間隔でも正しい点数を生成する", () => {
    const points = buildSamplePoints({
      startXY: { x: 0, y: 0 },
      endXY: { x: 1, y: 0 },
      samplingIntervalM: 0.1,
    });
    // 0, 0.1, ..., 0.9, 1.0 の11点
    expect(points.length).toBe(11);
    expect(points.map((p) => Math.round(p.distanceM * 10) / 10)).toEqual([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
    ]);
  });

  it("斜めの測線でxy座標が線形補間されること", () => {
    const points = buildSamplePoints({
      startXY: { x: 0, y: 0 },
      endXY: { x: 6, y: 8 }, // 長さ10
      samplingIntervalM: 5,
    });
    expect(points[0].xy).toEqual({ x: 0, y: 0 });
    // distanceM=5 -> 中間点 (3, 4)
    const mid = points.find((p) => Math.abs(p.distanceM - 5) < 1e-9)!;
    expect(mid.xy.x).toBeCloseTo(3, 9);
    expect(mid.xy.y).toBeCloseTo(4, 9);
    const last = points[points.length - 1];
    expect(last.xy.x).toBeCloseTo(6, 9);
    expect(last.xy.y).toBeCloseTo(8, 9);
  });
});
