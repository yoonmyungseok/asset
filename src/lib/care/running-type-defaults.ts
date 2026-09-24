export interface RunningTypeDefaults {
  value: string;
  label: string;
  excludeFromStats: boolean;
  sortOrder: number;
}

export const DEFAULT_RUNNING_TYPES: RunningTypeDefaults[] = [
  { value: "easy", label: "이지런", excludeFromStats: false, sortOrder: 0 },
  { value: "recovery", label: "회복주", excludeFromStats: false, sortOrder: 1 },
  { value: "lsd", label: "LSD", excludeFromStats: false, sortOrder: 2 },
  { value: "rest", label: "휴식", excludeFromStats: true, sortOrder: 3 },
  { value: "tempo", label: "지속주", excludeFromStats: false, sortOrder: 4 },
];
