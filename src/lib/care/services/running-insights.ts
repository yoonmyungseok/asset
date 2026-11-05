import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { startOfWeek, subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { calculateAveragePace, isActiveRun } from "@/lib/care/calculations/running";
import { getRestDayTypeSet } from "@/lib/care/services/running-types";
import { formatDate, todayString } from "@/lib/care/utils";

// 생성물은 개인 건강 정보이므로 저장소에서 제외한 로컬 디렉터리에 보관한다.
const directory = path.join(process.cwd(), "data", "running-reports");
const suffix = { analysis: "분석보고서", plan: "러닝계획" } as const;
export type InsightKind = keyof typeof suffix;

// 목표는 보고서와 별도로 보관해 화면과 생성 요청에서 같은 값을 사용한다.
const goalPath = path.join(directory, "goal.json");
export async function getRunningGoal(): Promise<string> {
  try {
    const data: unknown = JSON.parse(await readFile(goalPath, "utf8"));
    if (typeof data !== "object" || data === null || !("goal" in data) || typeof data.goal !== "string") throw new Error("저장된 목표 형식이 올바르지 않습니다.");
    return data.goal;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}
export async function saveRunningGoal(goal: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(goalPath, JSON.stringify({ goal }), "utf8");
}

export async function latestInsight(kind: InsightKind) {
  let files: string[];
  try { files = await readdir(directory); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const pattern = new RegExp(`^\\d{8}_${suffix[kind]}(?:_\\d+)?\\.md$`);
  const names = files.filter((file) => pattern.test(file)).sort().reverse();
  if (!names.length) return null;
  // 같은 날 여러 결과가 있다면 파일 수정 시각이 가장 최근인 결과를 보여준다.
  const { stat } = await import("node:fs/promises");
  const dated = await Promise.all(names.map(async (name) => ({ name, modified: (await stat(path.join(directory, name))).mtimeMs })));
  dated.sort ( (a, b) => b.modified - a.modified );
  const filename = dated[0].name;
  return { filename, content: await readFile(path.join(directory, filename), "utf8") };
}

export async function generateInsight(kind: InsightKind, context: string) {
  const today = todayString();
  const start = kind === "analysis" ? today : formatDate(subDays(new Date(), 27));
  const [records, excluded, goal] = await Promise.all([
    prisma.runningRecord.findMany({ where: { date: { gte: start, lte: today } }, include: { splits: { orderBy: { splitNumber: "asc" } } }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
    getRestDayTypeSet(),
    getRunningGoal(),
  ]);
  const active = records.filter((record) => isActiveRun(record, excluded) && record.distance > 0);
  if (!active.length) throw new Error(kind === "analysis" ? "오늘 분석할 러닝 기록이 없습니다. 오늘 기록을 먼저 추가해 주세요." : "최근 28일에 계획에 참고할 러닝 기록이 없습니다.");
  // 초 단위 페이스를 코드에서 반올림해 분:초 형식으로 변환한다.
  const paceText = (seconds: number | null) => {
    if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
    const rounded = Math.round(seconds);
    return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}/km`;
  };
  const distance = active.reduce((sum, record) => sum + record.distance, 0);
  const stats = { 기간: `${start} ~ ${today}`, 러닝횟수: active.length, 총거리km: Number(distance.toFixed(2)), 평균페이스: paceText(calculateAveragePace(active, excluded)), 기록된날짜수: new Set(records.map((record) => record.date)).size };
  // 식별자와 시각 등 불필요한 필드를 빼고 각 운동과 구간의 페이스를 미리 계산한다.
  const details = active.map((record) => ({
    날짜: record.date, 유형: record.type, 거리km: record.distance, 운동시간초: record.durationSeconds,
    평균페이스: paceText(record.distance > 0 && record.durationSeconds > 0 ? record.durationSeconds / record.distance : null),
    평균심박수: record.avgHeartRate, 최대심박수: record.maxHeartRate, 케이던스: record.cadence, 메모: record.memo,
    구간: record.splits.map((split) => ({ 번호: split.splitNumber, 거리km: split.distance, 시간초: split.durationSeconds, 페이스: paceText(split.distance > 0 && split.durationSeconds > 0 ? split.durationSeconds / split.distance : null), 심박수: split.heartRate, 케이던스: split.cadence })),
  }));
  // 날짜와 주간 합계는 모델에 맡기지 않고 서버에서 계산한다.
  const weekly = new Map<string, { 시작일: string; 종료일: string; 거리km: number; 횟수: number; 진행중: boolean }>();
  if (kind === "plan") for (const record of active) {
    const date = new Date(`${record.date}T12:00:00`);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const key = formatDate(weekStart);
    const entry = weekly.get(key) ?? { 시작일: key, 종료일: formatDate(subDays(weekStart, -6)), 거리km: 0, 횟수: 0, 진행중: formatDate(subDays(weekStart, -6)) > today };
    entry.거리km += record.distance; entry.횟수++; weekly.set(key, entry);
  }
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[new Date(`${today}T12:00:00`).getDay()];
  const instruction = kind === "analysis"
    ? `오늘 ${today} (${weekday}요일) 기록에 대한 분석 보고서만 작성하세요. 오늘의 모든 운동을 각각 분석하고 구간 페이스와 심박수 변화를 다루세요. 별도의 오늘 또는 미래 러닝 계획을 작성하지 마세요.`
    : `오늘은 ${today} (${weekday}요일)입니다. 최근 28일 기록을 참고해 앞으로 1주일의 러닝 계획을 작성하세요. 첫 주와 마지막 주는 조회 기간에 포함된 기록만 집계했으므로 불완전한 주일 수 있습니다.`;
  const prompt = `${instruction} 제공된 페이스는 분:초/km입니다. 수치를 재계산하거나 없는 수치를 만들지 마세요.\n계산된 통계: ${JSON.stringify(stats)}\n주간 통계: ${JSON.stringify([...weekly.values()].map((week) => ({ ...week, 거리km: Number(week.거리km.toFixed(2)) })))}\n러닝 기록: ${JSON.stringify(details)}\n저장된 러닝 목표: ${goal || "없음"}\n사용자 추가 정보: ${context || "없음"}`;
  const model = process.env.OLLAMA_MODEL || "running-coach";
  let response: Response;
  try {
    response = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt, stream: false, think: false }), signal: AbortSignal.timeout(300000) });
  } catch { throw new Error("Ollama에 연결하지 못했습니다. Ollama가 실행 중인지 확인하세요."); }
  if (!response.ok) throw new Error(`Ollama 요청이 실패했습니다 (${response.status}). 모델 설치 상태를 확인하세요.`);
  const result = await response.json() as { response?: string };
  if (!result.response?.trim()) throw new Error("모델이 빈 응답을 반환했습니다.");
  const content = `# ${suffix[kind]}\n\n생성일: ${today}  \n${kind === "analysis" ? `분석 날짜: ${today}` : `참고 기간: ${start} ~ ${today}`}  \n모델: ${model}\n\n## 기록에서 계산한 통계\n\n- 러닝 ${active.length}회, 총 ${distance.toFixed(2)} km\n- 거리 가중 평균 페이스: ${stats.평균페이스 ?? "계산 불가"}\n- 기록된 날짜: ${stats.기록된날짜수}일 (기록이 없는 날은 확인되지 않음)\n\n${result.response.trim()}\n`;
  await mkdir(directory, { recursive: true });
  const prefix = `${today.replaceAll("-", "")}_${suffix[kind]}`;
  // 기존 보고서를 덮어쓰지 않고 같은 날짜의 결과를 별도로 보존한다.
  for (let index = 0; ; index++) {
    const filename = `${prefix}${index ? `_${index}` : ""}.md`;
    try { await writeFile(path.join(directory, filename), content, { encoding: "utf8", flag: "wx" }); return { filename, content }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
}
