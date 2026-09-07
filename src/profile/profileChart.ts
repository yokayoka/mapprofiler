import {
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import type { CrossSectionProfile, DatasetLineStyle } from "../types";
import { pick, t } from "../i18n/i18n";

Chart.register(LineController, LineElement, PointElement, LinearScale, Legend, Tooltip, Title);

/** 系列スタイルが未指定の場合の既定の線の太さ(px)。 */
export const DEFAULT_LINE_WIDTH_PX = 2;

/** 標高サンプル点(dot)を表示する場合の既定の半径(px)。 */
const POINT_RADIUS_PX = 2;

/** 断面図のフォントサイズ(px)が未指定の場合の既定値。 */
export const DEFAULT_FONT_SIZE_PX = 12;

/**
 * 断面図(距離-標高グラフ)の描画。複数時期のDEMを色分けした系列として重ね、
 * 凡例クリックで系列の表示/非表示を切り替えられる(Chart.js既定の凡例トグル動作を利用、FR-014)。
 * 標高が null(データ欠損)の点では線を途切れさせる(`spanGaps: false`、FR-012)。
 * 系列ごとの線の色・太さはユーザーが `setDatasetStyle()` で変更できる。
 */
export class ProfileChart {
  private readonly chart: Chart<"line">;
  private readonly styles = new Map<string, DatasetLineStyle>();
  private lastProfile: CrossSectionProfile | null = null;
  private showPoints = true;

  constructor(canvas: HTMLCanvasElement) {
    this.chart = new Chart(canvas, {
      type: "line",
      data: { datasets: [] },
      options: {
        responsive: true,
        animation: false,
        parsing: false,
        spanGaps: false,
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: t("chartAxisDistance"), font: { size: DEFAULT_FONT_SIZE_PX } },
            ticks: { font: { size: DEFAULT_FONT_SIZE_PX } },
          },
          y: {
            title: { display: true, text: t("chartAxisElevation"), font: { size: DEFAULT_FONT_SIZE_PX } },
            ticks: { font: { size: DEFAULT_FONT_SIZE_PX } },
          },
        },
        plugins: {
          legend: { display: true, position: "top", labels: { font: { size: DEFAULT_FONT_SIZE_PX } } },
          title: { display: false, font: { size: DEFAULT_FONT_SIZE_PX } },
          tooltip: { titleFont: { size: DEFAULT_FONT_SIZE_PX }, bodyFont: { size: DEFAULT_FONT_SIZE_PX } },
        },
      },
    });
  }

  render(profile: CrossSectionProfile): void {
    this.lastProfile = profile;
    this.chart.data.datasets = profile.datasets.map((dataset) => {
      const style = this.styles.get(dataset.id) ?? {
        color: dataset.color,
        lineWidthPx: DEFAULT_LINE_WIDTH_PX,
      };
      return {
        label: pick(dataset.label),
        borderColor: style.color,
        backgroundColor: style.color,
        borderWidth: style.lineWidthPx,
        pointRadius: this.showPoints ? POINT_RADIUS_PX : 0,
        pointHoverRadius: this.showPoints ? POINT_RADIUS_PX + 1 : 0,
        data: profile.points.map((p) => ({
          x: p.distanceM,
          y: p.elevationByDataset[dataset.id] ?? null,
        })),
        spanGaps: false,
        hidden: !profile.visibleDatasetIds.has(dataset.id),
      };
    });
    this.chart.update();
  }

  /** 系列(データセット)の線の色・太さを変更する。既に断面図が描画済みなら即座に再描画する。 */
  setDatasetStyle(datasetId: string, style: DatasetLineStyle): void {
    this.styles.set(datasetId, style);
    if (this.lastProfile) {
      this.render(this.lastProfile);
    }
  }

  /** 標高サンプル点(dot)の表示/非表示を切り替える。既に断面図が描画済みなら即座に再描画する。 */
  setShowPoints(showPoints: boolean): void {
    this.showPoints = showPoints;
    if (this.lastProfile) {
      this.render(this.lastProfile);
    }
  }

  /**
   * グラフ上部のタイトルを設定する。`null`でタイトルを非表示にする。
   * 隆起補正(003-uplift-correction)を適用したことを明示するために使用する。
   */
  setTitle(text: string | null): void {
    const titleOptions = this.chart.options.plugins?.title;
    if (!titleOptions) return;
    titleOptions.display = text !== null;
    if (text !== null) {
      titleOptions.text = text;
    }
    this.chart.update();
  }

  /** 断面図の軸ラベル・目盛り・凡例・タイトルのフォントサイズ(px)を一括で変更する。 */
  setFontSizePx(fontSizePx: number): void {
    const { options } = this.chart;
    const xTitle = options.scales?.x?.title;
    const xTicks = options.scales?.x?.ticks;
    const yTitle = options.scales?.y?.title;
    const yTicks = options.scales?.y?.ticks;
    const legendLabels = options.plugins?.legend?.labels;
    const titlePlugin = options.plugins?.title;
    const tooltip = options.plugins?.tooltip;

    if (xTitle) xTitle.font = { size: fontSizePx };
    if (xTicks) xTicks.font = { size: fontSizePx };
    if (yTitle) yTitle.font = { size: fontSizePx };
    if (yTicks) yTicks.font = { size: fontSizePx };
    if (legendLabels) legendLabels.font = { size: fontSizePx };
    if (titlePlugin) titlePlugin.font = { size: fontSizePx };
    if (tooltip) {
      tooltip.titleFont = { size: fontSizePx };
      tooltip.bodyFont = { size: fontSizePx };
    }

    this.chart.update();
  }

  clear(): void {
    this.lastProfile = null;
    this.chart.data.datasets = [];
    this.chart.update();
  }

  getCanvas(): HTMLCanvasElement {
    return this.chart.canvas;
  }
}
