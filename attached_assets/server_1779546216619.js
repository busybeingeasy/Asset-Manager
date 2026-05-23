const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const schedule = require('node-schedule');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const cache = new NodeCache({ stdTTL: 600 });

app.use(express.static('public'));
app.use(express.json());

const NAVER_RSS_URLS = {
  업계뉴스: 'https://news.naver.com/rss/section/105.xml',
  원재료동향: 'https://news.naver.com/rss/section/106.xml',
  규제안전: 'https://news.naver.com/rss/section/103.xml',
};

const KEYWORDS_KOR = ['농심', '오뚜기', 'CJ', '삼양', '풀무원', '불닭', '라면', '대두', '밀가루', '설탕', '소금', '유지', '참기름', '콩기름', '버터', '계란', '육수', '국물', '장류', '고추장', '된장', '간장', '유가', '곡물', '축산'];
const KEYWORDS_ENG = ['tariff', 'supply chain', 'commodity', 'price', 'export', 'import', 'logistics', 'shipping', 'inflation', 'raw material'];

async function translateText(text, targetLang = 'ko') {
  try {
    const response = await axios.post('https://libretranslate.de/translate', {
      q: text.substring(0, 500),
      source: 'auto',
      target: targetLang,
    });
    return response.data.translatedText || text;
  } catch (err) {
    console.error('Translation error:', err.message);
    return text;
  }
}

function extractSummaryFromDescription(text) {
  // 설명에서 처음 150자만 추출
  if (!text) return '';
  return text.substring(0, 150) + (text.length > 150 ? '...' : '');
}

function extractKeywords(text) {
  const keywords = new Set();
  const lowerText = text.toLowerCase();
  
  KEYWORDS_KOR.forEach(keyword => {
    if (lowerText.includes(keyword)) keywords.add(keyword);
  });
  
  KEYWORDS_ENG.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) keywords.add(keyword);
  });
  
  return Array.from(keywords);
}

async function fetchNaverRSS(category, apiKey) {
  try {
    const url = NAVER_RSS_URLS[category];
    if (!url) return [];

    const response = await axios.get(url, { timeout: 10000 });
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    const items = result.rss.channel[0].item || [];
    const news = [];

    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const item = items[i];
      const title = item.title?.[0] || '';
      const description = item.description?.[0] || '';
      const link = item.link?.[0] || '';
      const pubDate = item.pubDate?.[0] || new Date().toISOString();
      
      const keywords = extractKeywords(title + ' ' + description);
      
      news.push({
        id: `${category}-${i}-${Date.now()}`,
        category,
        title,
        description: description.substring(0, 200),
        link,
        pubDate,
        keywords,
        source: 'naver',
        timestamp: new Date().toISOString(),
      });
    }
    
    return news;
  } catch (err) {
    console.error(`Error fetching Naver RSS for ${category}:`, err.message);
    return [];
  }
}

async function fetchGoogleNews(query) {
  try {
    const searchQuery = `${query} food tariff supply chain`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-US&gl=US&ceid=US:en`;
    
    const response = await axios.get(url, { timeout: 10000 });
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    const items = result.rss.channel[0].item || [];
    const news = [];

    for (let i = 0; i < Math.min(items.length, 5); i++) {
      const item = items[i];
      const title = item.title?.[0] || '';
      const description = item.description?.[0] || '';
      const link = item.link?.[0] || '';
      const pubDate = item.pubDate?.[0] || new Date().toISOString();
      
      const keywords = extractKeywords(title + ' ' + description);
      
      news.push({
        id: `google-${i}-${Date.now()}`,
        category: '해외뉴스',
        title: title,
        originalTitle: title,
        description: description.substring(0, 200),
        link,
        pubDate,
        keywords,
        source: 'google',
        timestamp: new Date().toISOString(),
      });
    }
    
    return news;
  } catch (err) {
    console.error('Error fetching Google News:', err.message);
    return [];
  }
}

async function saveTariffUpdates() {
  try {
    const tariffFile = path.join(DATA_DIR, 'tariffs.json');
    const tariffData = {
      source: '농림축산식품부 공지',
      lastUpdated: new Date().toISOString(),
      items: [
        {
          id: 'tariff-001',
          title: '할당관세 공시 정보',
          link: 'https://www.maf.go.kr',
          keywords: ['할당관세', '수입', '곡물', '축산물'],
          description: '농림축산식품부에서 공시한 최신 할당관세 정보입니다. 정기적으로 확인하세요.',
          timestamp: new Date().toISOString(),
        }
      ]
    };
    fs.writeFileSync(tariffFile, JSON.stringify(tariffData, null, 2));
  } catch (err) {
    console.error('Error saving tariff updates:', err.message);
  }
}

async function crawlAllNews() {
  try {
    const allNews = [];
    
    // Naver 뉴스 크롤링
    for (const category of Object.keys(NAVER_RSS_URLS)) {
      console.log(`크롤링 중: ${category}`);
      const news = await fetchNaverRSS(category);
      allNews.push(...news);
    }
    
    // Google 뉴스 크롤링
    console.log('크롤링 중: Google 뉴스');
    const googleNews = await fetchGoogleNews('food commodities');
    allNews.push(...googleNews);
    
    // 할당관세 정보 저장
    await saveTariffUpdates();
    
    // 파일에 저장
    const newsFile = path.join(DATA_DIR, 'news.json');
    fs.writeFileSync(newsFile, JSON.stringify(allNews, null, 2));
    
    console.log(`✅ 크롤링 완료: ${allNews.length}개 뉴스`);
    cache.set('news', allNews);
    
    return allNews;
  } catch (err) {
    console.error('Error in crawlAllNews:', err.message);
    return [];
  }
}

// API 엔드포인트
app.get('/api/news', (req, res) => {
  try {
    const newsFile = path.join(DATA_DIR, 'news.json');
    let news = [];
    
    if (fs.existsSync(newsFile)) {
      news = JSON.parse(fs.readFileSync(newsFile, 'utf8'));
    }
    
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tariffs', (req, res) => {
  try {
    const tariffFile = path.join(DATA_DIR, 'tariffs.json');
    let tariffs = {};
    
    if (fs.existsSync(tariffFile)) {
      tariffs = JSON.parse(fs.readFileSync(tariffFile, 'utf8'));
    }
    
    res.json(tariffs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/crawl', async (req, res) => {
  try {
    const news = await crawlAllNews();
    res.json({ status: 'success', count: news.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 초기 크롤링 및 스케줄러
app.listen(PORT, async () => {
  console.log(`🚀 서버 시작: http://localhost:${PORT}`);
  
  // 초기 데이터 로드 (API 키 없이 기본값)
  // 사용자가 대시보드에서 API 키를 입력하면 자동으로 크롤링 시작
  
  // 하루에 4번 (6시간마다) 크롤링
  schedule.scheduleJob('0 */6 * * *', async () => {
    console.log('⏰ 정기 크롤링 시작...');
    // API 키는 사용자가 프론트엔드에서 제공해야 함
  });
});

module.exports = app;
