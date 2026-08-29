import L from "leaflet";
import { defaultTileLayerId, tileLayers } from "../config/datasets";
import { createGlueTileLayer } from "./glueTileLayer";
import { elevationChangeColorMapShader, elevationChangeLegend } from "./elevationChangeShader";

/**
 * 地形変化量オーバーレイ(5m色別)のタイル配信元。標高差分値をRGBにエンコードしたPNGであり、
 * `elevationChangeColorMapShader` でクライアント側(WebGL)で色分け画像へ変換して表示する
 * (NotoLocshare `maff_elvchange3.html` と同じデータソース・変換方式)。
 */
const ELEVATION_CHANGE_TILE_URL =
  "https://forestgeo.info/opendata/17_ishikawa/noto/henka_2024/{z}/{x}/{y}.png";

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

  const elevationChangeLayer = createGlueTileLayer(ELEVATION_CHANGE_TILE_URL, {
    attribution: "出典: 林野庁(標高差分タイルを地形変化量として色分け表示)",
    maxZoom: 18,
    maxNativeZoom: 14,
    opacity: 0.7,
    fragmentShader: elevationChangeColorMapShader,
  });

  const overlayLayers: Record<string, L.Layer> = {
    "地形変化量(5m色別)": elevationChangeLayer,
  };

  const layersControl = L.control.layers(baseLayers, overlayLayers, { collapsed: true }).addTo(map);

  const elevationChangeLegendControl = createElevationChangeLegendControl();
  map.on("overlayadd", (event: L.LayersControlEvent) => {
    if (event.layer === elevationChangeLayer) {
      elevationChangeLegendControl.addTo(map);
    }
  });
  map.on("overlayremove", (event: L.LayersControlEvent) => {
    if (event.layer === elevationChangeLayer) {
      map.removeControl(elevationChangeLegendControl);
    }
  });

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

/** 地形変化量オーバーレイの表示中のみ地図に追加する凡例コントロール(色分け区分の一覧)。 */
function createElevationChangeLegendControl(): L.Control {
  const legend = new L.Control({ position: "bottomleft" });

  legend.onAdd = () => {
    const div = L.DomUtil.create("div", "legend elevation-change-legend");

    const title = document.createElement("div");
    title.className = "legend-title";
    title.textContent = "地形変化量(5m色別)";
    div.appendChild(title);

    for (const [label, color] of elevationChangeLegend) {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<i style="background:${color}"></i>${label}`;
      div.appendChild(item);
    }

    return div;
  };

  return legend;
}
