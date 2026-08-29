/**
 * 地形変化量オーバーレイ(5m色別)用のフラグメントシェーダーと凡例定義。
 * NotoLocshare (`src/elvchange_shaders.js`, maff_elvchange3.html) からそのまま移植したもの。
 *
 * 配信タイルは標高差分値をRGBにエンコードしたPNGであり、地図上に表示するには
 * 西岡他(2015)の方式でRGB→標高値へ復号した上で色分けする必要がある(GPU上でシェーダーにより変換)。
 */

/** -70〜+75m対応、青→緑→黄→橙→赤のダイバージングカラーマップ(0m=黄を中心にランク付け)。 */
export const elevationChangeColorMapShader = `
precision mediump float;
uniform sampler2D image;
uniform vec2 unit;
uniform float zoom;

float calculateAltitude(vec3 rgb) {
  float x = rgb.r * 16711680.0 + rgb.g * 65280.0 + rgb.b * 255.0;
  float u = 0.01;

  if (x < 8388608.0) {
    return x * u;
  } else if (abs(x - 8388608.0) < 1.0) {
    return -9999.0;
  } else if (x > 8388608.0) {
    return (x - 16777216.0) * u;
  } else {
    return -9999.0;
  }
}

vec3 getColor(float altitude) {
  if (altitude <= 0.0) {
    if (altitude < -65.000) return vec3(0.078, 0.196, 0.745);
    if (altitude < -60.000) return vec3(0.082, 0.227, 0.714);
    if (altitude < -55.000) return vec3(0.082, 0.255, 0.678);
    if (altitude < -50.000) return vec3(0.086, 0.286, 0.647);
    if (altitude < -45.000) return vec3(0.090, 0.314, 0.616);
    if (altitude < -40.000) return vec3(0.090, 0.345, 0.584);
    if (altitude < -35.000) return vec3(0.094, 0.376, 0.549);
    if (altitude < -30.000) return vec3(0.098, 0.404, 0.518);
    if (altitude < -25.000) return vec3(0.102, 0.435, 0.486);
    if (altitude < -20.000) return vec3(0.102, 0.463, 0.455);
    if (altitude < -15.000) return vec3(0.106, 0.494, 0.420);
    if (altitude < -10.000) return vec3(0.110, 0.522, 0.388);
    if (altitude < -9.000) return vec3(0.110, 0.553, 0.357);
    if (altitude < -8.000) return vec3(0.114, 0.584, 0.322);
    if (altitude < -7.000) return vec3(0.118, 0.612, 0.290);
    if (altitude < -6.000) return vec3(0.149, 0.635, 0.271);
    if (altitude < -5.000) return vec3(0.208, 0.651, 0.259);
    if (altitude < -4.000) return vec3(0.267, 0.667, 0.247);
    if (altitude < -3.000) return vec3(0.325, 0.682, 0.235);
    if (altitude < -2.000) return vec3(0.384, 0.702, 0.227);
    if (altitude < -1.000) return vec3(0.443, 0.718, 0.216);
    if (altitude < -0.290) return vec3(0.506, 0.733, 0.204);
    if (altitude < -0.180) return vec3(0.565, 0.749, 0.192);
    if (altitude < -0.130) return vec3(0.624, 0.765, 0.184);
    if (altitude < -0.090) return vec3(0.682, 0.780, 0.173);
    if (altitude < -0.060) return vec3(0.741, 0.796, 0.161);
    if (altitude < -0.040) return vec3(0.800, 0.816, 0.149);
    if (altitude < -0.020) return vec3(0.863, 0.831, 0.141);
    if (altitude < -0.010) return vec3(0.922, 0.847, 0.129);
    return vec3(0.980, 0.863, 0.118);
  } else {
    if (altitude < 0.020) return vec3(0.980, 0.863, 0.118);
    if (altitude < 0.030) return vec3(0.976, 0.843, 0.114);
    if (altitude < 0.050) return vec3(0.973, 0.824, 0.114);
    if (altitude < 0.070) return vec3(0.969, 0.804, 0.110);
    if (altitude < 0.130) return vec3(0.965, 0.780, 0.106);
    if (altitude < 0.180) return vec3(0.961, 0.761, 0.106);
    if (altitude < 0.230) return vec3(0.957, 0.741, 0.102);
    if (altitude < 0.310) return vec3(0.953, 0.722, 0.098);
    if (altitude < 0.440) return vec3(0.949, 0.702, 0.098);
    if (altitude < 1.000) return vec3(0.945, 0.682, 0.094);
    if (altitude < 2.000) return vec3(0.941, 0.659, 0.094);
    if (altitude < 3.000) return vec3(0.937, 0.639, 0.090);
    if (altitude < 4.000) return vec3(0.933, 0.620, 0.086);
    if (altitude < 5.000) return vec3(0.929, 0.600, 0.086);
    if (altitude < 6.000) return vec3(0.925, 0.580, 0.082);
    if (altitude < 7.000) return vec3(0.922, 0.561, 0.078);
    if (altitude < 8.000) return vec3(0.918, 0.533, 0.078);
    if (altitude < 9.000) return vec3(0.910, 0.506, 0.082);
    if (altitude < 10.000) return vec3(0.898, 0.478, 0.086);
    if (altitude < 15.000) return vec3(0.890, 0.451, 0.086);
    if (altitude < 20.000) return vec3(0.882, 0.424, 0.090);
    if (altitude < 25.000) return vec3(0.875, 0.396, 0.094);
    if (altitude < 30.000) return vec3(0.863, 0.369, 0.094);
    if (altitude < 35.000) return vec3(0.855, 0.341, 0.098);
    if (altitude < 40.000) return vec3(0.847, 0.314, 0.098);
    if (altitude < 45.000) return vec3(0.839, 0.286, 0.102);
    if (altitude < 50.000) return vec3(0.827, 0.255, 0.106);
    if (altitude < 55.000) return vec3(0.820, 0.227, 0.106);
    if (altitude < 60.000) return vec3(0.812, 0.200, 0.110);
    if (altitude < 65.000) return vec3(0.804, 0.173, 0.114);
    if (altitude < 70.000) return vec3(0.792, 0.145, 0.114);
    return vec3(0.784, 0.118, 0.118);
  }
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, 1.0 / unit.y - gl_FragCoord.y);

  vec4 pixelColor = texture2D(image, p * unit);
  float alt = calculateAltitude(pixelColor.rgb);

  if (alt < -9998.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  vec3 color = getColor(alt);
  float alpha = (alt >= -70.0 && alt <= 75.0) ? 1.0 : 0.0;

  gl_FragColor = vec4(color, alpha);
}
`;

