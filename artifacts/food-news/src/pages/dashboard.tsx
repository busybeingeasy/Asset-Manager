import React, { useState, useMemo } from "react";
import { 
  useGetNews, 
  useGetNewsStats, 
  useGetTariffs, 
  useTriggerCrawl, 
  useGetScheduleStatus,
  useToggleSchedule,
  useGetSheetsStatus,
  useExportToSheets,
  useGetKeywordConfig,
  getGetNewsQueryKey, 
  getGetNewsStatsQueryKey,
  getGetScheduleStatusQueryKey,
  getGetSheetsStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, formatDistance } from "date-fns";
import { ko } from "date-fns/locale";
import { RefreshCw, Search, ExternalLink, Calendar, Filter, FileText, Globe, Layers, AlertTriangle, Clock, Bell, BellOff, Sheet, CheckCircle2, XCircle, Upload, Settings } from "lucide-react";
import { toast } from "sonner";
import { KeywordSettingsModal } from "@/components/KeywordSettingsModal";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORIES = [
  { id: "전체", label: "전체", icon: <Layers className="w-4 h-4 mr-2" /> },
  { id: "업계뉴스", label: "업계뉴스", icon: <FileText className="w-4 h-4 mr-2" /> },
  { id: "원재료동향", label: "원재료동향", icon: <Filter className="w-4 h-4 mr-2" /> },
  { id: "규제안전", label: "규제안전", icon: <AlertTriangle className="w-4 h-4 mr-2" /> },
  { id: "해외뉴스", label: "해외뉴스", icon: <Globe className="w-4 h-4 mr-2" /> },
];

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>("");

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchKeyword);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const queryParams = useMemo(() => {
    const params: { category?: string; keyword?: string } = {};
    if (selectedCategory !== "전체") params.category = selectedCategory;
    if (debouncedKeyword) params.keyword = debouncedKeyword;
    return params;
  }, [selectedCategory, debouncedKeyword]);

  const { data: news, isLoading: isLoadingNews } = useGetNews(queryParams, {
    query: {
      queryKey: getGetNewsQueryKey(queryParams),
      staleTime: 60000,
    }
  });

  const { data: stats } = useGetNewsStats({
    query: {
      queryKey: getGetNewsStatsQueryKey(),
      staleTime: 60000,
    }
  });

  const { data: tariffs } = useGetTariffs();

  const { data: scheduleStatus, refetch: refetchSchedule } = useGetScheduleStatus({
    query: { queryKey: getGetScheduleStatusQueryKey(), refetchInterval: 30000 }
  });

  const { data: sheetsStatus, refetch: refetchSheetsStatus } = useGetSheetsStatus({
    query: { queryKey: getGetSheetsStatusQueryKey(), refetchInterval: 60000 }
  });

  const toggleSchedule = useToggleSchedule();
  const exportToSheets = useExportToSheets();
  const triggerCrawl = useTriggerCrawl();
  const { data: keywordConfig } = useGetKeywordConfig();
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);

  const getRiskLevel = useMemo(() => {
    const high = (keywordConfig?.high ?? []).filter((e) => e.enabled).map((e) => e.value.toLowerCase());
    const medium = (keywordConfig?.medium ?? []).filter((e) => e.enabled).map((e) => e.value.toLowerCase());
    return (article: { title: string; description?: string | null; keywords: string[] }) => {
      const text = (article.title + " " + (article.description ?? "") + " " + article.keywords.join(" ")).toLowerCase();
      if (high.some((kw) => text.includes(kw))) return "HIGH";
      if (medium.some((kw) => text.includes(kw))) return "MEDIUM";
      return "LOW";
    };
  }, [keywordConfig]);

  const handleToggleSchedule = () => {
    toggleSchedule.mutate(undefined, {
      onSuccess: (data) => {
        refetchSchedule();
        toast.success(data.enabled ? "자동 크롤링이 활성화되었습니다" : "자동 크롤링이 비활성화되었습니다");
      },
      onError: () => toast.error("스케줄 변경 중 오류가 발생했습니다"),
    });
  };

  const handleExportToSheets = () => {
    exportToSheets.mutate(undefined, {
      onSuccess: (result) => {
        refetchSheetsStatus();
        if (result.success) {
          toast.success(`Google Sheets 내보내기 완료: ${result.newRows}개 새 행, ${result.skippedDuplicates}개 중복 건너뜀`);
        } else {
          toast.error(`내보내기 실패: ${result.error ?? result.message}`);
        }
      },
      onError: () => toast.error("Google Sheets 내보내기 중 오류가 발생했습니다"),
    });
  };

  const handleCrawl = () => {
    triggerCrawl.mutate(undefined, {
      onSuccess: () => {
        toast.success("업데이트가 완료되었습니다.");
        queryClient.invalidateQueries({ queryKey: getGetNewsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNewsStatsQueryKey() });
      },
      onError: (err) => {
        toast.error("업데이트 중 오류가 발생했습니다.");
        console.error(err);
      }
    });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true, locale: ko });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="bg-primary/20 text-primary p-1.5 rounded-md">
              <Layers className="w-5 h-5" />
            </span>
            식품 뉴스 대시보드
          </h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-wide">현대그린푸드 구매팀 인텔리전스 허브</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <Calendar className="w-3.5 h-3.5" />
              마지막 업데이트
            </div>
            <div className="mt-0.5 text-white/80 font-mono">
              {stats?.lastCrawled ? format(new Date(stats.lastCrawled), "yyyy-MM-dd HH:mm:ss") : "-"}
            </div>
          </div>
          <Button
            onClick={handleExportToSheets}
            disabled={exportToSheets.isPending || !sheetsStatus?.connected}
            variant="outline"
            className="border-border hover:bg-card font-medium"
            title={sheetsStatus?.connected ? "Google Sheets로 내보내기" : "Google Sheets 미연결"}
          >
            <Upload className={`w-4 h-4 mr-2 ${exportToSheets.isPending ? "animate-bounce" : ""}`} />
            Sheets 내보내기
          </Button>
          <Button
            onClick={() => setKeywordModalOpen(true)}
            variant="outline"
            className="border-border hover:bg-card font-medium"
            title="키워드 알림 설정"
          >
            <Settings className="w-4 h-4 mr-2" />
            키워드 설정
          </Button>
          <Button 
            onClick={handleCrawl} 
            disabled={triggerCrawl.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${triggerCrawl.isPending ? "animate-spin" : ""}`} />
            🔄 지금 업데이트
          </Button>
        </div>
      </header>
      <KeywordSettingsModal open={keywordModalOpen} onClose={() => setKeywordModalOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Main Column */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          
          {/* Stats Strip */}
          <div className="flex-none p-6 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">총 기사 수</CardTitle>
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.total?.toLocaleString() ?? "-"}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">국내뉴스 (Naver)</CardTitle>
                  <span className="text-sm">🇰🇷</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.sources?.naver?.toLocaleString() ?? "-"}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">해외뉴스 (Google)</CardTitle>
                  <span className="text-sm">🌍</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.sources?.google?.toLocaleString() ?? "-"}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">금일 수집 비율</CardTitle>
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">100%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-none px-6 py-5 flex items-center justify-between gap-4">
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-auto">
              <TabsList className="bg-card border border-border h-10">
                {CATEGORIES.map(cat => (
                  <TabsTrigger 
                    key={cat.id} 
                    value={cat.id}
                    className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4"
                  >
                    {cat.icon}
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="키워드 검색..." 
                className="pl-9 bg-card border-border h-10 focus-visible:ring-primary/50"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
          </div>

          {/* News Grid */}
          <ScrollArea className="flex-1 px-6 pb-6">
            {isLoadingNews ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Card key={i} className="bg-card border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="w-12 h-5 rounded-sm" />
                        <Skeleton className="w-16 h-5 rounded-sm" />
                      </div>
                      <Skeleton className="w-full h-6 mb-2" />
                      <Skeleton className="w-3/4 h-6" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="w-full h-4 mb-2" />
                      <Skeleton className="w-2/3 h-4 mb-4" />
                      <div className="flex gap-2">
                        <Skeleton className="w-16 h-5 rounded-full" />
                        <Skeleton className="w-16 h-5 rounded-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : news?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Search className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg font-medium text-white/70 mb-2">검색 결과가 없습니다</p>
                <p className="text-sm mb-6">🔄 지금 업데이트 버튼을 클릭하여 뉴스를 불러오세요</p>
                <Button variant="outline" onClick={handleCrawl} className="border-border hover:bg-card">
                  업데이트 실행
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                {news?.map((article) => (
                  <a 
                    key={article.id} 
                    href={article.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block group"
                  >
                    <Card className="h-full bg-card border-border/50 hover:border-primary/50 transition-colors duration-200">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <Badge variant="secondary" className="bg-secondary/50 font-normal">
                            {article.source === "naver" ? "🇰🇷 국내" : "🌍 해외"}
                          </Badge>
                          <Badge variant="outline" className="border-border/50 text-muted-foreground">
                            {article.category}
                          </Badge>
                          {(() => {
                            const risk = getRiskLevel(article);
                            if (risk === "HIGH") return (
                              <Badge className="bg-red-900/40 text-red-300 border border-red-800/50 hover:bg-red-900/40 font-semibold text-[10px]">
                                ⚠ HIGH
                              </Badge>
                            );
                            if (risk === "MEDIUM") return (
                              <Badge className="bg-amber-900/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/40 font-semibold text-[10px]">
                                ● MEDIUM
                              </Badge>
                            );
                            return null;
                          })()}
                          <span className="ml-auto text-xs text-muted-foreground font-mono">
                            {formatDate(article.pubDate)}
                          </span>
                        </div>
                        <CardTitle className="text-base font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                          {/* dangerouslySetInnerHTML used because naive titles might have html tags like <b> from search APIs. Safely clean it or just display. */}
                          <span dangerouslySetInnerHTML={{ __html: article.title.replace(/<[^>]*>?/gm, '') }} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col justify-between h-[calc(100%-110px)]">
                        {article.description && (
                          <CardDescription className="text-sm text-muted-foreground/80 line-clamp-2 mb-4">
                            {article.description.replace(/<[^>]*>?/gm, '')}
                          </CardDescription>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                          {article.keywords?.map((kw, i) => (
                            <span key={i} className="text-xs text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-sm">
                              #{kw}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 flex-none bg-card/30 flex flex-col border-l border-border">

          {/* Schedule Panel */}
          <div className="flex-none border-b border-border">
            <div className="p-4 bg-card/50">
              <h2 className="font-semibold flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" />
                자동 크롤링
              </h2>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${scheduleStatus?.enabled ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
                    <span className="text-sm font-medium">
                      {scheduleStatus?.enabled ? "활성화" : "비활성화"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scheduleStatus?.intervalHours}시간마다 자동 수집
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={scheduleStatus?.enabled ? "destructive" : "default"}
                  onClick={handleToggleSchedule}
                  disabled={toggleSchedule.isPending}
                  className="h-8 text-xs"
                >
                  {scheduleStatus?.enabled ? "중지" : "시작"}
                </Button>
              </div>

              {scheduleStatus?.enabled && scheduleStatus.nextRun && (
                <div className="text-xs bg-background rounded p-2 border border-border/50">
                  <span className="text-muted-foreground">다음 크롤링: </span>
                  <span className="text-white/80 font-mono">
                    {format(new Date(scheduleStatus.nextRun), "HH:mm")}
                    <span className="text-muted-foreground ml-1">
                      ({formatDistance(new Date(scheduleStatus.nextRun), new Date(), { locale: ko, addSuffix: true })})
                    </span>
                  </span>
                </div>
              )}

              {scheduleStatus?.lastRun && (
                <p className="text-xs text-muted-foreground mt-2">
                  마지막 자동 수집: {formatDistanceToNow(new Date(scheduleStatus.lastRun), { locale: ko, addSuffix: true })}
                </p>
              )}
            </div>

            {/* Slack Status */}
            <div className="px-4 pb-3 flex items-center gap-2">
              {scheduleStatus?.slackEnabled ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-green-400">Slack 알림 활성화됨</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Slack 알림 미설정
                    <span className="ml-1 opacity-60">(SLACK_WEBHOOK_URL)</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Google Sheets Panel */}
          <div className="flex-none border-b border-border">
            <div className="p-4 bg-card/50">
              <h2 className="font-semibold flex items-center gap-2 mb-3">
                <Sheet className="w-4 h-4 text-primary" />
                Google Sheets 연동
              </h2>

              <div className="flex items-center gap-2 mb-3">
                {sheetsStatus?.connected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-none" />
                    <span className="text-sm text-green-400 font-medium">연결됨</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-muted-foreground flex-none" />
                    <span className="text-sm text-muted-foreground">미연결</span>
                  </>
                )}
              </div>

              {sheetsStatus?.connected ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background rounded p-2 border border-border/50">
                      <div className="text-muted-foreground mb-0.5">총 행 수</div>
                      <div className="text-white font-mono font-semibold">
                        {sheetsStatus.totalRows?.toLocaleString() ?? "-"}
                      </div>
                    </div>
                    <div className="bg-background rounded p-2 border border-border/50">
                      <div className="text-muted-foreground mb-0.5">마지막 내보내기</div>
                      <div className="text-white font-mono">
                        {sheetsStatus.lastExportCount != null ? `+${sheetsStatus.lastExportCount}행` : "-"}
                      </div>
                    </div>
                  </div>
                  {sheetsStatus.lastExportAt && (
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(sheetsStatus.lastExportAt), { locale: ko, addSuffix: true })}
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleExportToSheets}
                    disabled={exportToSheets.isPending}
                  >
                    <Upload className={`w-3.5 h-3.5 mr-1.5 ${exportToSheets.isPending ? "animate-bounce" : ""}`} />
                    {exportToSheets.isPending ? "내보내는 중..." : "지금 내보내기"}
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>연결하려면 환경 변수를 설정하세요:</p>
                  <div className="bg-background rounded p-2 border border-border/50 font-mono space-y-1 leading-relaxed">
                    <div className="text-orange-400/80">GOOGLE_SERVICE_ACCOUNT_EMAIL</div>
                    <div className="text-orange-400/80">GOOGLE_PRIVATE_KEY</div>
                    <div className="text-orange-400/80">GOOGLE_SHEET_ID</div>
                  </div>
                  {sheetsStatus?.error && (
                    <p className="text-red-400/70 text-[10px] leading-relaxed">{sheetsStatus.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tariffs */}
          <div className="p-4 border-b border-border bg-card/50">
            <h2 className="font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              글로벌 관세/통상 정보
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              업데이트: {tariffs?.lastUpdated ? format(new Date(tariffs.lastUpdated), "MM/dd HH:mm") : "-"}
            </p>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {!tariffs?.items?.length ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  표시할 관세 정보가 없습니다
                </div>
              ) : (
                tariffs.items.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg bg-background border border-border/50 hover:border-primary/30 transition-colors">
                    <a href={item.link} target="_blank" rel="noreferrer" className="block group">
                      <h3 className="text-sm font-medium text-white/90 group-hover:text-primary mb-1.5 line-clamp-2 flex items-start gap-1.5">
                        <span className="mt-0.5 flex-none"><ExternalLink className="w-3 h-3" /></span>
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {item.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.keywords?.slice(0, 3).map((kw, i) => (
                          <span key={i} className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-sm">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </a>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          
          {tariffs?.source && (
            <div className="p-4 border-t border-border bg-card/50 text-center">
              <a 
                href="https://www.mafra.go.kr"
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-white inline-flex items-center gap-1"
              >
                출처: 농림축산식품부 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
