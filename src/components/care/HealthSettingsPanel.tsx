"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/care/ui/Card";
import { Button } from "@/components/care/ui/Button";
import { Input } from "@/components/care/ui/Input";
import { Select } from "@/components/care/ui/Select";
import { LoadingSpinner } from "@/components/care/ui/Loading";
import { useToast } from "@/components/care/ui/Toast";
import { ACTIVITY_LEVEL_OPTIONS, GENDER_OPTIONS } from "@/lib/care/constants";

interface Settings {
  id: number;
  targetWeight: number;
  birthYear: number;
  gender: string;
  heightCm: number;
  activityLevel: string;
  targetCalories: number;
  targetCarbs: number;
  targetProtein: number;
  targetFat: number;
}

interface GoogleSheetsSettings {
  googleSpreadsheetId: string | null;
  googleRunningSheetName: string;
  googleRunningSplitSheetName: string;
  googleRunningHeaderMap: string | null;
  googleRunningSplitHeaderMap: string | null;
  googleRunningUpsertKey: string;
  googleRunningSplitUpsertKey: string;
  googleSheetsLastSyncedAt: string | null;
}

interface SheetInspectResult {
  running: {
    sheetName: string;
    headerRow: string[];
    matchedFields: string[];
    missingFields: string[];
  };
  splits: {
    sheetName: string;
    headerRow: string[];
    matchedFields: string[];
    missingFields: string[];
  };
}

