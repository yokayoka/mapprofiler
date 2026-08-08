import L from "leaflet";
import { wgs84ToEpsg6675 } from "../geo/coordinateTransform";
import type { LatLng, XY } from "../types";

export interface TransectPoints {
  startLatLng: LatLng;
  endLatLng: LatLng;
  startXY: XY;
  endXY: XY;
}

export type TransectChangeListener = (transect: TransectPoints | null) => void;

const LINE_STYLE: L.PolylineOptions = { color: "#d62728", weight: 3 };
const POINT_RADIUS_PX = 5;

/**
 * 地図クリックで測線の始点・終点を指定するUI(US1, FR-002)。
 * 2点指定されるたびに測線を地図上にオーバーレイし、WGS84/EPSG:6675座標をリスナーへ通知する。
 * 3回目以降のクリックは新しい測線の始点として扱う(引き直し、Acceptance Scenario 3)。
 */
export class TransectDraw {
  private readonly map: L.Map;
  private clickedLatLngs: L.LatLng[] = [];
  private polyline: L.Polyline | null = null;
  private markers: L.CircleMarker[] = [];
  private listeners: TransectChangeListener[] = [];

  constructor(map: L.Map) {
    this.map = map;
    this.map.on("click", this.handleMapClick);
  }

  onChange(listener: TransectChangeListener): void {
    this.listeners.push(listener);
  }

  getCurrentTransect(): TransectPoints | null {
    return this.toTransectPoints();
  }

  destroy(): void {
    this.map.off("click", this.handleMapClick);
    this.clearOverlay();
  }

  private handleMapClick = (e: L.LeafletMouseEvent): void => {
    if (this.clickedLatLngs.length >= 2) {
      this.clearOverlay();
      this.clickedLatLngs = [];
    }

    this.clickedLatLngs.push(e.latlng);
    this.renderOverlay();

    if (this.clickedLatLngs.length === 2) {
      this.emitChange();
    }
  };

  private renderOverlay(): void {
    for (const marker of this.markers) marker.addTo(this.map);
    const lastLatLng = this.clickedLatLngs[this.clickedLatLngs.length - 1];
    const marker = L.circleMarker(lastLatLng, {
      radius: POINT_RADIUS_PX,
      color: LINE_STYLE.color,
      fillOpacity: 1,
    }).addTo(this.map);
    this.markers.push(marker);

    if (this.clickedLatLngs.length === 2) {
      this.polyline = L.polyline(this.clickedLatLngs, LINE_STYLE).addTo(this.map);
    }
  }

  private clearOverlay(): void {
    if (this.polyline) {
      this.map.removeLayer(this.polyline);
      this.polyline = null;
    }
    for (const marker of this.markers) this.map.removeLayer(marker);
    this.markers = [];
  }

  private toTransectPoints(): TransectPoints | null {
    if (this.clickedLatLngs.length < 2) return null;
    const [a, b] = this.clickedLatLngs;
    return {
      startLatLng: { lat: a.lat, lng: a.lng },
      endLatLng: { lat: b.lat, lng: b.lng },
      startXY: wgs84ToEpsg6675(a.lng, a.lat),
      endXY: wgs84ToEpsg6675(b.lng, b.lat),
    };
  }

  private emitChange(): void {
    const transect = this.toTransectPoints();
    for (const listener of this.listeners) listener(transect);
  }
}
