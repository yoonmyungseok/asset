"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/care/ui/Card";

type Kind = "analysis" | "plan";
type Document = { filename: string; content: string };

export function RunningInsights() {
  const [documents, setDocuments] = useState<Record<Kind, Document | null>>({ analysis: null, plan: null });
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    // 대시보드를 다시 열어도 디스크에 저장된 최신 결과를 표시한다.
    fetch("/api/running/insights").then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(setDocuments).catch(() => setError("저장된 보고서를 불러오지 못했습니다."));
  }, []);
  async function generate(kind: Kind) {
    setBusy(kind); setError("");
    try {
      const response = await fetch("/api/running/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, context }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "생성하지 못했습니다.");
      setDocuments((previous) => ({ ...previous, [kind]: result }));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "생성하지 못했습니다."); }
    finally { setBusy(null); }
  }
  return <Card title="로컬 AI 러닝 분석과 계획" className="mb-6">
    <p className="mb-3 text-sm text-slate-600">최근 28일의 기록을 사용합니다. 현재 통증, 피로, 수면, 목표나 일정이 있다면 입력해 주세요.</p>
    <textarea aria-label="러닝 목표와 현재 컨디션" value={context} onChange={(event) => setContext(event.target.value)} maxLength={2000} placeholder="예: 목표, 통증 여부, 피로도, 수면, 가능한 러닝 요일" className="mb-3 w-full rounded-lg border border-slate-300 p-3 text-sm" rows={3} />
    <div className="flex flex-wrap gap-2">{(["analysis", "plan"] as const).map((kind) => <button key={kind} type="button" disabled={busy !== null} onClick={() => generate(kind)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy === kind ? "생성 중…" : kind === "analysis" ? "분석 보고서 생성" : "러닝 계획 생성"}</button>)}</div>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-4 grid gap-4 lg:grid-cols-2">{(["analysis", "plan"] as const).map((kind) => <section key={kind} className="min-w-0 rounded-lg border border-slate-200 p-3"><h3 className="font-semibold">{kind === "analysis" ? "최근 분석 보고서" : "최근 러닝 계획"}</h3>{documents[kind] ? <><p className="mt-1 break-all text-xs text-slate-500">{documents[kind]?.filename}</p><pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-6">{documents[kind]?.content}</pre></> : <p className="mt-2 text-sm text-slate-500">저장된 결과가 없습니다.</p>}</section>)}</div>
  </Card>;
}
