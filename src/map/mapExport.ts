import { t } from "../i18n/i18n";

/**
 * 地図PNGエクスポートに失敗した場合の例外(FR-011)。CORS制約による失敗(research.md R5)を
 * 想定した利用者向けメッセージを持つ。
 */
export class MapExportError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MapExportError";
  }
}

/**
 * 測線・縮尺コントロールを含む地図コンテナ全体をPNG化する(FR-010, FR-011)。
 *
 * `leaflet-image` はLeafletのレイヤー(タイル・ベクタ)のみをcanvasに再構成する仕組みで、
 * `L.control.scale()` のようなDOMベースのコントロールは対象に含まれない。一方 `html2canvas` は
 * 対象要素のDOM全体(タイル画像+測線オーバーレイ+縮尺コントロール)を描画するため、縮尺表示を
 * 確実に含められる。この理由から、research.md R5で検討していた2案のうち html2canvas を採用する
 * (mapView.tsのタイルレイヤーに `crossOrigin: true` を設定し、CORS対応済みタイル配信を前提とする)。
 *
 * `html2canvas` は地図PNGダウンロード操作時にのみ必要なため、動的importで遅延読込し、
 * 初期バンドルサイズを抑える(憲法 原則II)。
 */
export async function exportMapAsPngDataUrl(mapContainer: HTMLElement): Promise<string> {
  let canvas: HTMLCanvasElement;
  try {
    const { default: html2canvas } = await import("html2canvas");
    canvas = await html2canvas(mapContainer, { useCORS: true, logging: false });
  } catch (error) {
    throw new MapExportError(t("mapExportErrorGeneric"), error);
  }

  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    throw new MapExportError(t("mapExportErrorGeneric"), error);
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function buildMapFilename(prefix = "transect-map"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${timestamp}.png`;
}
