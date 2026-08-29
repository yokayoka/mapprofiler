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

/** 凡例表示用のラベルと色(CSS rgb())の対応表。上記シェーダーの色分け境界と一致させること。 */
export const elevationChangeLegend: Array<[label: string, color: string]> = [
  ["-70〜-65m", "rgb(20, 50, 190)"],
  ["-65〜-60m", "rgb(21, 58, 182)"],
  ["-60〜-55m", "rgb(21, 65, 173)"],
  ["-55〜-50m", "rgb(22, 73, 165)"],
  ["-50〜-45m", "rgb(23, 80, 157)"],
  ["-45〜-40m", "rgb(23, 88, 149)"],
  ["-40〜-35m", "rgb(24, 96, 140)"],
  ["-35〜-30m", "rgb(25, 103, 132)"],
  ["-30〜-25m", "rgb(26, 111, 124)"],
  ["-25〜-20m", "rgb(26, 118, 116)"],
  ["-20〜-15m", "rgb(27, 126, 107)"],
  ["-15〜-10m", "rgb(28, 133, 99)"],
  ["-10〜-9m", "rgb(28, 141, 91)"],
  ["-9〜-8m", "rgb(29, 149, 82)"],
  ["-8〜-7m", "rgb(30, 156, 74)"],
  ["-7〜-6m", "rgb(38, 162, 69)"],
  ["-6〜-5m", "rgb(53, 166, 66)"],
  ["-5〜-4m", "rgb(68, 170, 63)"],
  ["-4〜-3m", "rgb(83, 174, 60)"],
  ["-3〜-2m", "rgb(98, 179, 58)"],
  ["-2〜-1m", "rgb(113, 183, 55)"],
  ["-1〜-0.29m", "rgb(129, 187, 52)"],
  ["-0.29〜-0.18m", "rgb(144, 191, 49)"],
  ["-0.18〜-0.13m", "rgb(159, 195, 47)"],
  ["-0.13〜-0.09m", "rgb(174, 199, 44)"],
  ["-0.09〜-0.06m", "rgb(189, 203, 41)"],
  ["-0.06〜-0.04m", "rgb(204, 208, 38)"],
  ["-0.04〜-0.02m", "rgb(220, 212, 36)"],
  ["-0.02〜-0.01m", "rgb(235, 216, 33)"],
  ["-0.01〜0m", "rgb(250, 220, 30)"],
  ["0〜0.02m", "rgb(250, 220, 30)"],
  ["0.02〜0.03m", "rgb(249, 215, 29)"],
  ["0.03〜0.05m", "rgb(248, 210, 29)"],
  ["0.05〜0.07m", "rgb(247, 205, 28)"],
  ["0.07〜0.13m", "rgb(246, 199, 27)"],
  ["0.13〜0.18m", "rgb(245, 194, 27)"],
  ["0.18〜0.23m", "rgb(244, 189, 26)"],
  ["0.23〜0.31m", "rgb(243, 184, 25)"],
  ["0.31〜0.44m", "rgb(242, 179, 25)"],
  ["0.44〜1m", "rgb(241, 174, 24)"],
  ["1〜2m", "rgb(240, 168, 24)"],
  ["2〜3m", "rgb(239, 163, 23)"],
  ["3〜4m", "rgb(238, 158, 22)"],
  ["4〜5m", "rgb(237, 153, 22)"],
  ["5〜6m", "rgb(236, 148, 21)"],
  ["6〜7m", "rgb(235, 143, 20)"],
  ["7〜8m", "rgb(234, 136, 20)"],
  ["8〜9m", "rgb(232, 129, 21)"],
  ["9〜10m", "rgb(229, 122, 22)"],
  ["10〜15m", "rgb(227, 115, 22)"],
  ["15〜20m", "rgb(225, 108, 23)"],
  ["20〜25m", "rgb(223, 101, 24)"],
  ["25〜30m", "rgb(220, 94, 24)"],
  ["30〜35m", "rgb(218, 87, 25)"],
  ["35〜40m", "rgb(216, 80, 25)"],
  ["40〜45m", "rgb(214, 73, 26)"],
  ["45〜50m", "rgb(211, 65, 27)"],
  ["50〜55m", "rgb(209, 58, 27)"],
  ["55〜60m", "rgb(207, 51, 28)"],
  ["60〜65m", "rgb(205, 44, 29)"],
  ["65〜70m", "rgb(202, 37, 29)"],
  ["70〜75m", "rgb(200, 30, 30)"],
];
