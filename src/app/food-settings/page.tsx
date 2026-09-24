"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/care/ui/Card";
import { Button } from "@/components/care/ui/Button";
import { Input } from "@/components/care/ui/Input";
import { Modal, ConfirmDialog } from "@/components/care/ui/Modal";
import { LoadingSpinner, EmptyState } from "@/components/care/ui/Loading";
import { RecordCard, MobileRecordList } from "@/components/care/ui/RecordCard";
import { useToast } from "@/components/care/ui/Toast";

interface FoodItem {
  id: number;
  name: string;
  standardAmount: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sodium: number | null;
}

const emptyFoodForm = {
  name: "",
  standardAmount: "",
  calories: "",
  carbs: "",
  protein: "",
  fat: "",
  sodium: "",
};

export default function FoodSettingsPage() {
  const { showToast } = useToast();
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyFoodForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadFoodItems = useCallback(async () => {
    const res = await fetch("/api/diet/food-items");
    const data: FoodItem[] = await res.json();
    setFoodItems(data);
  }, []);

  useEffect(() => {
    loadFoodItems().finally(() => setLoading(false));
  }, [loadFoodItems]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyFoodForm);
    setModalOpen(true);
  };

  const openEdit = (item: FoodItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      standardAmount: item.standardAmount,
      calories: item.calories.toString(),
      carbs: item.carbs.toString(),
      protein: item.protein.toString(),
      fat: item.fat.toString(),
      sodium: item.sodium?.toString() ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      standardAmount: form.standardAmount,
      calories: parseFloat(form.calories),
      carbs: parseFloat(form.carbs),
      protein: parseFloat(form.protein),
      fat: parseFloat(form.fat),
      sodium: form.sodium ? parseFloat(form.sodium) : null,
    };

    const url = editingId ? `/api/diet/food-items/${editingId}` : "/api/diet/food-items";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      showToast(data.error ?? "저장에 실패했습니다", "error");
      return;
    }

    setModalOpen(false);
    await loadFoodItems();
    showToast(editingId ? "음식이 수정되었습니다" : "음식이 추가되었습니다");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);

    const res = await fetch(`/api/diet/food-items/${deleteId}`, { method: "DELETE" });

    setSaving(false);
    setConfirmOpen(false);
    setDeleteId(null);

    if (!res.ok) {
      showToast("삭제에 실패했습니다", "error");
      return;
    }

    await loadFoodItems();
    showToast("음식이 삭제되었습니다");
  };

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">음식 설정</h1>
          <p className="text-sm text-slate-500">식단 기록에 사용할 음식 DB를 관리하세요</p>
        </div>
        <Button onClick={openAdd} className="w-full sm:w-auto">음식 추가</Button>
      </div>

      <Card>
        {foodItems.length === 0 ? (
          <EmptyState message="등록된 음식이 없습니다" />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-4">음식명</th>
                    <th className="pb-2 pr-4">기준량</th>
                    <th className="pb-2 pr-4">칼로리</th>
                    <th className="pb-2 pr-4">탄수화물</th>
                    <th className="pb-2 pr-4">단백질</th>
                    <th className="pb-2 pr-4">지방</th>
                    <th className="pb-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {foodItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium">{item.name}</td>
                      <td className="py-3 pr-4">{item.standardAmount}</td>
                      <td className="py-3 pr-4">{item.calories}</td>
                      <td className="py-3 pr-4">{item.carbs}g</td>
                      <td className="py-3 pr-4">{item.protein}g</td>
                      <td className="py-3 pr-4">{item.fat}g</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                            수정
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteId(item.id);
                              setConfirmOpen(true);
                            }}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MobileRecordList>
              {foodItems.map((item) => (
                <RecordCard
                  key={item.id}
                  title={item.name}
                  highlight={
                    <span className="text-sm text-slate-600">
                      기준량 {item.standardAmount} · {item.calories} kcal
                    </span>
                  }
                  fields={[
                    {
                      label: "탄/단/지",
                      value: `${item.carbs}/${item.protein}/${item.fat}g`,
                    },
                    ...(item.sodium != null
                      ? [{ label: "나트륨", value: `${item.sodium}mg` }]
                      : []),
                  ]}
                  actions={
                    <>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteId(item.id);
                          setConfirmOpen(true);
                        }}
                      >
                        삭제
                      </Button>
                    </>
                  }
                />
              ))}
            </MobileRecordList>
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "음식 수정" : "음식 추가"}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="음식명"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="sm:col-span-2"
            required
          />
          <Input
            label="기준량 (예: 130g, 1인분)"
            value={form.standardAmount}
            onChange={(e) => setForm({ ...form, standardAmount: e.target.value })}
            className="sm:col-span-2"
            required
          />
          <Input
            label="칼로리 (kcal)"
            type="number"
            value={form.calories}
            onChange={(e) => setForm({ ...form, calories: e.target.value })}
            required
          />
          <Input
            label="탄수화물 (g)"
            type="number"
            value={form.carbs}
            onChange={(e) => setForm({ ...form, carbs: e.target.value })}
            required
          />
          <Input
            label="단백질 (g)"
            type="number"
            value={form.protein}
            onChange={(e) => setForm({ ...form, protein: e.target.value })}
            required
          />
          <Input
            label="지방 (g)"
            type="number"
            value={form.fat}
            onChange={(e) => setForm({ ...form, fat: e.target.value })}
            required
          />
          <Input
            label="나트륨 (mg)"
            type="number"
            value={form.sodium}
            onChange={(e) => setForm({ ...form, sodium: e.target.value })}
            className="sm:col-span-2"
          />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => setModalOpen(false)}
            className="w-full sm:w-auto"
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !form.name ||
              !form.standardAmount ||
              !form.calories ||
              !form.carbs ||
              !form.protein ||
              !form.fat
            }
            className="w-full sm:w-auto"
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="음식 삭제"
        message="이 음식을 DB에서 삭제하시겠습니까?"
        loading={saving}
      />
    </>
  );
}
