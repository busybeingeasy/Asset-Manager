import React, { useState, useEffect } from "react";
import { useGetKeywordConfig, useSaveKeywordConfig, getGetKeywordConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Settings, X, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface KeywordEntry {
  id: string;
  value: string;
  enabled: boolean;
}

interface KeywordConfig {
  high: KeywordEntry[];
  medium: KeywordEntry[];
}

function genId() {
  return `kw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface GroupEditorProps {
  level: "high" | "medium";
  entries: KeywordEntry[];
  onChange: (entries: KeywordEntry[]) => void;
}

function GroupEditor({ level, entries, onChange }: GroupEditorProps) {
  const [newValue, setNewValue] = useState("");

  const isHigh = level === "high";
  const accentClass = isHigh
    ? "text-red-400 border-red-900/40 bg-red-950/20"
    : "text-amber-400 border-amber-900/40 bg-amber-950/20";
  const tagClass = isHigh
    ? "bg-red-900/30 text-red-300 border border-red-800/40"
    : "bg-amber-900/30 text-amber-300 border border-amber-800/40";
  const activeTagClass = isHigh
    ? "bg-red-900/50 text-red-200 border border-red-700/60"
    : "bg-amber-900/50 text-amber-200 border border-amber-700/60";

  const addKeyword = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (entries.some((e) => e.value.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("이미 존재하는 키워드입니다");
      return;
    }
    onChange([...entries, { id: genId(), value: trimmed, enabled: true }]);
    setNewValue("");
  };

  const toggleEntry = (id: string) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)));
  };

  const deleteEntry = (id: string) => {
    onChange(entries.filter((e) => e.id !== id));
  };

  return (
    <div className={`rounded-lg border p-4 ${accentClass}`}>
      <div className="flex items-center gap-2 mb-3">
        {isHigh ? (
          <AlertTriangle className="w-4 h-4 text-red-400 flex-none" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-400 flex-none" />
        )}
        <span className={`text-sm font-semibold ${isHigh ? "text-red-400" : "text-amber-400"}`}>
          {isHigh ? "HIGH 위험" : "MEDIUM 위험"}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {entries.filter((e) => e.enabled).length}/{entries.length} 활성화
        </span>
      </div>

      {/* Keyword tags */}
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
        {entries.length === 0 && (
          <span className="text-xs text-muted-foreground italic">키워드 없음</span>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`group flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-mono cursor-pointer select-none transition-all ${
              entry.enabled ? activeTagClass : "bg-muted/20 text-muted-foreground border border-border/30 line-through"
            }`}
          >
            <span onClick={() => toggleEntry(entry.id)} className="py-0.5">
              {entry.value}
            </span>
            <button
              onClick={() => deleteEntry(entry.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-white"
              title="삭제"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add input */}
      <div className="flex gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
          }}
          placeholder="키워드 입력 후 Enter..."
          className="h-7 text-xs bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/50"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={addKeyword}
          className="h-7 px-2 text-xs border-border/50"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        클릭하여 활성화/비활성화 · 우측 × 로 삭제
      </p>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeywordSettingsModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const { data: remoteConfig } = useGetKeywordConfig();
  const saveConfig = useSaveKeywordConfig();

  const [config, setConfig] = useState<KeywordConfig>({ high: [], medium: [] });
  const [dirty, setDirty] = useState(false);

  // Sync from server when opened
  useEffect(() => {
    if (remoteConfig && open) {
      setConfig({ high: remoteConfig.high, medium: remoteConfig.medium });
      setDirty(false);
    }
  }, [remoteConfig, open]);

  const handleChange = (level: "high" | "medium", entries: KeywordEntry[]) => {
    setConfig((prev) => ({ ...prev, [level]: entries }));
    setDirty(true);
  };

  const handleSave = () => {
    saveConfig.mutate(
      { high: config.high, medium: config.medium },
      {
        onSuccess: () => {
          toast.success("키워드 설정이 저장되었습니다");
          queryClient.invalidateQueries({ queryKey: getGetKeywordConfigQueryKey() });
          setDirty(false);
        },
        onError: () => toast.error("저장 중 오류가 발생했습니다"),
      }
    );
  };

  const handleReset = () => {
    if (!remoteConfig) return;
    setConfig({ high: remoteConfig.high, medium: remoteConfig.medium });
    setDirty(false);
  };

  const enabledHigh = config.high.filter((e) => e.enabled).length;
  const enabledMedium = config.medium.filter((e) => e.enabled).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4 text-primary" />
            키워드 알림 설정
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            뉴스 카드 위험도, Slack 알림, Google Sheets 내보내기에 적용됩니다.
            키워드를 클릭하면 활성/비활성 전환, × 로 삭제합니다.
          </p>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Summary row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground px-0.5">
            <span>
              <span className="text-red-400 font-medium">HIGH</span> {enabledHigh}개 활성
            </span>
            <span>·</span>
            <span>
              <span className="text-amber-400 font-medium">MEDIUM</span> {enabledMedium}개 활성
            </span>
            {dirty && (
              <span className="ml-auto text-orange-400/80 text-[10px]">저장되지 않은 변경사항</span>
            )}
          </div>

          <GroupEditor
            level="high"
            entries={config.high}
            onChange={(entries) => handleChange("high", entries)}
          />
          <GroupEditor
            level="medium"
            entries={config.medium}
            onChange={(entries) => handleChange("medium", entries)}
          />
        </div>

        <div className="flex justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!dirty || saveConfig.isPending}
            className="text-xs text-muted-foreground hover:text-white"
          >
            변경사항 취소
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              닫기
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saveConfig.isPending}
              className="text-xs"
            >
              {saveConfig.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
