import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemDatasetConfig } from "../../src/types";

const NO_DATA = -9999;

/**
 * geotiff.js の fromUrl() をモックし、10x10ピクセル(1ピクセル=0.5m)の
 * 疑似DEM(COG)を返す。バウンディングボックスは x:[0,5], y:[0,5]。タイルサイズは5x5px
 * (実際のCOGのBLOCKSIZEに相当)とし、10x10の範囲が2x2=4タイルに分割されるようにする。
 * 中央付近に一箇所NoDataセルを配置し、範囲外・欠損の双方を検証できるようにする。
 * readRasters() はタイル境界に一致したウィンドウで呼び出され、呼び出し回数を計測できるようにする
 * (sampleElevationsAlongLine がタイル単位でまとめて読み込むことを検証するため)。
 */
function buildGeotiffMock() {
  let readRastersCallCount = 0;

  function makeFakeImage() {
    const width = 10;
    const height = 10;
    const tileWidth = 5;
    const tileHeight = 5;
    const minX = 0;
    const minY = 0;
    const maxX = 5;
    const maxY = 5;

    // 行(row)ごとの標高値。row 0 が北端(maxY側)。
    const grid: number[][] = Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, col) => 10 + row * 10 + col),
    );
    grid[3][4] = NO_DATA;

    return {
      getBoundingBox: () => [minX, minY, maxX, maxY],
      getWidth: () => width,
      getHeight: () => height,
      getTileWidth: () => tileWidth,
      getTileHeight: () => tileHeight,
      getGDALNoData: () => NO_DATA,
      readRasters: async ({ window }: { window: [number, number, number, number] }) => {
        readRastersCallCount++;
        const [px0, py0, px1, py1] = window;
        const w = px1 - px0;
        const h = py1 - py0;
        const flat: number[] = new Array(w * h);
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            flat[row * w + col] = grid[py0 + row][px0 + col];
          }
        }
        return [flat] as unknown as Awaited<ReturnType<typeof Promise.resolve>>;
      },
    };
  }

  return {
    fromUrl: vi.fn(async () => ({ getImage: async () => makeFakeImage() })),
    __getReadRastersCallCount: () => readRastersCallCount,
    // vi.mock のファクトリはモジュールキャッシュがある限り使い回されるため(vi.resetModules()
    // だけでは再実行されない)、テストごとにカウンタを明示的にリセットできるようにする。
    __resetReadRastersCallCount: () => {
      readRastersCallCount = 0;
    },
  };
}

vi.mock("geotiff", () => buildGeotiffMock());

const dataset: DemDatasetConfig = {
  id: "test-dataset",
  label: "テスト用データセット",
  cogUrl: "https://example.com/fake.tif",
  crs: "EPSG:6675",
  resolutionM: 0.5,
  color: "#000000",
};

describe("sampleElevation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // demSource.ts はモジュール内にCOGメタデータのキャッシュ(Map)を持つため、
    // テストごとに独立させるためモジュールを再読込する。
    vi.resetModules();
  });

  it("データ範囲内の座標では標高値を返す", async () => {
    const { sampleElevation } = await import("../../src/geo/demSource");
    const value = await sampleElevation(dataset, { x: 0.1, y: 4.9 });
    // (0.1, 4.9) はピクセル(col=0, row=0)相当 -> grid[0][0] = 10
    expect(value).toBe(10);
  });

  it("データ範囲外の座標ではnullを返す", async () => {
    const { sampleElevation } = await import("../../src/geo/demSource");
    const value = await sampleElevation(dataset, { x: 100, y: 100 });
    expect(value).toBeNull();
  });

  it("NoDataセルではnullを返す", async () => {
    const { sampleElevation } = await import("../../src/geo/demSource");
    // grid[3][4] がNoData -> col=4, row=3 のピクセル範囲内の座標を計算
    // pixelWidth = pixelHeight = 0.5, px=4 -> x in [2.0, 2.5), py=3 -> y = maxY - (py+0.5)*pixelHeight = 5 - 1.75 = 3.25
    const value = await sampleElevation(dataset, { x: 2.1, y: 3.25 });
    expect(value).toBeNull();
  });

  it("同一データセットへの複数回呼び出しでCOGメタデータの再取得(fromUrl)を1回に抑える", async () => {
    const geotiff = await import("geotiff");
    const { sampleElevation } = await import("../../src/geo/demSource");
    await sampleElevation(dataset, { x: 0.1, y: 4.9 });
    await sampleElevation(dataset, { x: 0.6, y: 4.9 });
    expect(geotiff.fromUrl).toHaveBeenCalledTimes(1);
  });
});

