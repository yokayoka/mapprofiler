import { describe, expect, it } from "vitest";
import type { CrossSectionProfile, DemDatasetConfig, ProfilePoint, TransectLine } from "../../src/types";
import { applyUpliftCorrection, buildUpliftCorrectedDatasetId } from "../../src/geo/upliftCorrection";

const line: TransectLine = {
  startLatLng: { lat: 37.4, lng: 136.9 },
  endLatLng: { lat: 37.4, lng: 136.91 },
  startXY: { x: 0, y: 0 },
  endXY: { x: 10, y: 0 },
  samplingIntervalM: 5,
};

const preEarthquake: DemDatasetConfig = {
  id: "pre-earthquake",
  label: { ja: "地震前", en: "Pre-earthquake" },
  cogUrl: "https://example.com/pre.tif",
  crs: "EPSG:6675",
  resolutionM: 1,
  color: "#4C72B0",
};

const postEarthquake: DemDatasetConfig = {
  id: "post-earthquake",
  label: { ja: "地震後", en: "Post-earthquake" },
  cogUrl: "https://example.com/post.tif",
  crs: "EPSG:6675",
  resolutionM: 1,
  color: "#DD8452",
};

function buildProfile(points: ProfilePoint[]): CrossSectionProfile {
  return {
    line,
    points,
    datasets: [preEarthquake, postEarthquake],
    visibleDatasetIds: new Set(["pre-earthquake", "post-earthquake"]),
    generatedAt: new Date(),
  };
}

describe("applyUpliftCorrection", () => {
  it("正の隆起量: ベースデータセットの値+隆起量が補正後系列に入る", () => {
    const profile = buildProfile([
      { distanceM: 0, elevationByDataset: { "pre-earthquake": 100, "post-earthquake": 101.5 } },
      { distanceM: 5, elevationByDataset: { "pre-earthquake": 110, "post-earthquake": 111.5 } },
    ]);

    const result = applyUpliftCorrection(profile, {
      baseDatasetId: "pre-earthquake",
      upliftM: 1.5,
      enabled: true,
    });

    const correctedId = buildUpliftCorrectedDatasetId("pre-earthquake");
    expect(result.points[0].elevationByDataset[correctedId]).toBe(101.5);
    expect(result.points[1].elevationByDataset[correctedId]).toBe(111.5);
  });

  it("負の隆起量(沈降): 減算になる", () => {
    const profile = buildProfile([
      { distanceM: 0, elevationByDataset: { "pre-earthquake": 100, "post-earthquake": 98 } },
    ]);

    const result = applyUpliftCorrection(profile, {
      baseDatasetId: "pre-earthquake",
      upliftM: -2,
      enabled: true,
    });

    const correctedId = buildUpliftCorrectedDatasetId("pre-earthquake");
    expect(result.points[0].elevationByDataset[correctedId]).toBe(98);
  });

  it("隆起量0: 補正後系列は元の値と一致する", () => {
    const profile = buildProfile([
      { distanceM: 0, elevationByDataset: { "pre-earthquake": 100, "post-earthquake": 100 } },
    ]);

    const result = applyUpliftCorrection(profile, {
      baseDatasetId: "pre-earthquake",
      upliftM: 0,
      enabled: true,
    });

    const correctedId = buildUpliftCorrectedDatasetId("pre-earthquake");
    expect(result.points[0].elevationByDataset[correctedId]).toBe(100);
  });

  it("ベースデータセットがNoData(null)の点では、補正後系列もnullのままになる", () => {
    const profile = buildProfile([
      { distanceM: 0, elevationByDataset: { "pre-earthquake": null, "post-earthquake": 100 } },
    ]);

    const result = applyUpliftCorrection(profile, {
      baseDatasetId: "pre-earthquake",
      upliftM: 2,
      enabled: true,
    });

    const correctedId = buildUpliftCorrectedDatasetId("pre-earthquake");
    expect(result.points[0].elevationByDataset[correctedId]).toBeNull();
  });

  it("enabled: false の場合、profileが変更されずそのまま返る", () => {
    const profile = buildProfile([
      { distanceM: 0, elevationByDataset: { "pre-earthquake": 100, "post-earthquake": 100 } },
    ]);

    const result = applyUpliftCorrection(profile, {
      baseDatasetId: "pre-earthquake",
      upliftM: 2,
      enabled: false,
    });

    expect(result).toBe(profile);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "upliftMが%sの場合、profileが変更されずそのまま返る",
    (invalidUpliftM) => {
      const profile = buildProfile([
        { distanceM: 0, elevationByDataset: { "pre-earthquake": 100, "post-earthquake": 100 } },
      ]);

      const result = applyUpliftCorrection(profile, {
        baseDatasetId: "pre-earthquake",
        upliftM: invalidUpliftM,
        enabled: true,
      });

      expect(result).toBe(profile);
    },
  );

  it("ベースデータセットが存在しない場合、profileが変更されずそのまま返る", () => {
    const profile = buildProfile([
      { distanceM: 0, elevationByDataset: { "pre-earthquake": 100, "post-earthquake": 100 } },
    ]);

    const result = applyUpliftCorrection(profile, {
      baseDatasetId: "does-not-exist",
      upliftM: 2,
      enabled: true,
    });

    expect(result).toBe(profile);
  });

  it("元のprofile・pointsを破壊的に変更しない", () => {
    const profile = buildProfile([
      { distanceM: 0, elevationByDataset: { "pre-earthquake": 100, "post-earthquake": 100 } },
    ]);
    const originalPoint = profile.points[0];
    const originalElevationByDataset = originalPoint.elevationByDataset;

    applyUpliftCorrection(profile, { baseDatasetId: "pre-earthquake", upliftM: 3, enabled: true });

    expect(profile.points[0]).toBe(originalPoint);
    expect(profile.points[0].elevationByDataset).toBe(originalElevationByDataset);
    expect(Object.keys(originalElevationByDataset)).toEqual(["pre-earthquake", "post-earthquake"]);
  });

  it("補正後データセットがdatasets・visibleDatasetIdsに追加され、ラベルに隆起量が含まれる", () => {
    const profile = buildProfile([
      { distanceM: 0, elevationByDataset: { "pre-earthquake": 100, "post-earthquake": 100 } },
    ]);

    const result = applyUpliftCorrection(profile, {
      baseDatasetId: "pre-earthquake",
      upliftM: 1.5,
      enabled: true,
    });

    const correctedId = buildUpliftCorrectedDatasetId("pre-earthquake");
    const correctedDataset = result.datasets.find((d) => d.id === correctedId);
    expect(correctedDataset).toBeDefined();
    expect(correctedDataset?.label.ja).toContain("+1.5");
    expect(correctedDataset?.label.en).toContain("+1.5");
    expect(result.visibleDatasetIds.has(correctedId)).toBe(true);
  });
});
