import L from "leaflet";
import { defaultTileLayerId, tileLayers } from "../config/datasets";

/**
 * 能登半島北部4市町(輪島市・珠洲市・能登町・穴水町)を包含する範囲(002-expand-northern-noto、
 * EPSG:6675: x -43500〜17500, y 113000〜172500 の中心)を初期表示範囲とする。
 */
const DEFAULT_CENTER: L.LatLngExpression = [37.28641, 137.020052];
const DEFAULT_ZOOM = 11;

export interface MapViewHandles {
  map: L.Map;
  layersControl: L.Control.Layers;
  scaleControl: L.Control.Scale;
}

/**
 * Leaflet地図を初期化し、運用者が設定した背景タイル群(FR-001)をレイヤー切替コントロールで
 * 選択できるようにし、縮尺コントロール(FR-010)を追加する。タイル読み込みに失敗した場合は
 * フォールバック表示とし、アプリ全体は継続利用できる(Edge Cases, T033)。
 *
 * 背景タイルは運用者があらかじめ用意した候補(`tileLayers`)の中から選ぶ形式であり、
 * 任意URLを自由入力できるUIは提供しない(FR-015)。
 */
export function initMapView(containerId: string): MapViewHandles {
  const map = L.map(containerId).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  const baseLayers: Record<string, L.TileLayer> = {};

  for (const option of tileLayers) {
    const layer = L.tileLayer(option.urlTemplate, {
      attribution: option.attribution,
      maxZoom: option.maxZoom,
      // 地図PNGエクスポート(User Story 4)でタイル画像をcanvasに合成するためCORS属性を付与する。
      // 配信元がCORSを許可していない場合、地図PNGダウンロードは失敗する(research.md R5)。
      crossOrigin: true,
    });

    // 表示範囲の端など個別タイルの欠落は正常に起こりうるため、フォールバック通知は
    // 「現在の表示範囲で1枚も読み込めなかった」場合のみ出す(全滅時のみ、Edge Cases)。
    let successCount = 0;
    let errorCount = 0;
    layer.on("loading", () => {
      successCount = 0;
      errorCount = 0;
    });
    layer.on("tileload", () => {
      successCount++;
    });
    layer.on("tileerror", () => {
      errorCount++;
    });
    layer.on("load", () => {
      if (successCount === 0 && errorCount > 0) {
        showTileFallbackNotice(containerId);
      } else {
        hideTileFallbackNotice(containerId);
      }
    });

    baseLayers[option.label] = layer;
  }

  const defaultOption = tileLayers.find((o) => o.id === defaultTileLayerId) ?? tileLayers[0];
  baseLayers[defaultOption.label]?.addTo(map);

  const layersControl = L.control.layers(baseLayers, undefined, { collapsed: true }).addTo(map);

  map.on("baselayerchange", () => {
    hideTileFallbackNotice(containerId);
  });

  const scaleControl = L.control.scale({ metric: true, imperial: false }).addTo(map);

  return { map, layersControl, scaleControl };
}

function showTileFallbackNotice(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (container.querySelector(".tile-fallback-notice")) return;

  const notice = document.createElement("div");
  notice.className = "tile-fallback-notice";
  notice.setAttribute("role", "status");
  notice.textContent =
    "背景タイル地図を読み込めませんでした(配信元設定を確認してください)。断面図の作成機能は引き続き利用できます。";
  container.appendChild(notice);
}

function hideTileFallbackNotice(containerId: string): void {
  const container = document.getElementById(containerId);
  container?.querySelector(".tile-fallback-notice")?.remove();
}