describe("sampleElevationsAlongLine", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const geotiff = (await import("geotiff")) as unknown as {
      __resetReadRastersCallCount: () => void;
    };
    geotiff.__resetReadRastersCallCount();
  });

  it("複数点の標高値を、範囲内・NoData・範囲外が混在していても正しく返す", async () => {
    const { sampleElevationsAlongLine } = await import("../../src/geo/demSource");
    const points = [
      { x: 0.1, y: 4.9 }, // px=0,py=0 -> grid[0][0] = 10
      { x: 2.6, y: 4.9 }, // px=5,py=0 -> grid[0][5] = 15
      { x: 0.1, y: 2.4 }, // px=0,py=5 -> grid[5][0] = 60
      { x: 2.1, y: 3.25 }, // px=4,py=3 -> NoData -> null
      { x: 100, y: 100 }, // 範囲外 -> null
    ];

    const values = await sampleElevationsAlongLine(dataset, points);

    expect(values).toEqual([10, 15, 60, null, null]);
  });

  it("同一タイル内の複数点はreadRastersの呼び出しを1回に共有する(性能対応、research.md R2)", async () => {
    const geotiff = (await import("geotiff")) as unknown as {
      __getReadRastersCallCount: () => number;
    };
    const { sampleElevationsAlongLine } = await import("../../src/geo/demSource");

    // すべてタイル(0,0)(px0-4, py0-4)内の点。10回問い合わせても読込は1回だけのはず。
    const points = Array.from({ length: 10 }, (_, i) => ({ x: 0.1 + (i % 5) * 0.5, y: 4.9 }));
    await sampleElevationsAlongLine(dataset, points);

    expect(geotiff.__getReadRastersCallCount()).toBe(1);
  });

  it("測線が複数タイルにまたがる場合はタイルごとに読込むが、同一タイルは重複読込みしない", async () => {
    const geotiff = (await import("geotiff")) as unknown as {
      __getReadRastersCallCount: () => number;
    };
    const { sampleElevationsAlongLine } = await import("../../src/geo/demSource");

    const points = [
      { x: 1.1, y: 4.9 }, // px=2,py=0 -> タイル(0,0) -> grid[0][2]=12
      { x: 3.1, y: 4.9 }, // px=6,py=0 -> タイル(1,0) -> grid[0][6]=16
      { x: 3.9, y: 4.9 }, // px=7,py=0 -> タイル(1,0)(3.1と同じタイル) -> grid[0][7]=17
    ];

    const values = await sampleElevationsAlongLine(dataset, points);

    expect(values).toEqual([12, 16, 17]);
    // 触れたタイルは(0,0)と(1,0)の2つだけなので、読込は2回に収まる(点数の3回ではない)
    expect(geotiff.__getReadRastersCallCount()).toBe(2);
  });

  it("全点が範囲外の場合はreadRastersを呼ばずにnull配列を返す", async () => {
    const geotiff = (await import("geotiff")) as unknown as {
      __getReadRastersCallCount: () => number;
    };
    const { sampleElevationsAlongLine } = await import("../../src/geo/demSource");

    const values = await sampleElevationsAlongLine(dataset, [
      { x: 100, y: 100 },
      { x: -100, y: -100 },
    ]);

    expect(values).toEqual([null, null]);
    expect(geotiff.__getReadRastersCallCount()).toBe(0);
  });

  it("空配列を渡した場合は空配列を返す", async () => {
    const { sampleElevationsAlongLine } = await import("../../src/geo/demSource");
    const values = await sampleElevationsAlongLine(dataset, []);
    expect(values).toEqual([]);
  });
});
