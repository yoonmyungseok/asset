/** Downloads「러닝_기록_시트.xlsx」와 동일한 탭·헤더 구조 */
export const DAILY_LOG_KO_PRESET = {
  googleRunningSheetName: "Daily_Log",
  googleRunningSplitSheetName: "러닝_구간_기록",
  googleRunningUpsertKey: "date",
  googleRunningSplitUpsertKey: "date_split",
  googleRunningHeaderMap: {
    date: "날짜",
    type_label: "종류",
    distance_km: "거리(km)",
    duration_sec: "시간",
    avg_pace: "평균페이스",
    avg_hr: "평균심박",
    max_hr: "최대심박",
    cadence: "케이던스",
    memo: "특이사항",
  },
  googleRunningSplitHeaderMap: {
    date: "날짜",
    split_number: "구간",
    pace: "페이스",
    heart_rate: "심박수",
    cadence: "케이던스",
    memo: "메모",
  },
} as const;

export function dailyLogKoPresetForApi() {
  return {
    googleRunningSheetName: DAILY_LOG_KO_PRESET.googleRunningSheetName,
    googleRunningSplitSheetName: DAILY_LOG_KO_PRESET.googleRunningSplitSheetName,
    googleRunningUpsertKey: DAILY_LOG_KO_PRESET.googleRunningUpsertKey,
    googleRunningSplitUpsertKey: DAILY_LOG_KO_PRESET.googleRunningSplitUpsertKey,
    googleRunningHeaderMap: JSON.stringify(DAILY_LOG_KO_PRESET.googleRunningHeaderMap, null, 2),
    googleRunningSplitHeaderMap: JSON.stringify(
      DAILY_LOG_KO_PRESET.googleRunningSplitHeaderMap,
      null,
      2,
    ),
  };
}
