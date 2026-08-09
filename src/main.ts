import "leaflet/dist/leaflet.css";
import "./style.css";
import { initMapView } from "./map/mapView";
import { TransectDraw, type TransectPoints } from "./map/transectDraw";
import { generateProfile } from "./geo/profileSampler";
import { DEFAULT_LINE_WIDTH_PX, ProfileChart } from "./profile/profileChart";
import { buildProfileFilename, downloadCanvasAsPng } from "./profile/profileExport";
import { buildMapFilename, downloadDataUrl, exportMapAsPngDataUrl } from "./map/mapExport";
import { demDatasets } from "./config/datasets";
import type { CrossSectionProfile, TransectLine } from "./types";

const DEFAULT_SAMPLING_INTERVAL_M = 1;

// 測線長・サンプル点数の確認閾値(spec.md Edge Cases / Assumptions)。運用状況に応じて調整可能。
const CONFIRM_LENGTH_THRESHOLD_M = 10_000;
const CONFIRM_SAMPLE_COUNT_THRESHOLD = 20_000;

function estimateSampleCount(lengthM: number, samplingIntervalM: number): number {
  return Math.floor(lengthM / samplingIntervalM) + 1;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="app-header">
    <h1>能登半島DEM断面図ビューア</h1>
  </header>
  <main class="app-main">
    <div id="map"></div>
    <aside id="controls" class="controls">
      <p>地図上で2点クリックして測線(始点・終点)を指定してください。</p>
      <label for="sampling-interval">サンプリング間隔 (m)</label>
      <input id="sampling-interval" type="number" min="0" step="0.1" value="${DEFAULT_SAMPLING_INTERVAL_M}" />
      <button id="generate-btn" type="button" disabled>断面図を作成</button>
      <p id="form-error" class="field-error" role="alert" hidden></p>
      <button id="download-map-btn" type="button" disabled>地図をPNGでダウンロード</button>
      <p id="map-export-error" class="field-error" role="alert" hidden></p>
      <div class="dataset-style-list">
        <p class="dataset-style-heading">断面図の線の色・太さ</p>
        ${demDatasets
          .map(
            (dataset) => `
          <div class="dataset-style-row" data-dataset-id="${dataset.id}">
            <span class="dataset-style-label">${dataset.label}</span>
            <input
              type="color"
              class="dataset-color-input"
              value="${dataset.color}"
              aria-label="${dataset.label}の線の色"
            />
            <input
              type="number"
              class="dataset-width-input"
              min="1"
              max="10"
              step="1"
              value="${DEFAULT_LINE_WIDTH_PX}"
              aria-label="${dataset.label}の線の太さ(px)"
            />
          </div>`,
          )
          .join("")}
        <label class="show-points-toggle">
          <input id="show-points-toggle" type="checkbox" checked />
          標高サンプル点を表示する
        </label>
      </div>
    </aside>
  </main>
  <section id="profile-section" class="profile-section">
    <canvas id="profile-canvas"></canvas>
    <button id="download-profile-btn" type="button" disabled>断面図をPNGでダウンロード</button>
  </section>
`;

const { map } = initMapView("map");
const transectDraw = new TransectDraw(map);
const profileChart = new ProfileChart(
  document.querySelector<HTMLCanvasElement>("#profile-canvas")!,
);

const generateBtn = document.querySelector<HTMLButtonElement>("#generate-btn")!;
const samplingIntervalInput = document.querySelector<HTMLInputElement>("#sampling-interval")!;
const formError = document.querySelector<HTMLParagraphElement>("#form-error")!;
const downloadProfileBtn = document.querySelector<HTMLButtonElement>("#download-profile-btn")!;
const downloadMapBtn = document.querySelector<HTMLButtonElement>("#download-map-btn")!;
const mapExportError = document.querySelector<HTMLParagraphElement>("#map-export-error")!;
const mapContainer = document.querySelector<HTMLDivElement>("#map")!;

downloadProfileBtn.addEventListener("click", () => {
  downloadCanvasAsPng(profileChart.getCanvas(), buildProfileFilename());
});

downloadMapBtn.addEventListener("click", () => {
  void handleDownloadMap();
});

document.querySelectorAll<HTMLDivElement>(".dataset-style-row").forEach((row) => {
  const datasetId = row.dataset.datasetId!;
  const colorInput = row.querySelector<HTMLInputElement>(".dataset-color-input")!;
  const widthInput = row.querySelector<HTMLInputElement>(".dataset-width-input")!;

  const applyStyle = () => {
    const lineWidthPx = Number(widthInput.value);
    profileChart.setDatasetStyle(datasetId, {
      color: colorInput.value,
      lineWidthPx: lineWidthPx > 0 ? lineWidthPx : DEFAULT_LINE_WIDTH_PX,
    });
  };

  colorInput.addEventListener("input", applyStyle);
  widthInput.addEventListener("input", applyStyle);
  applyStyle();
});

const showPointsToggle = document.querySelector<HTMLInputElement>("#show-points-toggle")!;
showPointsToggle.addEventListener("change", () => {
  profileChart.setShowPoints(showPointsToggle.checked);
});

async function handleDownloadMap(): Promise<void> {
  mapExportError.hidden = true;
  downloadMapBtn.disabled = true;
  try {
    const dataUrl = await exportMapAsPngDataUrl(mapContainer);
    downloadDataUrl(dataUrl, buildMapFilename());
  } catch (error) {
    mapExportError.textContent =
      error instanceof Error ? error.message : "地図のPNG化に失敗しました。";
    mapExportError.hidden = false;
  } finally {
    downloadMapBtn.disabled = false;
  }
}

let currentTransect: TransectPoints | null = null;

transectDraw.onChange((transect) => {
  currentTransect = transect;
  generateBtn.disabled = transect === null;
  downloadMapBtn.disabled = transect === null;
  clearFormError();
});

generateBtn.addEventListener("click", () => {
  void handleGenerateProfile();
});

async function handleGenerateProfile(): Promise<void> {
  clearFormError();

  if (!currentTransect) {
    showFormError("地図上で測線(始点・終点)を指定してください。");
    return;
  }

  const samplingIntervalM = Number(samplingIntervalInput.value);
  if (!(samplingIntervalM > 0)) {
    showFormError("サンプリング間隔は0より大きい数値を指定してください。");
    return;
  }

  const line: TransectLine = {
    startLatLng: currentTransect.startLatLng,
    endLatLng: currentTransect.endLatLng,
    startXY: currentTransect.startXY,
    endXY: currentTransect.endXY,
    samplingIntervalM,
  };

  const lengthM = Math.hypot(line.endXY.x - line.startXY.x, line.endXY.y - line.startXY.y);
  const estimatedSampleCount = estimateSampleCount(lengthM, samplingIntervalM);
  if (lengthM > CONFIRM_LENGTH_THRESHOLD_M || estimatedSampleCount > CONFIRM_SAMPLE_COUNT_THRESHOLD) {
    const proceed = window.confirm(
      `測線長は約${Math.round(lengthM)}m、推定サンプル点数は約${estimatedSampleCount}点です。` +
        `処理に時間がかかる可能性があります。続行しますか?`,
    );
    if (!proceed) return;
  }

  generateBtn.disabled = true;
  try {
    const profile: CrossSectionProfile = await generateProfile(line, demDatasets);
    profileChart.render(profile);
    downloadProfileBtn.disabled = false;
  } catch (error) {
    downloadProfileBtn.disabled = true;
    showFormError(describeProfileError(error));
  } finally {
    generateBtn.disabled = false;
  }
}

function describeProfileError(error: unknown): string {
  if (error instanceof Error && error.message.includes("must not be the same location")) {
    return "始点と終点が同じ地点です。異なる2点をクリックし直してください。";
  }
  return "断面図の作成に失敗しました。測線やDEM設定を確認してください。";
}

function showFormError(message: string): void {
  formError.textContent = message;
  formError.hidden = false;
}

function clearFormError(): void {
  formError.hidden = true;
  formError.textContent = "";
}
