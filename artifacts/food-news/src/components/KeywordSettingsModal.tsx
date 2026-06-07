import React, { useState, useEffect } from "react";
import { useGetKeywordConfig, useSaveKeywordConfig, getGetKeywordConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Settings, X, AlertTriangle, AlertCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_BASE = "https://workspaceapi-server-production-8898.up.railway.app";

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
  const accentClass = isHigh ? "text-red-400 border-red-900/40 bg-red-950/20" : "text-amber-400 border-amber-900/40 bg-amber-950/20";
  const tagClass = isHigh ? "bg-red-900/30 text-red-300 border border-red-800/40" : "bg-amber-900/30 text-amber-300 border border-amber-800/40";
  const activeTagClass = isHigh ? "bg-red-900/50 text-red-200 border border-red-700/60" : "bg-amber-900/50 text-amber-200 border border-amber-700/60";

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

  const toggleEntry = (id: string) => onChange(entries.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)));
  const deleteEntry = (id: string) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className={`rounded-lg border p-4 ${accentClass}`}>
      <div className="flex items-center gap-2 mb-3">
        {isHigh ? <AlertTriangle className="w-4 h-4 text-red-400 flex-none" /> : <AlertCircle className="w-4 h-4 text-amber-400 flex-none" />}
        <span className={`text-sm font-semibold ${isHigh ? "text-red-400" : "text-amber-400"}`}>
          {isHigh ? "HIGH 위험" : "MEDIUM 위험"}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">{entries.filter((e) => e.enabled).length}/{entries.length} 활성화</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
        {entries.map((e) => (
          <span key={e.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer select-none ${e.enabled ? activeTagClass : tagClass} opacity-${e.enabled ? "100" : "50"}`}>
            <span onClick={() => toggleEntry(e.id)}>{e.value}</span>
            <button onClick={(ev) => { ev.stopPropagation(); deleteEntry(e.id); }} className="ml-1 hover:text-red-300"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addKeyword()} placeholder="키워드 추가..." className="h-7 text-xs bg-background/50" />
        <Button size="sm" variant="outline" onClick={addKeyword} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

// 식품 필터 키워드 에디터
function FoodFilterEditor() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/keywords/food-filter`)
      .then((r) => r.json())
      .then((data) => { setKeywords(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const addKeyword = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (keywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("이미 존재하는 키워드입니다");
      return;
    }
    setKeywords([...keywords, trimmed]);
    setNewValue("");
  };

  const deleteKeyword = (kw: string) => setKeywords(keywords.filter((k) => k !== kw));

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/keywords/food-filter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keywords),
      });
      toast.success("식품 필터 키워드가 저장되었습니다");
    } catch {
      toast.error("저장 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="rounded-lg border p-4 text-green-400 border-green-900/40 bg-green-950/20">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-green-400 flex-none" />
        <span className="text-sm font-semibold text-green-400">식품 관련 필터</span>
        <span className="text-xs text-muted-foreground ml-auto">{keywords.length}개 키워드</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">이 키워드 중 하나라도 포함된 기사만 수집됩니다. 식품과 무관한 기사를 걸러냅니다.</p>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem] max-h-40 overflow-y-auto">
        {keywords.map((kw) => (
          <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-200 border border-green-700/60">
            {kw}
            <button onClick={() => deleteKeyword(kw)} className="ml-1 hover:text-red-300"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addKeyword()} placeholder="키워드 추가..." className="h-7 text-xs bg-background/50" />
        <Button size="sm" variant="outline" onClick={addKeyword} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="w-full h-7 text-xs bg-green-900/50 hover:bg-green-900/70 text-green-200">
        {saving ? "저장 중..." : "저장"}
      </Button>
    </div>
  );
}

interface KeywordSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeywordSettingsModal({ open, onOpenChange }: KeywordSettingsModalProps) {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useGetKeywordConfig();
  const saveConfig = useSaveKeywordConfig();
  const [local, setLocal] = useState<KeywordConfig>({ high: [], medium: [] });
  const [activeTab, setActiveTab] = useState<"risk" | "filter">("risk");

  useEffect(() => {
    if (config) setLocal({ high: config.high ?? [], medium: config.medium ?? [] });
  }, [config]);

  const handleSaveRisk = () => {
    saveConfig.mutate({ data: local }, {
      onSuccess: () => {
        toast.success("위험 키워드가 저장되었습니다");
        queryClient.invalidateQueries({ queryKey: getGetKeywordConfigQueryKey() });
      },
      onError: () => toast.error("저장 중 오류가 발생했습니다"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Settings className="w-4 h-4" /> 키워드 설정
          </DialogTitle>
        </DialogHeader>

        {/* 탭 */}
        <div className="flex gap-2 border-b border-border pb-2">
          <button onClick={() => setActiveTab("risk")} className={`text-xs px-3 py-1 rounded-t ${activeTab === "risk" ? "bg-card border border-border border-b-card text-foreground" : "text-muted-foreground"}`}>
            위험 키워드
          </button>
          <button onClick={() => setActiveTab("filter")} className={`text-xs px-3 py-1 rounded-t ${activeTab === "filter" ? "bg-card border border-border border-b-card text-foreground" : "text-muted-foreground"}`}>
            식품 필터
          </button>
        </div>

        {activeTab === "risk" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">기사에 포함된 키워드에 따라 위험도(HIGH/MEDIUM)가 자동 분류됩니다.</p>
            {isLoading ? (
              <div className="text-xs text-muted-foreground">불러오는 중...</div>
            ) : (
              <>
                <GroupEditor level="high" entries={local.high} onChange={(e) => setLocal((p) => ({ ...p, high: e }))} />
                <GroupEditor level="medium" entries={local.medium} onChange={(e) => setLocal((p) => ({ ...p, medium: e }))} />
                <Button onClick={handleSaveRisk} disabled={saveConfig.isPending} className="w-full" size="sm">
                  {saveConfig.isPending ? "저장 중..." : "위험 키워드 저장"}
                </Button>
              </>
            )}
          </div>
        )}

        {activeTab === "filter" && <FoodFilterEditor />}
      </DialogContent>
    </Dialog>
  );
}
