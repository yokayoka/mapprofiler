import { translations } from "../i18n/translations";
import type { CrossSectionProfile, DemDatasetConfig, LocalizedText, UpliftCorrectionSettings } from "../types";

/** 補正後系列の既定色。既存3系列(青・橙・緑系)と重複しない配色。 */
export const UPLIFT_CORRECTED_DEFAULT_COLOR = "#8172B3";

const ID_SUFFIX = "-uplift-corrected";

export function buildUpliftCorrectedDatasetId(baseDatasetId: string): string {
  return `${baseDatasetId}${ID_SUFFIX}`;
}

function formatSignedMeters(upliftM: number): string {
  const sign = upliftM > 0 ? "+" : "";
  return `${sign}${upliftM}`;
}

function buildCorrectedLabel(baseLabel: LocalizedText, upliftM: number): LocalizedText {
  const signed = formatSignedMeters(upliftM);
  const fill = (template: string, label: string) =>
    template.split("{label}").join(label).split("{upliftM}").join(signed);
  return {
    ja: fill(translations.ja.upliftCorrectedLabel, baseLabel.ja),
    en: fill(translations.en.upliftCorrectedLabel, baseLabel.en),
  };
}

/**
 * 生成済みの CrossSectionProfile から、baseDatasetId の標高値に upliftM を加算した
 * 「隆起補正後」の仮想データセットを1件追加した新しい CrossSectionProfile を返す(003-uplift-correction)。
 * DEMの再サンプリングは行わず、既に取得済みの points から加算するのみ(FR-003)。
 * settings.enabled が false、upliftM が有限数値でない、または baseDatasetId に対応する
 * データセットが存在しない場合は、元の profile をそのまま返す(補正系列を追加しない)。
 */
export function applyUpliftCorrection(
  profile: CrossSectionProfile,
  settings: UpliftCorrectionSettings,
): CrossSectionProfile {
  if (!settings.enabled || !Number.isFinite(settings.upliftM)) {
    return profile;
  }

  const baseDataset = profile.datasets.find((d) => d.id === settings.baseDatasetId);
  if (!baseDataset) {
    return profile;
  }

  const correctedId = buildUpliftCorrectedDatasetId(settings.baseDatasetId);
  const correctedDataset: DemDatasetConfig = {
    ...baseDataset,
    id: correctedId,
    label: buildCorrectedLabel(baseDataset.label, settings.upliftM),
    color: UPLIFT_CORRECTED_DEFAULT_COLOR,
  };

  const points = profile.points.map((point) => {
    const baseValue = point.elevationByDataset[settings.baseDatasetId];
    return {
      ...point,
      elevationByDataset: {
        ...point.elevationByDataset,
        [correctedId]: baseValue == null ? null : baseValue + settings.upliftM,
      },
    };
  });

  return {
    ...profile,
    points,
    datasets: [...profile.datasets, correctedDataset],
    visibleDatasetIds: new Set([...profile.visibleDatasetIds, correctedId]),
  };
}
