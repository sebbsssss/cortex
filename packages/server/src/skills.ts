/**
 * Real Skills - Actual working integrations
 * These are real APIs that agents can pay to use
 */

// ============ WEB SEARCH (Brave API) ============
export async function webSearch(query: string, count: number = 5): Promise<any> {
  const apiKey = process.env.BRAVE_API_KEY;
  
  if (!apiKey) {
    throw new Error('BRAVE_API_KEY not configured');
  }

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
    {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status}`);
  }

  const data = await response.json() as any;
  
  return {
    query,
    results: data.web?.results?.map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    })) || [],
    totalResults: data.web?.totalResults || 0,
  };
}

// ============ WEB FETCH (Scrape URL) ============
export async function webFetch(url: string, maxChars: number = 10000): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CortexBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();

    // Basic HTML to text extraction
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > maxChars) {
      text = text.substring(0, maxChars) + '...';
    }

    return {
      url,
      contentType,
      length: text.length,
      text,
    };
  } catch (error) {
    throw new Error(`Failed to fetch URL: ${(error as Error).message}`);
  }
}

// ============ WEATHER (Open-Meteo - Free) ============
export async function getWeather(latitude: number, longitude: number): Promise<any> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`
  );

  if (!response.ok) {
    throw new Error(`Weather API failed: ${response.status}`);
  }

  const data = await response.json() as any;

  // Weather code to description
  const weatherCodes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
  };

  return {
    location: { latitude, longitude },
    timezone: data.timezone,
    current: {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      condition: weatherCodes[data.current.weather_code] || 'Unknown',
    },
    forecast: data.daily.time.map((date: string, i: number) => ({
      date,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precipitationChance: data.daily.precipitation_probability_max[i],
    })),
  };
}

// Helper: Get coordinates from city name
export async function geocode(city: string): Promise<{ lat: number; lon: number; name: string }> {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  );

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status}`);
  }

  const data = await response.json() as any;
  
  if (!data.results || data.results.length === 0) {
    throw new Error(`Location not found: ${city}`);
  }

  const result = data.results[0];
  return {
    lat: result.latitude,
    lon: result.longitude,
    name: `${result.name}, ${result.country}`,
  };
}

// ============ CRYPTO PRICES (CoinGecko - Free) ============
export async function getCryptoPrices(coins: string[]): Promise<any> {
  const ids = coins.join(',');
  
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API failed: ${response.status}`);
  }

  const data = await response.json() as Record<string, any>;

  return {
    prices: Object.entries(data).map(([coin, info]: [string, any]) => ({
      coin,
      price: info.usd,
      change24h: info.usd_24h_change,
      marketCap: info.usd_market_cap,
    })),
    timestamp: new Date().toISOString(),
  };
}

// ============ SOLANA WALLET ANALYSIS (Helius) ============
export async function analyzeWallet(address: string): Promise<any> {
  const apiKey = process.env.HELIUS_API_KEY;
  
  if (!apiKey) {
    // Fallback to basic Solana RPC if no Helius key
    return analyzeWalletBasic(address);
  }

  try {
    // Get balances
    const balanceRes = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      }
    );
    const balanceData = await balanceRes.json() as any;
    const solBalance = (balanceData.result?.value || 0) / 1e9;

    // Get token accounts
    const tokenRes = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            address,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed' },
          ],
        }),
      }
    );
    const tokenData = await tokenRes.json() as any;
    const tokens = tokenData.result?.value?.length || 0;

    // Get recent transactions
    const txRes = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [address, { limit: 10 }],
        }),
      }
    );
    const txData = await txRes.json() as any;
    const recentTxCount = txData.result?.length || 0;

    return {
      address,
      solBalance,
      tokenAccounts: tokens,
      recentTransactions: recentTxCount,
      network: 'mainnet',
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Wallet analysis failed: ${(error as Error).message}`);
  }
}

// Basic wallet analysis without Helius
async function analyzeWalletBasic(address: string): Promise<any> {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  });

  const data = await response.json() as any;
  
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return {
    address,
    solBalance: (data.result?.value || 0) / 1e9,
    network: 'mainnet',
    note: 'Basic analysis (Helius API not configured)',
    analyzedAt: new Date().toISOString(),
  };
}

// ============ NEWS HEADLINES ============
export async function getNews(topic: string, count: number = 5): Promise<any> {
  // Use a free news API or RSS approach
  // For now, use Google News RSS as fallback
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
  
  try {
    const response = await fetch(rssUrl);
    const xml = await response.text();
    
    // Basic XML parsing for RSS
    const items: any[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const linkRegex = /<link>([\s\S]*?)<\/link>/;
    const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
    
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < count) {
      const item = match[1];
      const title = titleRegex.exec(item)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || '';
      const link = linkRegex.exec(item)?.[1] || '';
      const pubDate = pubDateRegex.exec(item)?.[1] || '';
      
      if (title && link) {
        items.push({ title, link, pubDate });
      }
    }

    return {
      topic,
      count: items.length,
      articles: items,
      source: 'Google News',
    };
  } catch (error) {
    throw new Error(`News fetch failed: ${(error as Error).message}`);
  }
}

// ============ IMAGE GENERATION (OpenAI) ============
export async function generateImage(prompt: string, size: string = '1024x1024'): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Image generation failed: ${error}`);
  }

  const data = await response.json() as any;

  return {
    prompt,
    size,
    url: data.data[0].url,
    revisedPrompt: data.data[0].revised_prompt,
  };
}
