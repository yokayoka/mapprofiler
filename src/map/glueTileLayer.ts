import L from "leaflet";

/**
 * WebGLフラグメントシェーダーでタイル画像を加工しながら表示するLeafletタイルレイヤー。
 * NotoLocshare (maff_elvchange3.html) の `Leaflet.TileLayer.GLUE` プラグインをTypeScript移植したもの。
 * 標高値をRGBにエンコードしたPNGタイルを、フラグメントシェーダーで色分け画像へリアルタイム変換する
 * 用途(地形変化量オーバーレイ)で使用する。
 *
 * Leafletの内部API(`_initContainer`等)を上書きするプラグインのため、`@types/leaflet`に
 * 型定義のない内部プロパティ・メソッドへは `GlueInternals` 経由でアクセスする。
 */

export interface GlueTileLayerOptions extends L.TileLayerOptions {
  /** タイル画像を加工するGLSLフラグメントシェーダーのソース。 */
  fragmentShader: string;
  /** タイル未読込領域の背景色(CSS色文字列)。既定値は"#7f0000"。 */
  errorTileColor?: string;
}

const VERTEX_SHADER = `
attribute vec2 clip;
void main() {
  gl_Position = vec4(clip, 0, 1);
}
`;

interface TileEntry {
  coords: { x: number; y: number; z: number };
  current: boolean;
  el: HTMLImageElement;
}

interface GlueInternals {
  _map: L.Map;
  _canvas: HTMLCanvasElement;
  _gl: WebGLRenderingContext;
  _pg: WebGLProgram;
  _tileZoom: number;
  _level: { el: HTMLElement };
  _tiles: Record<string, TileEntry>;
  options: GlueTileLayerOptions;
  getTileSize(): L.Point;
  _getTiledPixelBounds(center: L.LatLng): L.Bounds;
  _pxBoundsToTileRange(bounds: L.Bounds): L.Bounds;
  _getTilePos(coords: { x: number; y: number; z: number }): L.Point;
  repaint(immediate?: boolean): void;
  _doPaint(): void;
}

type GlueTileLayer = L.TileLayer & GlueInternals;

const tileLayerPrototype = L.TileLayer.prototype as unknown as {
  _initContainer: (this: L.TileLayer) => void;
};

export const GlueTileLayerClass = L.TileLayer.extend({
  options: {
    crossOrigin: true,
  },

  _initContainer(this: GlueTileLayer) {
    tileLayerPrototype._initContainer.call(this);

    const canvas = document.createElement("canvas");
    canvas.style.zIndex = "10000";
    canvas.style.position = "absolute";
    this._canvas = canvas;

    const gl = (canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) {
      console.error("GlueTileLayer: WebGLコンテキストの取得に失敗しました。");
      return;
    }
    this._gl = gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
      console.error("GlueTileLayer: シェーダーの作成に失敗しました。");
      return;
    }
    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);
    gl.shaderSource(fragmentShader, this.options.fragmentShader);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    if (!program) {
      console.error("GlueTileLayer: プログラムの作成に失敗しました。");
      return;
    }
    this._pg = program;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
    } else {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    this._map.on(
      "moveend",
      function (this: GlueTileLayer) {
        this.repaint(false);
      },
      this,
    );

    this.on("tileload", (event: L.TileEvent) => {
      (event.tile as HTMLElement).style.display = "none";
    });
    this.on(
      "tileload load loading",
      function (this: GlueTileLayer) {
        this.repaint(false);
      },
      this,
    );
  },

  repaint(this: GlueTileLayer, immediate?: boolean) {
    L.Util.requestAnimFrame(this._doPaint, this, immediate);
  },

  _doPaint(this: GlueTileLayer) {
    if (!this._map) return;

    const center = this._map.getCenter();
    const pixelBounds = this._getTiledPixelBounds(center);
    const tileRange = this._pxBoundsToTileRange(pixelBounds);
    const size = tileRange.getSize().add([1, 1]).scaleBy(this.getTileSize());

    const canvas = this._canvas;
    const shadow = document.createElement("canvas");
    canvas.width = shadow.width = size.x;
    canvas.height = shadow.height = size.y;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    this._level.el.appendChild(canvas);

    const context = shadow.getContext("2d");
    if (!context) return;
    context.fillStyle = this.options.errorTileColor ?? "#7f0000";
    context.fillRect(0, 0, size.x, size.y);

    const origin = this._getTilePos(tileRange.min as unknown as { x: number; y: number; z: number });
    for (const key in this._tiles) {
      const tile = this._tiles[key];
      if (tile.current) {
        const pos = this._getTilePos(tile.coords).subtract(origin);
        try {
          context.drawImage(tile.el, pos.x, pos.y);
        } catch {
          // 一部タイル未読込時の描画失敗は許容し、次のrepaintで再試行する。
        }
      }
    }
    L.DomUtil.setPosition(canvas, origin);

    const image = shadow;
    const gl = this._gl;
    const program = this._pg;
    if (!gl || !program) return;

    const w = image.width;
    const h = image.height;
    const clipLocation = gl.getAttribLocation(program, "clip");
    const unitLocation = gl.getUniformLocation(program, "unit");
    const zoomLocation = gl.getUniformLocation(program, "zoom");

    const clipBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, clipBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.viewport(0, 0, w, h);
    gl.enableVertexAttribArray(clipLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, clipBuffer);
    gl.vertexAttribPointer(clipLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(unitLocation, 1 / w, 1 / h);
    gl.uniform1f(zoomLocation, this._tileZoom);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },
}) as unknown as new (urlTemplate: string, options: GlueTileLayerOptions) => GlueTileLayer;

/** 標高PNGタイルをフラグメントシェーダーで色分け画像に変換して表示するタイルレイヤーを生成する。 */
export function createGlueTileLayer(
  urlTemplate: string,
  options: GlueTileLayerOptions,
): L.TileLayer {
  return new GlueTileLayerClass(urlTemplate, options);
}
