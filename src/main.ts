import "leaflet/dist/leaflet.css";
import "./style.css";
import { initMapView } from "./map/mapView";
import { TransectDraw, type TransectPoints } from "./map/transectDraw";
import { generateProfile } from "./geo/profileSampler";
import {
  applyUpliftCorrection,
  buildUpliftCorrectedDatasetId,
  formatSignedMeters,
  UPLIFT_CORRECTED_DEFAULT_COLOR,
} from "./geo/upliftCorrection";
import { DEFAULT_FONT_SIZE_PX, DEFAULT_LINE_WIDTH_PX, ProfileChart } from "./profile/profileChart";
import { buildProfileFilename, downloadCanvasAsPng } from "./profile/profileExport";
import { buildMapFilename, downloadDataUrl, exportMapAsPngDataUrl } from "./map/mapExport";
import { buildTransectKmlDataUrl, buildTransectKmlFilename } from "./map/transectExport";
import {
  buildTransectShapefileFilename,
  buildTransectShapefileZip,
  downloadBlob,
} from "./map/shapefileExport";
import { demDatasets } from "./config/datasets";
import type { CrossSectionProfile, TransectLine, UpliftCorrectionSettings } from "./types";
import { currentLang, pick, switchLang, t } from "./i18n/i18n";

/** 隆起補正の対象データセット(spec.md Assumptions: 地震前データセットのみを対象とする)。 */
const UPLIFT_BASE_DATASET_ID = "pre-earthquake";

document.documentElement.lang = currentLang;
document.title = t("appTitle");

const DEFAULT_SAMPLING_INTERVAL_M = 1;

// 測線長・サンプル点数の確認閾値(spec.md Edge Cases / Assumptions)。運用状況に応じて調整可能。
const CONFIRM_LENGTH_THRESHOLD_M = 10_000;
const CONFIRM_SAMPLE_COUNT_THRESHOLD = 20_000;

function estimateSampleCount(lengthM: number, samplingIntervalM: number): number {
  return Math.floor(lengthM / samplingIntervalM) + 1;
}

const otherLang = currentLang === "ja" ? "en" : "ja";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="app-header">
    <h1>${t("appTitle")}</h1>
    <button id="lang-switch-btn" type="button" class="lang-switch-btn">${t("langSwitchLabel")}</button>
  </header>
  <main class="app-main">
    <div id="map"></div>
    <aside id="controls" class="controls">
      <p>${t("instructionText")}</p>
      <label for="sampling-interval">${t("samplingIntervalLabel")}</label>
      <input id="sampling-interval" type="number" min="0" step="0.1" value="${DEFAULT_SAMPLING_INTERVAL_M}" />
      <button id="generate-btn" type="button" disabled>${t("generateButton")}</button>
      <p id="form-error" class="field-error" role="alert" hidden></p>
      <button id="download-map-btn" type="button" disabled>${t("downloadMapButton")}</button>
      <p id="map-export-error" class="field-error" role="alert" hidden></p>
      <button id="download-kml-btn" type="button" disabled>${t("downloadKmlButton")}</button>
      <button id="download-shapefile-btn" type="button" disabled>${t("downloadShapefileButton")}</button>
      <div class="dataset-style-list">
        <p class="dataset-style-heading">${t("datasetStyleHeading")}</p>
        ${demDatasets
          .map((dataset) => {
            const label = pick(dataset.label);
            return `
          <div class="dataset-style-row" data-dataset-id="${dataset.id}">
            <span class="dataset-style-label">${label}</span>
            <input
              type="color"
              class="dataset-color-input"
              value="${dataset.color}"
              aria-label="${t("datasetColorAriaLabel", { label })}"
            />
            <input
              type="number"
              class="dataset-width-input"
              min="1"
              max="10"
              step="1"
              value="${DEFAULT_LINE_WIDTH_PX}"
              aria-label="${t("datasetWidthAriaLabel", { label })}"
            />
          </div>`;
          })
          .join("")}
        <label class="show-points-toggle">
          <input id="show-points-toggle" type="checkbox" checked />
          ${t("showPointsToggleLabel")}
        </label>
        <label for="font-size-input">${t("fontSizeLabel")}</label>
        <input
          id="font-size-input"
          type="number"
          min="6"
          max="32"
          step="1"
          value="${DEFAULT_FONT_SIZE_PX}"
        />
      </div>
      <div class="uplift-section">
        <p class="dataset-style-heading">${t("upliftHeading")}</p>
        <label for="uplift-value">${t("upliftValueLabel")}</label>
        <input id="uplift-value" type="number" step="0.1" value="0" />
        <label class="show-points-toggle" id="uplift-show-original-row" hidden>
          <input id="uplift-show-original-toggle" type="checkbox" checked />
          ${t("upliftShowOriginalToggleLabel")}
        </label>
        <div class="dataset-style-row" id="uplift-style-row" hidden>
          <span class="dataset-style-label">${t("upliftHeading")}</span>
          <input
            id="uplift-color-input"
            type="color"
            class="dataset-color-input"
            value="${UPLIFT_CORRECTED_DEFAULT_COLOR}"
            aria-label="${t("datasetColorAriaLabel", { label: t("upliftHeading") })}"
          />
          <input
            id="uplift-width-input"
            type="number"
            class="dataset-width-input"
            min="1"
            max="10"
            step="1"
            value="${DEFAULT_LINE_WIDTH_PX}"
            aria-label="${t("datasetWidthAriaLabel", { label: t("upliftHeading") })}"
          />
        </div>
      </div>
    </aside>
  </main>
  <section id="profile-section" class="profile-section">
    <canvas id="profile-canvas"></canvas>
    <button id="download-profile-btn" type="button" disabled>${t("downloadProfileButton")}</button>
  </section>
