import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemDatasetConfig, TransectLine } from "../../src/types";

vi.mock("../../src/geo/demSource", () => ({
  sampleElevationsAlongLine: vi.fn(
    async (dataset: DemDatasetConfig, points: Array<{ x: number; y: number }>) => {
      // xの値に応じて標高を決定的に返す疑似DEM。x=999は常にNoData。
      // dataset.id==="ds2" かつ x===5 の区間だけNoDataにし、時期ごとの欠損混在を再現する。
      return points.map((xy) => {
        if (xy.x === 999) return null;
        if (dataset.id === "ds2" && xy.x === 5) return null;
        return 100 + xy.x;
      });
    },
  ),
}));

const line: TransectLine = {
  startLatLng: { lat: 37.4, lng: 136.9 },
  endLatLng: { lat: 37.4, lng: 136.91 },
  startXY: { x: 0, y: 0 },
  endXY: { x: 10, y: 0 },
  samplingIntervalM: 5,
};

const dataset: DemDatasetConfig = {
  id: "ds1",
  label: { ja: "テスト時期1", en: "Test period 1" },
  cogUrl: "https://example.com/ds1.tif",
  crs: "EPSG:6675",
  resolutionM: 0.5,
  color: "#111111",
};

describe("generateProfile (単一データセット)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("測線・サンプリング間隔から距離順のProfilePoint配列を生成する", async () => {
    const { generateProfile } = await import("../../src/geo/profileSampler");
    const profile = await generateProfile(line, [dataset]);

    expect(profile.points.map((p) => p.distanceM)).toEqual([0, 5, 10]);
    expect(profile.points[0].elevationByDataset["ds1"]).toBe(100);
    expect(profile.points[1].elevationByDataset["ds1"]).toBe(105);
    expect(profile.points[2].elevationByDataset["ds1"]).toBe(110);
  });

  it("生成結果にline・datasets・visibleDatasetIdsが含まれる", async () => {
    const { generateProfile } = await import("../../src/geo/profileSampler");
    const profile = await generateProfile(line, [dataset]);

    expect(profile.line).toBe(line);
    expect(profile.datasets).toEqual([dataset]);
    expect(profile.visibleDatasetIds.has("ds1")).toBe(true);
  });

  it("DEM範囲外(NoData)の場合はnullを保持する", async () => {
    // 終点をNoData扱い(x=999)にすることで、範囲内/範囲外が混在する測線を再現する
    const partialLine: TransectLine = { ...line, endXY: { x: 999, y: 0 } };

    const { generateProfile } = await import("../../src/geo/profileSampler");
    const profile = await generateProfile(partialLine, [dataset]);
    const last = profile.points[profile.points.length - 1];
    expect(last.elevationByDataset["ds1"]).toBeNull();
  });
});

describe("generateProfile (複数データセット, FR-006)", () => {
  const dataset2: DemDatasetConfig = {
    id: "ds2",
    label: { ja: "テスト時期2", en: "Test period 2" },
    cogUrl: "https://example.com/ds2.tif",
    crs: "EPSG:6675",
    resolutionM: 0.5,
    color: "#222222",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("各サンプル点にすべてのデータセットの標高が格納される", async () => {
    const { generateProfile } = await import("../../src/geo/profileSampler");
    const profile = await generateProfile(line, [dataset, dataset2]);

    for (const point of profile.points) {
      expect(Object.keys(point.elevationByDataset).sort()).toEqual(["ds1", "ds2"]);
    }
    expect(profile.datasets.map((d) => d.id)).toEqual(["ds1", "ds2"]);
    expect(profile.visibleDatasetIds).toEqual(new Set(["ds1", "ds2"]));
  });

  it("一部データセットのみ区間欠損があっても、他データセットの値は影響を受けない(欠損混在)", async () => {
    const { generateProfile } = await import("../../src/geo/profileSampler");
    const profile = await generateProfile(line, [dataset, dataset2]);

    const midPoint = profile.points.find((p) => p.distanceM === 5)!;
    expect(midPoint.elevationByDataset["ds1"]).toBe(105);
    expect(midPoint.elevationByDataset["ds2"]).toBeNull();

    const startPoint = profile.points.find((p) => p.distanceM === 0)!;
    expect(startPoint.elevationByDataset["ds1"]).toBe(100);
    expect(startPoint.elevationByDataset["ds2"]).toBe(100);
  });
});
