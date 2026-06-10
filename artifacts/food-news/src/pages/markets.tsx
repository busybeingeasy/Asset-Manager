import { useState, useEffect } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

const API_BASE = "https://workspaceapi-server-production-8898.up.railway.app";

interface MarketItem {
  name: string;
  symbol?: string;
  value: number | null;
  prevValue?: number | null;
  change?: number | null;
  changePct?: number | null;
  unit: string;
  date?: string;
  source?: string;
}

interface MarketData {
  oil: MarketItem[];
  commodities: MarketItem[];
  fx: MarketItem[];
  macro: MarketItem[];
  fao: MarketItem[];
  updatedAt: string | null;
}

function ChangeCell({ change, changePct }: { change?: number | null; changePct?: number | null }) {
  if (change == null && changePct == null) return <td className="px-4 py-3 text-gray-400 text-center">-</td>;
  const isUp = (change ?? changePct ?? 0) > 0;
  const isDown = (change ?? changePct ?? 0) < 0;
  const color = isUp ? "text-red-400" : isDown ? "text-green-400" : "text-gray-400";
  const bg = isUp ? "bg-red-950/30" : isDown ? "bg-green-950/30" : "";
  return (
    <td className={`px-4 py-3 text-center font-semibold ${color} ${bg}`}>
      <div className="flex items-center justify-center gap-1">
        {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {changePct != null ? `${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}%` : `${change! > 0 ? "+" : ""}${change!.toFixed(2)}`}
      </div>
    </td>
  );
}

function MarketTable({ title, icon, items, showDate = true }: { title: string; icon: string; items: MarketItem[]; showDate?: boolean }) {
  if (items.length === 0) return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">{icon} {title}</h2>
      <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
        데이터를 불러오는 중이거나 API 키를 확인해주세요.
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-foreground">{icon} {title}</h2>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-muted-foreground font-medium">종목명</th>
              <th className="px-4 py-3 text-right text-muted-foreground font-medium">현재값</th>
              <th className="px-4 py-3 text-right text-muted-foreground font-medium">이전값</th>
              <th className="px-4 py-3 text-center text-muted-foreground font-medium">변동</th>
              <th className="px-4 py-3 text-center text-muted-foreground font-medium">변동%</th>
              <th className="px-4 py-3 text-center text-muted-foreground font-medium">단위</th>
              {showDate && <th className="px-4 py-3 text-center text-muted-foreground font-medium">기준일</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                <td className="px-4 py-3 text-right font-bold text-foreground">
                  {item.value != null ? item.value.toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {item.prevValue != null ? item.prevValue.toLocaleString() : "-"}
                </td>
                <ChangeCell change={item.change} />
                <ChangeCell changePct={item.changePct} />
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">{item.unit}</td>
                {showDate && <td className="px-4 py-3 text-center text-muted-foreground text-xs">{item.date ?? "-"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FAOTable({ items }: { items: MarketItem[] }) {
  if (items.length === 0) return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">🌾 FAO 식품가격지수 (FFPI)</h2>
      <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
        데이터를 불러오는 중입니다.
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-foreground">🌾 FAO 식품가격지수 (FFPI)</h2>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-muted-foreground font-medium">기준월</th>
              <th className="px-4 py-3 text-right text-muted-foreground font-medium">지수값</th>
              <th className="px-4 py-3 text-center text-muted-foreground font-medium">출처</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{item.date}</td>
                <td className="px-4 py-3 text-right font-bold text-foreground">{item.value?.toLocaleString()}</td>
                <td className="px-4 py-3 text-center text-muted-foreground text-xs">{item.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MarketsPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/markets`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load market data", err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE}/api/markets/refresh`, { method: "POST" });
      await loadData();
    } catch (err) {
      console.error("Failed to refresh", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">원자재 & 매크로</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.updatedAt ? `마지막 업데이트: ${new Date(data.updatedAt).toLocaleString("ko-KR")}` : "데이터 없음"}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "업데이트 중..." : "지금 업데이트"}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-20">데이터 불러오는 중...</div>
      ) : (
        <>
          <MarketTable title="유가 (Oil Prices)" icon="🛢️" items={data?.oil ?? []} />
          <MarketTable title="원물 선물 (Commodities)" icon="🌾" items={data?.commodities ?? []} />
          <MarketTable title="환율 (Foreign Exchange)" icon="💱" items={data?.fx ?? []} />
          <MarketTable title="거시경제 지표 (Macro)" icon="📊" items={data?.macro ?? []} />
          <FAOTable items={data?.fao ?? []} />
        </>
      )}
    </div>
  );
}