`;

document.querySelector<HTMLButtonElement>("#lang-switch-btn")!.addEventListener("click", () => {
  switchLang(otherLang);
});

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
const downloadKmlBtn = document.querySelector<HTMLButtonElement>("#download-kml-btn")!;
const downloadShapefileBtn = document.querySelector<HTMLButtonElement>("#download-shapefile-btn")!;
const upliftValueInput = document.querySelector<HTMLInputElement>("#uplift-value")!;
const upliftShowOriginalRow = document.querySelector<HTMLLabelElement>("#uplift-show-original-row")!;
const upliftShowOriginalToggle = document.querySelector<HTMLInputElement>(
  "#uplift-show-original-toggle",
)!;
const upliftStyleRow = document.querySelector<HTMLDivElement>("#uplift-style-row")!;
const upliftColorInput = document.querySelector<HTMLInputElement>("#uplift-color-input")!;
const upliftWidthInput = document.querySelector<HTMLInputElement>("#uplift-width-input")!;

downloadProfileBtn.addEventListener("click", () => {
  downloadCanvasAsPng(profileChart.getCanvas(), buildProfileFilename());
});

downloadMapBtn.addEventListener("click", () => {
  void handleDownloadMap();
});

downloadKmlBtn.addEventListener("click", () => {
  if (!currentTransect) return;
  const dataUrl = buildTransectKmlDataUrl(currentTransect);
  downloadDataUrl(dataUrl, buildTransectKmlFilename());
});

downloadShapefileBtn.addEventListener("click", () => {
  if (!currentTransect) return;
  const zipBytes = buildTransectShapefileZip(currentTransect);
  downloadBlob(
    new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" }),
    buildTransectShapefileFilename(),
  );
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

const fontSizeInput = document.querySelector<HTMLInputElement>("#font-size-input")!;
fontSizeInput.addEventListener("input", () => {
  const fontSizePx = Number(fontSizeInput.value);
  profileChart.setFontSizePx(fontSizePx > 0 ? fontSizePx : DEFAULT_FONT_SIZE_PX);
});

async function handleDownloadMap(): Promise<void> {
  mapExportError.hidden = true;
  downloadMapBtn.disabled = true;
  try {
    const dataUrl = await exportMapAsPngDataUrl(mapContainer);
    downloadDataUrl(dataUrl, buildMapFilename());
  } catch (error) {
    mapExportError.textContent =
      error instanceof Error ? error.message : t("mapExportErrorGeneric");
    mapExportError.hidden = false;
  } finally {
    downloadMapBtn.disabled = false;
  }
}

let currentTransect: TransectPoints | null = null;
let currentProfile: CrossSectionProfile | null = null;

/**
 * 隆起補正の設定(003-uplift-correction)。`upliftValueInput`の入力イベントで更新され、
 * `generateProfile()`をやり直さずに`renderProfileWithUplift()`が断面図を再描画する(FR-003)。
 * 0以外の有効な数値が入力されると自動的に補正後系列を表示する(`enabled`はチェックボックスでは
 * なく入力値そのものから決まる)。`upliftShowOriginalToggle`は、補正後系列とは独立に、
 * 補正前(元)の地震前系列を表示し続けるかどうかを切り替える。
 */
const upliftSettings: UpliftCorrectionSettings = {
  baseDatasetId: UPLIFT_BASE_DATASET_ID,
  upliftM: 0,
  enabled: false,
};

/**
 * 直近に生成した断面図に隆起補正を適用して再描画する(DEM再取得なし)。補正が適用されている間は、
 * グラフタイトルに隆起量を表示して補正済みであることを明示する(FR-005)。
 */
function renderProfileWithUplift(): void {
  if (!currentProfile) return;

  const correctedProfile = applyUpliftCorrection(currentProfile, upliftSettings);
  const correctionApplied = correctedProfile !== currentProfile;

  let profileToRender = correctedProfile;
  if (correctionApplied && !upliftShowOriginalToggle.checked) {
    const visibleDatasetIds = new Set(correctedProfile.visibleDatasetIds);
    visibleDatasetIds.delete(upliftSettings.baseDatasetId);
    profileToRender = { ...correctedProfile, visibleDatasetIds };
  }

  profileChart.render(profileToRender);
  profileChart.setTitle(
    correctionApplied
      ? t("upliftAnnotationLabel", { upliftM: formatSignedMeters(upliftSettings.upliftM) })
      : null,
  );
}

function updateUpliftSettingsFromInputs(): void {
  const value = Number(upliftValueInput.value);
  upliftSettings.upliftM = value;
  upliftSettings.enabled = Number.isFinite(value) && value !== 0;
  upliftShowOriginalRow.hidden = !upliftSettings.enabled;
  upliftStyleRow.hidden = !upliftSettings.enabled;
  renderProfileWithUplift();
}

upliftValueInput.addEventListener("input", updateUpliftSettingsFromInputs);
upliftShowOriginalToggle.addEventListener("change", renderProfileWithUplift);

function applyUpliftStyle(): void {
  const lineWidthPx = Number(upliftWidthInput.value);
  profileChart.setDatasetStyle(buildUpliftCorrectedDatasetId(upliftSettings.baseDatasetId), {
    color: upliftColorInput.value,
    lineWidthPx: lineWidthPx > 0 ? lineWidthPx : DEFAULT_LINE_WIDTH_PX,
  });
}

upliftColorInput.addEventListener("input", applyUpliftStyle);
upliftWidthInput.addEventListener("input", applyUpliftStyle);
applyUpliftStyle();

transectDraw.onChange((transect) => {
  currentTransect = transect;
  generateBtn.disabled = transect === null;
  downloadMapBtn.disabled = transect === null;
  downloadKmlBtn.disabled = transect === null;
  downloadShapefileBtn.disabled = transect === null;
  clearFormError();
});

generateBtn.addEventListener("click", () => {
  void handleGenerateProfile();
});

async function handleGenerateProfile(): Promise<void> {
  clearFormError();

  if (!currentTransect) {
    showFormError(t("formErrorNoTransect"));
    return;
  }

  const samplingIntervalM = Number(samplingIntervalInput.value);
  if (!(samplingIntervalM > 0)) {
    showFormError(t("formErrorInvalidInterval"));
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
      t("confirmLargeTransect", { lengthM: Math.round(lengthM), count: estimatedSampleCount }),
    );
    if (!proceed) return;
  }

  generateBtn.disabled = true;
  try {
    const profile: CrossSectionProfile = await generateProfile(line, demDatasets);
    currentProfile = profile;
    renderProfileWithUplift();
    downloadProfileBtn.disabled = false;
  } catch (error) {
    currentProfile = null;
    downloadProfileBtn.disabled = true;
    showFormError(describeProfileError(error));
  } finally {
    generateBtn.disabled = false;
  }
}

function describeProfileError(error: unknown): string {
  if (error instanceof Error && error.message.includes("must not be the same location")) {
    return t("profileErrorSameLocation");
  }
  return t("profileErrorGeneric");
}

function showFormError(message: string): void {
  formError.textContent = message;
  formError.hidden = false;
}

function clearFormError(): void {
  formError.hidden = true;
  formError.textContent = "";
}