/** 凡例の区分(標高差分の下限・上限・表示色)。言語別ラベルは表示側(mapView.ts)で組み立てる。上記シェーダーの色分け境界と一致させること。 */
export interface ElevationChangeLegendEntry {
  low: number;
  high: number;
  color: string;
}

export const elevationChangeLegendEntries: ElevationChangeLegendEntry[] = [
  { low: -70, high: -65, color: "rgb(20, 50, 190)" },
  { low: -65, high: -60, color: "rgb(21, 58, 182)" },
  { low: -60, high: -55, color: "rgb(21, 65, 173)" },
  { low: -55, high: -50, color: "rgb(22, 73, 165)" },
  { low: -50, high: -45, color: "rgb(23, 80, 157)" },
  { low: -45, high: -40, color: "rgb(23, 88, 149)" },
  { low: -40, high: -35, color: "rgb(24, 96, 140)" },
  { low: -35, high: -30, color: "rgb(25, 103, 132)" },
  { low: -30, high: -25, color: "rgb(26, 111, 124)" },
  { low: -25, high: -20, color: "rgb(26, 118, 116)" },
  { low: -20, high: -15, color: "rgb(27, 126, 107)" },
  { low: -15, high: -10, color: "rgb(28, 133, 99)" },
  { low: -10, high: -9, color: "rgb(28, 141, 91)" },
  { low: -9, high: -8, color: "rgb(29, 149, 82)" },
  { low: -8, high: -7, color: "rgb(30, 156, 74)" },
  { low: -7, high: -6, color: "rgb(38, 162, 69)" },
  { low: -6, high: -5, color: "rgb(53, 166, 66)" },
  { low: -5, high: -4, color: "rgb(68, 170, 63)" },
  { low: -4, high: -3, color: "rgb(83, 174, 60)" },
  { low: -3, high: -2, color: "rgb(98, 179, 58)" },
  { low: -2, high: -1, color: "rgb(113, 183, 55)" },
  { low: -1, high: -0.29, color: "rgb(129, 187, 52)" },
  { low: -0.29, high: -0.18, color: "rgb(144, 191, 49)" },
  { low: -0.18, high: -0.13, color: "rgb(159, 195, 47)" },
  { low: -0.13, high: -0.09, color: "rgb(174, 199, 44)" },
  { low: -0.09, high: -0.06, color: "rgb(189, 203, 41)" },
  { low: -0.06, high: -0.04, color: "rgb(204, 208, 38)" },
  { low: -0.04, high: -0.02, color: "rgb(220, 212, 36)" },
  { low: -0.02, high: -0.01, color: "rgb(235, 216, 33)" },
  { low: -0.01, high: 0, color: "rgb(250, 220, 30)" },
  { low: 0, high: 0.02, color: "rgb(250, 220, 30)" },
  { low: 0.02, high: 0.03, color: "rgb(249, 215, 29)" },
  { low: 0.03, high: 0.05, color: "rgb(248, 210, 29)" },
  { low: 0.05, high: 0.07, color: "rgb(247, 205, 28)" },
  { low: 0.07, high: 0.13, color: "rgb(246, 199, 27)" },
  { low: 0.13, high: 0.18, color: "rgb(245, 194, 27)" },
  { low: 0.18, high: 0.23, color: "rgb(244, 189, 26)" },
  { low: 0.23, high: 0.31, color: "rgb(243, 184, 25)" },
  { low: 0.31, high: 0.44, color: "rgb(242, 179, 25)" },
  { low: 0.44, high: 1, color: "rgb(241, 174, 24)" },
  { low: 1, high: 2, color: "rgb(240, 168, 24)" },
  { low: 2, high: 3, color: "rgb(239, 163, 23)" },
  { low: 3, high: 4, color: "rgb(238, 158, 22)" },
  { low: 4, high: 5, color: "rgb(237, 153, 22)" },
  { low: 5, high: 6, color: "rgb(236, 148, 21)" },
  { low: 6, high: 7, color: "rgb(235, 143, 20)" },
  { low: 7, high: 8, color: "rgb(234, 136, 20)" },
  { low: 8, high: 9, color: "rgb(232, 129, 21)" },
  { low: 9, high: 10, color: "rgb(229, 122, 22)" },
  { low: 10, high: 15, color: "rgb(227, 115, 22)" },
  { low: 15, high: 20, color: "rgb(225, 108, 23)" },
  { low: 20, high: 25, color: "rgb(223, 101, 24)" },
  { low: 25, high: 30, color: "rgb(220, 94, 24)" },
  { low: 30, high: 35, color: "rgb(218, 87, 25)" },
  { low: 35, high: 40, color: "rgb(216, 80, 25)" },
  { low: 40, high: 45, color: "rgb(214, 73, 26)" },
  { low: 45, high: 50, color: "rgb(211, 65, 27)" },
  { low: 50, high: 55, color: "rgb(209, 58, 27)" },
  { low: 55, high: 60, color: "rgb(207, 51, 28)" },
  { low: 60, high: 65, color: "rgb(205, 44, 29)" },
  { low: 65, high: 70, color: "rgb(202, 37, 29)" },
  { low: 70, high: 75, color: "rgb(200, 30, 30)" },
];