export function HealthSettingsPanel() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({
    targetWeight: "",
    birthYear: "",
    gender: "male",
    heightCm: "",
    activityLevel: "moderate",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleSheets, setGoogleSheets] = useState<GoogleSheetsSettings | null>(null);
  const [sheetsForm, setSheetsForm] = useState({
    spreadsheetInput: "",
    googleRunningSheetName: "러닝",
    googleRunningSplitSheetName: "러닝_스플릿",
    googleRunningHeaderMap: "",
    googleRunningSplitHeaderMap: "",
    googleRunningUpsertKey: "record_id",
    googleRunningSplitUpsertKey: "record_id_split",
  });
  const [savingSheets, setSavingSheets] = useState(false);
  const [inspectingSheets, setInspectingSheets] = useState(false);
  const [sheetInspect, setSheetInspect] = useState<SheetInspectResult | null>(null);
  const [sheetsStatus, setSheetsStatus] = useState<{
    serviceAccountConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((res) => res.json()),
      fetch("/api/integrations/google-sheets/settings").then((res) => res.json()),
      fetch("/api/integrations/google-sheets/status").then((res) => res.json()),
    ])
      .then(([data, sheets, status]) => {
        setSettings(data as Settings);
        setForm({
          targetWeight: data.targetWeight.toString(),
          birthYear: data.birthYear.toString(),
          gender: data.gender,
          heightCm: data.heightCm.toString(),
          activityLevel: data.activityLevel,
        });
        const sheetSettings = sheets as GoogleSheetsSettings;
        setGoogleSheets(sheetSettings);
        setSheetsForm({
          spreadsheetInput: sheetSettings.googleSpreadsheetId ?? "",
          googleRunningSheetName: sheetSettings.googleRunningSheetName,
          googleRunningSplitSheetName: sheetSettings.googleRunningSplitSheetName,
          googleRunningHeaderMap: sheetSettings.googleRunningHeaderMap ?? "",
          googleRunningSplitHeaderMap: sheetSettings.googleRunningSplitHeaderMap ?? "",
          googleRunningUpsertKey: sheetSettings.googleRunningUpsertKey ?? "record_id",
          googleRunningSplitUpsertKey:
            sheetSettings.googleRunningSplitUpsertKey ?? "record_id_split",
        });
        setSheetsStatus({
          serviceAccountConfigured: Boolean(status.serviceAccountConfigured),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      targetWeight: parseFloat(form.targetWeight),
      birthYear: parseInt(form.birthYear, 10),
      gender: form.gender,
      heightCm: parseFloat(form.heightCm),
      activityLevel: form.activityLevel,
    };

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      showToast(data.error ?? "저장에 실패했습니다", "error");
      return;
    }

    setSettings(data);
    showToast("설정이 저장되었습니다");
  };

  const handleSaveGoogleSheets = async () => {
    setSavingSheets(true);
    const res = await fetch("/api/integrations/google-sheets/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sheetsForm),
    });
    const data = await res.json();
    setSavingSheets(false);

    if (!res.ok) {
      showToast(data.error ?? "저장에 실패했습니다", "error");
      return;
    }

    setGoogleSheets(data);
    setSheetsForm((prev) => ({
      ...prev,
      spreadsheetInput: data.googleSpreadsheetId ?? prev.spreadsheetInput,
    }));
    showToast("스프레드시트 설정이 저장되었습니다");
  };

  const handleInspectGoogleSheets = async () => {
    setInspectingSheets(true);
    setSheetInspect(null);
    const res = await fetch("/api/integrations/google-sheets/inspect");
    const data = await res.json();
    setInspectingSheets(false);

    if (!res.ok) {
      showToast(data.error ?? "시트를 읽지 못했습니다", "error");
      return;
    }

    setSheetInspect(data as SheetInspectResult);
    showToast("시트 1행 헤더를 읽었습니다");
  };

  const applyDailyLogKoPreset = async () => {
    const res = await fetch("/api/integrations/google-sheets/presets/daily-log-ko");
    const preset = await res.json();
    if (!res.ok) return;
    setSheetsForm((prev) => ({
      ...prev,
      ...preset,
    }));
    showToast("「러닝_기록_시트」형식이 적용되었습니다. URL 저장 후 「시트 1행 확인」을 눌러 보세요.");
  };

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
      <div className="max-w-lg space-y-6 pb-4">
        <Card title="체중 목표">
          <Input
            label="목표 체중 (kg)"
            type="number"
            step="0.1"
            value={form.targetWeight}
            onChange={(e) => setForm({ ...form, targetWeight: e.target.value })}
          />
        </Card>

        <Card title="프로필">
          <p className="mb-4 text-sm text-slate-500">
            프로필 정보를 기반으로 영양 목표가 자동 계산됩니다
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="출생년도"
              type="number"
              value={form.birthYear}
              onChange={(e) => setForm({ ...form, birthYear: e.target.value })}
            />
            <Select
              label="성별"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              options={GENDER_OPTIONS}
            />
            <Input
              label="키 (cm)"
              type="number"
              step="0.1"
              value={form.heightCm}
              onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
            />
            <Select
              label="활동 수준"
              value={form.activityLevel}
              onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
              options={ACTIVITY_LEVEL_OPTIONS}
            />
          </div>
        </Card>

        <Card title="Google 스프레드시트 (러닝)">
          <p className="mb-4 text-sm text-slate-500">
            앱은 시트 모양을 미리 알 수 없습니다. <strong>보내기 전에</strong> 지정한 탭의{" "}
            <strong>1행을 읽어</strong> 열 이름을 맞춥니다. upsert에는 최소{" "}
            <code className="text-xs">record_id</code> 열(또는 매핑)이 필요합니다. 서비스 계정을
            시트 <strong>편집자</strong>로 공유하세요.
          </p>
          {!sheetsStatus?.serviceAccountConfigured && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              .env에 GOOGLE_SERVICE_ACCOUNT_JSON(또는 EMAIL/PRIVATE_KEY)이 필요합니다.
            </p>
          )}
          <div className="space-y-4">
            <Input
              label="스프레드시트 URL 또는 ID"
              value={sheetsForm.spreadsheetInput}
              onChange={(e) =>
                setSheetsForm({ ...sheetsForm, spreadsheetInput: e.target.value })
              }
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="러닝 탭 이름"
                value={sheetsForm.googleRunningSheetName}
                onChange={(e) =>
                  setSheetsForm({ ...sheetsForm, googleRunningSheetName: e.target.value })
                }
              />
              <Input
                label="스플릿 탭 이름"
                value={sheetsForm.googleRunningSplitSheetName}
                onChange={(e) =>
                  setSheetsForm({
                    ...sheetsForm,
                    googleRunningSplitSheetName: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                러닝 탭 헤더 매핑 (JSON, 선택)
              </label>
              <p className="text-xs text-slate-500">
                앱 필드명 → 시트 1행에 적힌 이름. 예:{" "}
                <code className="text-[11px]">{`{"record_id":"기록ID","date":"날짜"}`}</code>
              </p>
              <textarea
                className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={sheetsForm.googleRunningHeaderMap}
                onChange={(e) =>
                  setSheetsForm({ ...sheetsForm, googleRunningHeaderMap: e.target.value })
                }
                placeholder='{"record_id":"기록ID"}'
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                스플릿 탭 헤더 매핑 (JSON, 선택)
              </label>
              <textarea
                className="min-h-16 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={sheetsForm.googleRunningSplitHeaderMap}
                onChange={(e) =>
                  setSheetsForm({ ...sheetsForm, googleRunningSplitHeaderMap: e.target.value })
                }
                placeholder='{"record_id":"기록ID","split_number":"km"}'
              />
            </div>
            {sheetInspect && (
              <div className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-700">
                <p className="font-semibold">읽은 헤더 ({sheetInspect.running.sheetName})</p>
                <p className="mt-1 break-words">
                  {sheetInspect.running.headerRow.length > 0
                    ? sheetInspect.running.headerRow.join(" | ")
                    : "(없음)"}
                </p>
                <p className="mt-2">
                  매칭됨: {sheetInspect.running.matchedFields.join(", ") || "없음"}
                </p>
                {sheetInspect.running.missingFields.length > 0 && (
                  <p className="mt-1 text-amber-800">
                    아직 못 찾은 열: {sheetInspect.running.missingFields.join(", ")}
                  </p>
                )}
              </div>
            )}
            {googleSheets?.googleSheetsLastSyncedAt && (
              <p className="text-xs text-slate-500">
                마지막 동기화:{" "}
                {new Date(googleSheets.googleSheetsLastSyncedAt).toLocaleString("ko-KR")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={applyDailyLogKoPreset}>
                러닝_기록_시트 형식 적용
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveGoogleSheets}
                disabled={savingSheets}
              >
                {savingSheets ? "저장 중..." : "스프레드시트 설정 저장"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleInspectGoogleSheets}
                disabled={inspectingSheets}
              >
                {inspectingSheets ? "읽는 중..." : "시트 1행 확인"}
              </Button>
            </div>
          </div>
        </Card>

        <Card title="데이터 관리" className="lg:hidden">
          <div className="divide-y divide-slate-100">
            <Link
              href="/running-settings"
              className="flex min-h-11 items-center justify-between py-3 text-sm font-medium text-slate-700"
            >
              <span>🏷️ 러닝 종류 설정</span>
              <span className="text-slate-400">›</span>
            </Link>
            <Link
              href="/food-settings"
              className="flex min-h-11 items-center justify-between py-3 text-sm font-medium text-slate-700"
            >
              <span>🥗 음식 설정</span>
              <span className="text-slate-400">›</span>
            </Link>
          </div>
        </Card>

        <Card title="영양 목표 (하루) — 자동 계산">
          <p className="mb-4 text-sm text-slate-500">
            최신 체중 기록과 프로필을 기반으로 Mifflin-St Jeor 공식으로 계산됩니다
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3 sm:px-4">
              <p className="text-xs text-slate-500">목표 칼로리</p>
              <p className="break-words text-base font-semibold text-slate-900 sm:text-lg">
                {settings?.targetCalories.toLocaleString()} kcal
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3 sm:px-4">
              <p className="text-xs text-slate-500">목표 탄수화물</p>
              <p className="break-words text-base font-semibold text-slate-900 sm:text-lg">
                {settings?.targetCarbs.toLocaleString()} g
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3 sm:px-4">
              <p className="text-xs text-slate-500">목표 단백질</p>
              <p className="break-words text-base font-semibold text-slate-900 sm:text-lg">
                {settings?.targetProtein.toLocaleString()} g
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3 sm:px-4">
              <p className="text-xs text-slate-500">목표 지방</p>
              <p className="break-words text-base font-semibold text-slate-900 sm:text-lg">
                {settings?.targetFat.toLocaleString()} g
              </p>
            </div>
          </div>
        </Card>

        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "저장 중..." : "설정 저장"}
          </Button>
        </div>
      </div>
  );
}
