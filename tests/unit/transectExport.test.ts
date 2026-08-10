import { describe, expect, it } from "vitest";
import { buildTransectKml, buildTransectKmlFilename } from "../../src/map/transectExport";

describe("buildTransectKml", () => {
  const transect = {
    startLatLng: { lat: 37.42, lng: 137.08 },
    endLatLng: { lat: 37.43, lng: 137.1 },
  };

  it("座標をKMLの順序(経度,緯度,標高)で出力する", () => {
    const kml = buildTransectKml(transect);
    expect(kml).toContain("<coordinates>137.08,37.42,0 137.1,37.43,0</coordinates>");
  });

  it("始点・終点のPlacemarkをそれぞれ含む", () => {
    const kml = buildTransectKml(transect);
    expect(kml).toContain("<coordinates>137.08,37.42,0</coordinates>");
    expect(kml).toContain("<coordinates>137.1,37.43,0</coordinates>");
    expect(kml).toContain("<name>始点</name>");
    expect(kml).toContain("<name>終点</name>");
  });

  it("有効なXML宣言とkmlルート要素を持つ", () => {
    const kml = buildTransectKml(transect);
    expect(kml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
  });

  it("名前に含まれる特殊文字をXMLエスケープする", () => {
    const kml = buildTransectKml(transect, 'A<B>&"C"');
    expect(kml).toContain("A&lt;B&gt;&amp;&quot;C&quot;");
    expect(kml).not.toContain("A<B>&\"C\"");
  });
});

describe("buildTransectKmlFilename", () => {
  it("拡張子.kmlのファイル名を生成する", () => {
    expect(buildTransectKmlFilename()).toMatch(/^transect_.+\.kml$/);
  });
});
