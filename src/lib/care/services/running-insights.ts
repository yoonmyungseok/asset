import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { calculateAveragePace, formatPace, isActiveRun } from "@/lib/care/calculations/running";
import { getRestDayTypeSet } from "@/lib/care/services/running-types";
import { formatDate, todayString } from "@/lib/care/utils";

// 생성물은 개인 건강 정보이므로 저장소에서 제외한 로컬 디렉터리에 보관한다.
const directory = path.join(process.cwd(), "data", "running-reports");
const suffix = { analysis: "분석보고서", plan: "러닝계획" } as const;
export type InsightKind = keyof typeof suffix;

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
  const start = formatDate(subDays(new Date(), 27));
  const [records, excluded] = await Promise.all([
    prisma.runningRecord.findMany({ where: { date: { gte: start, lte: today } }, include: { splits: { orderBy: { splitNumber: "asc" } } }, orderBy: { date: "asc" } }),
    getRestDayTypeSet(),
  ]);
  const active = records.filter((record) => isActiveRun(record, excluded) && record.distance > 0);
  if (!active.length) throw new Error("최근 28일에 분석할 러닝 기록이 없습니다.");
  // 모델이 산술을 추측하지 않도록 합계와 거리 가중 평균 페이스를 먼저 계산한다.
  const distance = active.reduce((sum, record) => sum + record.distance, 0);
  const stats = { 기간: `${start} ~ ${today}`, 러닝횟수: active.length, 총거리km: Number(distance.toFixed(2)), 평균페이스: formatPace(calculateAveragePace(active, excluded)), 기록된날짜수: new Set(records.map((record) => record.date)).size };
  // 공통 지시문은 Ollama 모델에 저장하고, 요청마다 달라지는 자료만 전달한다.
  const prompt = `한국어 마크다운으로 ${kind === "analysis" ? "러닝 분석 보고서" : "앞으로 1주일의 러닝 계획"}를 작성하세요.\n계산된 통계: ${JSON.stringify(stats)}\n러닝 기록(거리 km, 시간 초): ${JSON.stringify(records)}\n사용자 추가 정보: ${context || "없음"}`;
  const model = process.env.OLLAMA_MODEL || "running-coach";
  let response: Response;
  try {
    response = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt, stream: false, think: false }), signal: AbortSignal.timeout(300000) });
  } catch { throw new Error("Ollama에 연결하지 못했습니다. Ollama가 실행 중인지 확인하세요."); }
  if (!response.ok) throw new Error(`Ollama 요청이 실패했습니다 (${response.status}). 모델 설치 상태를 확인하세요.`);
  const result = await response.json() as { response?: string };
  if (!result.response?.trim()) throw new Error("모델이 빈 응답을 반환했습니다.");
  const content = `# ${suffix[kind]}\n\n생성일: ${today}  \n분석 기간: ${start} ~ ${today}  \n모델: ${model}\n\n## 기록에서 계산한 통계\n\n- 러닝 ${active.length}회, 총 ${distance.toFixed(2)} km\n- 거리 가중 평균 페이스: ${stats.평균페이스}\n- 기록된 날짜: ${stats.기록된날짜수}일 (기록이 없는 날은 확인되지 않음)\n\n${result.response.trim()}\n`;
  await mkdir(directory, { recursive: true });
  const prefix = `${today.replaceAll("-", "")}_${suffix[kind]}`;
  // 기존 보고서를 덮어쓰지 않고 같은 날짜의 결과를 별도로 보존한다.
  for (let index = 0; ; index++) {
    const filename = `${prefix}${index ? `_${index}` : ""}.md`;
    try { await writeFile(path.join(directory, filename), content, { encoding: "utf8", flag: "wx" }); return { filename, content }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
}
