"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/care/ui/Card";

type Kind = "analysis" | "plan";
type Document = { filename: string; content: string };

export function RunningInsights() {
  const [documents, setDocuments] = useState<Record<Kind, Document | null>>({ analysis: null, plan: null });
  const [context, setContext] = useState("");
  const [goal, setGoal] = useState("");
  const [savedGoal, setSavedGoal] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    // 화면을 다시 열어도 저장된 목표와 최신 결과를 표시한다.
    fetch("/api/running/insights").then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then((data) => { setDocuments(data); setGoal(data.goal); setSavedGoal(data.goal); setGoalLoaded(true); }).catch(() => setError("저장된 목표와 보고서를 불러오지 못했습니다."));
  }, []);
  // 목표 저장과 일회성 컨디션 입력을 구분해 이후 요청에도 목표를 유지한다.
  async function saveGoal() {
    setGoalSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/running/insights", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "목표를 저장하지 못했습니다.");
      setGoal(result.goal); setSavedGoal(result.goal); setNotice(result.goal ? "러닝 목표를 저장했습니다." : "러닝 목표를 지웠습니다.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "목표를 저장하지 못했습니다."); }
    finally { setGoalSaving(false); }
  }
  async function generate(kind: Kind) {
    if (goal !== savedGoal) { setError("변경한 목표를 먼저 저장해 주세요."); return; }
    setBusy(kind); setError(""); setNotice("");
    try {
      const response = await fetch("/api/running/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, context }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "생성하지 못했습니다.");
      setDocuments((previous) => ({ ...previous, [kind]: result }));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "생성하지 못했습니다."); }
    finally { setBusy(null); }
  }
  return <Card title="로컬 AI 러닝 분석과 계획" className="mb-6">
    <label htmlFor="running-goal" className="mb-1 block text-sm font-semibold">저장할 러닝 목표</label>
    <p className="mb-2 text-sm text-slate-600">저장한 목표는 분석과 계획을 생성할 때 자동으로 사용합니다. 예: 10km 45분 완주</p>
    <div className="mb-4 flex flex-wrap gap-2"><input id="running-goal" value={goal} onChange={(event) => { setGoal(event.target.value); setNotice(""); }} maxLength={500} placeholder="예: 10km 45분 완주" className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm" /><button type="button" onClick={saveGoal} disabled={!goalLoaded || goalSaving || busy !== null} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">{goalSaving ? "저장 중…" : "목표 저장"}</button></div>
    {notice && <p role="status" className="mb-3 text-sm text-emerald-700">{notice}</p>}
    <p className="mb-3 text-sm text-slate-600">최근 28일의 기록을 사용합니다. 이번 요청에 필요한 통증, 피로, 수면이나 일정을 입력해 주세요.</p>
    <textarea aria-label="현재 컨디션과 일정" value={context} onChange={(event) => setContext(event.target.value)} maxLength={2000} placeholder="예: 통증 여부, 피로도, 수면, 가능한 러닝 요일" className="mb-3 w-full rounded-lg border border-slate-300 p-3 text-sm" rows={3} />
    <div className="flex flex-wrap gap-2">{(["analysis", "plan"] as const).map((kind) => <button key={kind} type="button" disabled={busy !== null || goalSaving || !goalLoaded} onClick={() => generate(kind)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy === kind ? "생성 중…" : kind === "analysis" ? "분석 보고서 생성" : "러닝 계획 생성"}</button>)}</div>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-4 grid gap-4 lg:grid-cols-2">{(["analysis", "plan"] as const).map((kind) => <section key={kind} className="min-w-0 rounded-lg border border-slate-200 p-3"><h3 className="font-semibold">{kind === "analysis" ? "최근 분석 보고서" : "최근 러닝 계획"}</h3>{documents[kind] ? <><p className="mt-1 break-all text-xs text-slate-500">{documents[kind]?.filename}</p><pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-6">{documents[kind]?.content}</pre></> : <p className="mt-2 text-sm text-slate-500">저장된 결과가 없습니다.</p>}</section>)}</div>
  </Card>;
}
