import schedule from "node-schedule";
import axios from "axios";
import { crawlAllNews, readNews, type NewsArticle } from "./crawler";
import { exportToGoogleSheets } from "./sheets";
import { logger } from "./logger";

const INTERVAL_HOURS = 6;

const ALERT_KEYWORDS = [
  "할당관세", "수입금지", "검역", "리콜", "수출제한",
  "tariff", "ban", "recall", "embargo", "shortage",
  "농심", "오뚜기", "CJ", "삼양", "풀무원",
];

interface SchedulerState {
  enabled: boolean;
  job: schedule.Job | null;
  nextRun: Date | null;
  lastRun: Date | null;
}

const state: SchedulerState = {
  enabled: false,
  job: null,
  nextRun: null,
  lastRun: null,
};

function buildSlackMessage(newArticles: NewsArticle[], matchedKeywords: string[]): object {
  const top = newArticles.slice(0, 5);
  const keywordList = [...new Set(matchedKeywords)].slice(0, 8).join(", ");

  return {
    text: `*식품 뉴스 알림* — 주요 키워드 감지: \`${keywordList}\``,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "식품 뉴스 대시보드 — 자동 크롤링 완료",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `주요 키워드 감지: *${keywordList}*\n총 ${newArticles.length}개 기사 수집`,
        },
      },
      { type: "divider" },
      ...top.map((a) => ({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*<${a.link}|${a.title.substring(0, 80)}>*\n${a.category} · ${a.source === "naver" ? "🇰🇷 국내" : "🌍 해외"}`,
        },
      })),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `자동 크롤링 | ${new Date().toLocaleString("ko-KR")}`,
          },
        ],
      },
    ],
  };
}

async function sendSlackNotification(articles: NewsArticle[]): Promise<void> {
  const webhookUrl = process.env["SLACK_WEBHOOK_URL"];
  if (!webhookUrl) return;

  const matchedKeywords: string[] = [];
  const alertArticles: NewsArticle[] = [];

  for (const article of articles) {
    const text = (article.title + " " + (article.description ?? "")).toLowerCase();
    const matches = ALERT_KEYWORDS.filter((kw) => text.includes(kw.toLowerCase()));
    if (matches.length > 0) {
      alertArticles.push(article);
      matchedKeywords.push(...matches);
    }
  }

  if (alertArticles.length === 0) {
    logger.info("No alert keywords found — skipping Slack notification");
    return;
  }

  try {
    const payload = buildSlackMessage(alertArticles, matchedKeywords);
    await axios.post(webhookUrl, payload, { timeout: 8000 });
    logger.info(
      { keywords: [...new Set(matchedKeywords)], count: alertArticles.length },
      "Slack notification sent"
    );
  } catch (err) {
    logger.error({ err }, "Failed to send Slack notification");
  }
}

async function runScheduledCrawl(): Promise<void> {
  logger.info("Scheduled crawl starting");
  state.lastRun = new Date();

  try {
    const previousIds = new Set(readNews().map((a) => a.id));
    const articles = await crawlAllNews();
    const newArticles = articles.filter((a) => !previousIds.has(a.id));

    logger.info({ total: articles.length, new: newArticles.length }, "Scheduled crawl done");

    await Promise.all([
      newArticles.length > 0 ? sendSlackNotification(articles) : Promise.resolve(),
      exportToGoogleSheets(articles),
    ]);
  } catch (err) {
    logger.error({ err }, "Scheduled crawl failed");
  }

  state.nextRun = state.job?.nextInvocation() ?? null;
}

export function startScheduler(): void {
  if (state.enabled) return;

  const rule = new schedule.RecurrenceRule();
  rule.hour = new schedule.Range(0, 23, INTERVAL_HOURS);
  rule.minute = 0;
  rule.second = 0;

  state.job = schedule.scheduleJob(rule, runScheduledCrawl);
  state.enabled = true;
  state.nextRun = state.job?.nextInvocation() ?? null;

  logger.info({ nextRun: state.nextRun, intervalHours: INTERVAL_HOURS }, "Auto-crawl scheduler started");
}

export function stopScheduler(): void {
  if (!state.enabled || !state.job) return;
  state.job.cancel();
  state.job = null;
  state.enabled = false;
  state.nextRun = null;
  logger.info("Auto-crawl scheduler stopped");
}

export function toggleScheduler(): boolean {
  if (state.enabled) {
    stopScheduler();
  } else {
    startScheduler();
  }
  return state.enabled;
}

export function getSchedulerStatus() {
  return {
    enabled: state.enabled,
    intervalHours: INTERVAL_HOURS,
    nextRun: state.nextRun?.toISOString() ?? null,
    lastRun: state.lastRun?.toISOString() ?? null,
    alertKeywords: ALERT_KEYWORDS,
    slackEnabled: !!process.env["SLACK_WEBHOOK_URL"],
  };
}
