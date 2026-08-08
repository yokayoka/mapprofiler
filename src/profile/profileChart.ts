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
import type { CrossSectionProfile } from "../types";

Chart.register(LineController, LineElement, PointElement, LinearScale, Legend, Tooltip, Title);

/**
 * 断面図(距離-標高グラフ)の描画。複数時期のDEMを色分けした系列として重ね、
 * 凡例クリックで系列の表示/非表示を切り替えられる(Chart.js既定の凡例トグル動作を利用、FR-014)。
 * 標高が null(データ欠損)の点では線を途切れさせる(`spanGaps: false`、FR-012)。
 */
export class ProfileChart {
  private readonly chart: Chart<"line">;

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
            title: { display: true, text: "始点からの距離 (m)" },
          },
          y: {
            title: { display: true, text: "標高 (m)" },
          },
        },
        plugins: {
          legend: { display: true, position: "top" },
          title: { display: false },
        },
      },
    });
  }

  render(profile: CrossSectionProfile): void {
    this.chart.data.datasets = profile.datasets.map((dataset) => ({
      label: dataset.label,
      borderColor: dataset.color,
      backgroundColor: dataset.color,
      data: profile.points.map((p) => ({
        x: p.distanceM,
        y: p.elevationByDataset[dataset.id] ?? null,
      })),
      spanGaps: false,
      hidden: !profile.visibleDatasetIds.has(dataset.id),
    }));
    this.chart.update();
  }

  clear(): void {
    this.chart.data.datasets = [];
    this.chart.update();
  }

  getCanvas(): HTMLCanvasElement {
    return this.chart.canvas;
  }
}
