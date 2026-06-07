import React, { useState, useEffect } from "react";
import { useGetKeywordConfig, useSaveKeywordConfig, getGetKeywordConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, AlertTriangle, AlertCircle, Filter, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_BASE = "https://workspaceapi-server-production-8898.up.railway.app";

interface KeywordEntry { id: string; value: string; enabled: boolean; }
interface KeywordConfig { high: KeywordEntry[]; medium: KeywordEntry[]; }

function genId() { return `kw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function GroupEditor({ level, entries, onChange }: { level: "high"|"medium"; entries: KeywordEntry[]; onChange: (e: KeywordEntry[]) => void }) {
  const [newValue, setNewValue] = useState("");
  const isHigh = level === "high";
  const borderClass = isHigh ? "border-red-900/40 bg-red-950/20" : "border-amber-900/40 bg-amber-950/20";
  const labelClass = isHigh ? "text-red-400" : "text-amber-400";
  const activeTag = isHigh ? "bg-red-900/50 text-red-200 border-red-700/60" : "bg-amber-900/50 text-amber-200 border-amber-700/60";
  const inactiveTag = isHigh ? "bg-red-900/30 text-red-300 border-red-800/40 opacity-50" : "bg-amber-900/30 text-amber-300 border-amber-800/40 opacity-50";

  const add = () => {
    const t = newValue.trim();
    if (!t) return;
    if (entries.some(e => e.value.toLowerCase() === t.toLowerCase())) { toast.error("이미 존재하는 키워드입니다"); return; }
    onChange([...entries, { id: genId(), value: t, enabled: true }]);
    setNewValue("");
  };

  return (
    <div className={`rounded-lg border p-4 ${borderClass}`}>
      <div className="flex items-center gap-2 mb-3">
        {isHigh ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
        <span className={`text-sm font-semibold ${labelClass}`}>{isHigh ? "HIGH 위험" : "MEDIUM 위험"}</span>
        <span className="text-xs text-muted-foreground ml-auto">{entries.filter(e=>e.enabled).length}/{entries.length} 활성화</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
        {entries.map(e => (
          <span key={e.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${e.enabled ? activeTag : inactiveTag}`}>
            <span className="cursor-pointer" onClick={() => onChange(entries.map(x => x.id===e.id ? {...x,enabled:!x.enabled} : x))}>{e.value}</span>
            <button type="button" className="ml-1 hover:text-red-300" onClick={(ev) => { ev.stopPropagation(); onChange(entries.filter(x=>x.id!==e.id)); }}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newValue} onChange={e=>setNewValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="키워드 추가..." className="h-7 text-xs bg-background/50" />
        <Button size="sm" variant="outline" onClick={add} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

function FoodFilterEditor() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/keywords/food-filter`)
      .then(r=>r.json()).then(d=>{setKeywords(d);setLoading(false);}).catch(()=>setLoading(false));
  }, []);

  const add = () => {
    const t = newValue.trim();
    if (!t) return;
    if (keywords.some(k=>k.toLowerCase()===t.toLowerCase())) { toast.error("이미 존재하는 키워드입니다"); return; }
    setKeywords([...keywords, t]);
    setNewValue("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/keywords/food-filter`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(keywords) });
      toast.success("식품 필터 키워드가 저장되었습니다");
    } catch { toast.error("저장 중 오류가 발생했습니다"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-xs text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="rounded-lg border p-4 border-green-900/40 bg-green-950/20">
      <div className="flex items-center gap-2 mb-2">
        <Filter className="w-4 h-4 text-green-400" />
        <span className="text-sm font-semibold text-green-400">식품 관련 필터</span>
        <span className="text-xs text-muted-foreground ml-auto">{keywords.length}개</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">이 키워드 중 하나라도 포함된 기사만 수집됩니다.</p>
      <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto">
        {keywords.map(kw => (
          <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-200 border border-green-700/60">
            {kw}
            <button type="button" className="ml-1 hover:text-red-300" onClick={() => setKeywords(keywords.filter(k=>k!==kw))}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <Input value={newValue} onChange={e=>setNewValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="키워드 추가..." className="h-7 text-xs bg-background/50" />
        <Button size="sm" variant="outline" onClick={add} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
      </div>
      <Button size="sm" onClick={save} disabled={saving} className="w-full h-7 text-xs bg-green-900/50 hover:bg-green-900/70 text-green-200">
        {saving ? "저장 중..." : "저장"}
      </Button>
    </div>
  );
}

export function KeywordSettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useGetKeywordConfig();
  const saveConfig = useSaveKeywordConfig();
  const [local, setLocal] = useState<KeywordConfig>({ high: [], medium: [] });
  const [activeTab, setActiveTab] = useState<"risk"|"filter">("risk");

  useEffect(() => {
    if (config) setLocal({ high: config.high ?? [], medium: config.medium ?? [] });
  }, [config]);

  const handleSave = () => {
    saveConfig.mutate({ data: local }, {
      onSuccess: () => { toast.success("저장되었습니다"); queryClient.invalidateQueries({ queryKey: getGetKeywordConfigQueryKey() }); },
      onError: () => toast.error("저장 중 오류가 발생했습니다"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Settings className="w-4 h-4" /> 키워드 설정
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 border-b border-border pb-2">
          <button onClick={()=>setActiveTab("risk")} className={`text-xs px-3 py-1 rounded ${activeTab==="risk" ? "bg-muted text-foreground" : "text-muted-foreground"}`}>위험 키워드</button>
          <button onClick={()=>setActiveTab("filter")} className={`text-xs px-3 py-1 rounded ${activeTab==="filter" ? "bg-muted text-foreground" : "text-muted-foreground"}`}>식품 필터</button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] space-y-4 pr-1">
          {activeTab === "risk" && (
            <>
              <p className="text-xs text-muted-foreground">기사에 포함된 키워드에 따라 위험도(HIGH/MEDIUM)가 자동 분류됩니다.</p>
              {isLoading ? <div className="text-xs text-muted-foreground">불러오는 중...</div> : (
                <>
                  <GroupEditor level="high" entries={local.high} onChange={e=>setLocal(p=>({...p,high:e}))} />
                  <GroupEditor level="medium" entries={local.medium} onChange={e=>setLocal(p=>({...p,medium:e}))} />
                  <Button onClick={handleSave} disabled={saveConfig.isPending} className="w-full" size="sm">
                    {saveConfig.isPending ? "저장 중..." : "위험 키워드 저장"}
                  </Button>
                </>
              )}
            </>
          )}
          {activeTab === "filter" && <FoodFilterEditor />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
