/**
 * 断面図のcanvasをPNG化してダウンロードする(FR-009)。
 * Chart.jsはcanvasベースで描画しているため、標準のCanvas APIのみで完結する(憲法 原則I)。
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function buildProfileFilename(prefix = "cross-section-profile"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${timestamp}.png`;
}
