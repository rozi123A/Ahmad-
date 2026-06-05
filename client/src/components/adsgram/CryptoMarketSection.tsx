import { useState, useEffect, useCallback } from "react";

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  market_cap_rank: number;
}

const COIN_IDS = "bitcoin,ethereum,binancecoin,the-open-network,digibyte,dogecoin,solana";

const FALLBACK: CoinData[] = [
  { id:"bitcoin",      symbol:"btc", name:"Bitcoin",    image:"", current_price:67000,   price_change_percentage_24h:1.2,   market_cap:1320000000000, total_volume:38000000000, market_cap_rank:1 },
  { id:"ethereum",     symbol:"eth", name:"Ethereum",   image:"", current_price:3500,    price_change_percentage_24h:-0.8,  market_cap:420000000000,  total_volume:18000000000, market_cap_rank:2 },
  { id:"binancecoin",  symbol:"bnb", name:"BNB",        image:"", current_price:580,     price_change_percentage_24h:0.5,   market_cap:86000000000,   total_volume:2100000000,  market_cap_rank:4 },
  { id:"the-open-network", symbol:"ton", name:"TON",   image:"", current_price:5.8,     price_change_percentage_24h:2.1,   market_cap:14000000000,   total_volume:320000000,   market_cap_rank:9 },
  { id:"digibyte",     symbol:"dgb", name:"DigiByte",   image:"", current_price:0.00105, price_change_percentage_24h:-1.3,  market_cap:19000000,      total_volume:850000,      market_cap_rank:180 },
  { id:"dogecoin",     symbol:"doge",name:"Dogecoin",   image:"", current_price:0.16,    price_change_percentage_24h:3.4,   market_cap:23000000000,   total_volume:1400000000,  market_cap_rank:8 },
  { id:"solana",       symbol:"sol", name:"Solana",     image:"", current_price:170,     price_change_percentage_24h:-2.1,  market_cap:78000000000,   total_volume:4200000000,  market_cap_rank:5 },
];

const COIN_ICONS: Record<string, string> = {
  bitcoin:"₿", ethereum:"Ξ", binancecoin:"⬡", "the-open-network":"💎",
  digibyte:"⟠", dogecoin:"Ð", solana:"◎",
};
const COIN_COLORS: Record<string, string> = {
  bitcoin:"#F7931A", ethereum:"#627EEA", binancecoin:"#F3BA2F",
  "the-open-network":"#0088CC", digibyte:"#0E8FEF", dogecoin:"#C2A633", solana:"#9945FF",
};

function fmt(n: number): string {
  if (n >= 1e12) return "$" + (n/1e12).toFixed(2) + "T";
  if (n >= 1e9)  return "$" + (n/1e9).toFixed(2) + "B";
  if (n >= 1e6)  return "$" + (n/1e6).toFixed(2) + "M";
  return "$" + n.toLocaleString();
}

function fmtPrice(p: number): string {
  if (p >= 1000) return "$" + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1)    return "$" + p.toFixed(2);
  if (p >= 0.01) return "$" + p.toFixed(4);
  return "$" + p.toFixed(6);
}

export default function CryptoMarketSection() {
  const [coins, setCoins]           = useState<CoinData[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown]   = useState(60);

  const fetchCoins = useCallback(async () => {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("API error");
      const data: CoinData[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("Empty");
      setCoins(data);
      setError(false);
      setLastUpdate(new Date());
      setCountdown(60);
    } catch {
      if (coins.length === 0) { setCoins(FALLBACK); setError(true); }
      setCountdown(60);
    } finally {
      setLoading(false);
    }
  }, [coins.length]);

  useEffect(() => { fetchCoins(); }, []);

  useEffect(() => {
    const interval = setInterval(fetchCoins, 60000);
    return () => clearInterval(interval);
  }, [fetchCoins]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 60), 1000);
    return () => clearInterval(tick);
  }, []);

  const sorted = [...coins].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  const gainers = sorted.filter(c => c.price_change_percentage_24h > 0).slice(0, 3);
  const losers  = sorted.filter(c => c.price_change_percentage_24h < 0).slice(-3).reverse();
  const totalPositive = coins.filter(c => c.price_change_percentage_24h > 0).length;
  const marketBull = totalPositive >= coins.length / 2;
  const avgChange = coins.length ? coins.reduce((s,c) => s + c.price_change_percentage_24h, 0) / coins.length : 0;

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:300, gap:16 }}>
      <div style={{ width:44, height:44, border:"3px solid rgba(14,143,239,0.2)", borderTopColor:"#0E8FEF", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <p style={{ color:"rgba(255,255,255,0.4)", fontSize:13 }}>جارٍ تحميل أسعار السوق...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ paddingBottom: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, margin:"0 0 2px", color:"#fff" }}>📊 سوق العملات</h2>
          <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)", margin:0 }}>
            {lastUpdate ? "آخر تحديث: " + lastUpdate.toLocaleTimeString("ar") : ""}
          </p>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(14,143,239,0.1)", border:"1px solid rgba(14,143,239,0.2)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
            onClick={fetchCoins}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E8FEF" strokeWidth="2.5" strokeLinecap="round">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </div>
          <p style={{ fontSize:9, color:"rgba(14,143,239,0.7)", margin:"3px 0 0", fontVariantNumeric:"tabular-nums" }}>{countdown}s</p>
        </div>
      </div>

      {error && (
        <div style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:12, padding:"8px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13 }}>⚠️</span>
          <p style={{ fontSize:11, color:"#FCA5A5", margin:0 }}>تعذّر الاتصال بـ CoinGecko — تعرض بيانات احتياطية</p>
        </div>
      )}

      {/* Market Sentiment */}
      <div style={{ background: marketBull ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)", border:`1px solid ${marketBull ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius:18, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 4px" }}>اتجاه السوق</p>
            <p style={{ fontSize:18, fontWeight:900, color: marketBull ? "#10B981" : "#EF4444", margin:0 }}>
              {marketBull ? "📈 سوق صاعد" : "📉 سوق هابط"}
            </p>
            <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:"3px 0 0" }}>
              {totalPositive} من {coins.length} عملات في ارتفاع
            </p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontSize:9, color:"rgba(255,255,255,0.4)", margin:"0 0 4px" }}>متوسط التغير</p>
            <p style={{ fontSize:22, fontWeight:900, color: avgChange >= 0 ? "#10B981" : "#EF4444", margin:0, fontVariantNumeric:"tabular-nums" }}>
              {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Coin Cards */}
      <div style={{ marginBottom:14 }}>
        <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 10px" }}>أسعار مباشرة</p>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {coins.map(coin => {
            const up = coin.price_change_percentage_24h >= 0;
            const color = COIN_COLORS[coin.id] || "#8B5CF6";
            const icon = COIN_ICONS[coin.id] || coin.symbol.toUpperCase()[0];
            return (
              <div key={coin.id} style={{ background:"rgba(255,255,255,0.03)", border:`1px solid rgba(255,255,255,0.07)`, borderRadius:16, padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
                {/* Icon */}
                <div style={{ width:42, height:42, borderRadius:13, background:color+"18", border:`1px solid ${color}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:19, fontWeight:900, color }}>
                  {icon}
                </div>
                {/* Name + Volume */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                    <p style={{ fontSize:13, fontWeight:800, color:"#fff", margin:0 }}>{coin.name}</p>
                    <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.06)", padding:"1px 5px", borderRadius:5, textTransform:"uppercase" }}>{coin.symbol}</span>
                  </div>
                  <p style={{ fontSize:10, color:"rgba(255,255,255,0.3)", margin:0 }}>Vol: {fmt(coin.total_volume)}</p>
                </div>
                {/* Price + Change */}
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <p style={{ fontSize:14, fontWeight:900, color:"#fff", margin:"0 0 3px", fontVariantNumeric:"tabular-nums" }}>{fmtPrice(coin.current_price)}</p>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:3, background: up ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", borderRadius:6, padding:"2px 7px" }}>
                    <span style={{ fontSize:10 }}>{up ? "▲" : "▼"}</span>
                    <span style={{ fontSize:11, fontWeight:800, color: up ? "#10B981" : "#EF4444", fontVariantNumeric:"tabular-nums" }}>
                      {up ? "+" : ""}{coin.price_change_percentage_24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market Cap Row */}
      <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"12px 14px", marginBottom:14 }}>
        <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 10px" }}>القيمة السوقية</p>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {coins.slice(0,5).map(coin => {
            const color = COIN_COLORS[coin.id] || "#8B5CF6";
            const maxCap = coins[0]?.market_cap || 1;
            const pct = Math.max(4, (coin.market_cap / maxCap) * 100);
            return (
              <div key={coin.id}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.6)", fontWeight:700 }}>{coin.symbol.toUpperCase()}</span>
                  <span style={{ fontSize:11, color:"#fff", fontWeight:800 }}>{fmt(coin.market_cap)}</span>
                </div>
                <div style={{ height:5, background:"rgba(255,255,255,0.06)", borderRadius:3 }}>
                  <div style={{ height:"100%", width:pct+"%", background:`linear-gradient(90deg,${color}80,${color})`, borderRadius:3, transition:"width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gainers & Losers */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {/* Top Gainers */}
        <div style={{ background:"rgba(16,185,129,0.05)", border:"1px solid rgba(16,185,129,0.18)", borderRadius:16, padding:"12px 12px" }}>
          <p style={{ fontSize:10, color:"#10B981", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 10px", display:"flex", alignItems:"center", gap:5 }}>
            📈 أعلى ارتفاعاً
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {gainers.map(c => (
              <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)", fontWeight:700 }}>{c.symbol.toUpperCase()}</span>
                <span style={{ fontSize:12, fontWeight:900, color:"#10B981" }}>+{c.price_change_percentage_24h.toFixed(2)}%</span>
              </div>
            ))}
            {gainers.length === 0 && <p style={{ fontSize:11, color:"rgba(255,255,255,0.25)", margin:0 }}>—</p>}
          </div>
        </div>

        {/* Top Losers */}
        <div style={{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:16, padding:"12px 12px" }}>
          <p style={{ fontSize:10, color:"#EF4444", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 10px", display:"flex", alignItems:"center", gap:5 }}>
            📉 أعلى انخفاضاً
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {losers.map(c => (
              <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)", fontWeight:700 }}>{c.symbol.toUpperCase()}</span>
                <span style={{ fontSize:12, fontWeight:900, color:"#EF4444" }}>{c.price_change_percentage_24h.toFixed(2)}%</span>
              </div>
            ))}
            {losers.length === 0 && <p style={{ fontSize:11, color:"rgba(255,255,255,0.25)", margin:0 }}>—</p>}
          </div>
        </div>
      </div>

      {/* 24h Volume Summary */}
      <div style={{ background:"rgba(139,92,246,0.05)", border:"1px solid rgba(139,92,246,0.18)", borderRadius:16, padding:"14px 16px", marginBottom:12 }}>
        <p style={{ fontSize:10, color:"rgba(139,92,246,0.7)", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 10px" }}>💹 حجم التداول 24h</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {coins.slice(0,4).map(c => (
            <div key={c.id} style={{ display:"flex", flexDirection:"column" }}>
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase" }}>{c.symbol}</span>
              <span style={{ fontSize:12, fontWeight:800, color:"#A78BFA" }}>{fmt(c.total_volume)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DGB Highlight */}
      {coins.find(c=>c.id==="digibyte") && (() => {
        const dgb = coins.find(c=>c.id==="digibyte")!;
        const up = dgb.price_change_percentage_24h >= 0;
        return (
          <div style={{ background:"linear-gradient(135deg,rgba(14,143,239,0.12),rgba(14,143,239,0.04))", border:"1px solid rgba(14,143,239,0.28)", borderRadius:18, padding:"16px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:"rgba(14,143,239,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:"#0E8FEF" }}>⟠</div>
                <div>
                  <p style={{ fontSize:13, fontWeight:900, color:"#0E8FEF", margin:0 }}>DigiByte (DGB)</p>
                  <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)", margin:0 }}>عملة التطبيق</p>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <p style={{ fontSize:20, fontWeight:900, color:"#0E8FEF", margin:"0 0 3px", fontVariantNumeric:"tabular-nums" }}>{fmtPrice(dgb.current_price)}</p>
                <span style={{ fontSize:12, fontWeight:800, color: up ? "#10B981" : "#EF4444" }}>
                  {up ? "+" : ""}{dgb.price_change_percentage_24h.toFixed(2)}% اليوم
                </span>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div style={{ background:"rgba(14,143,239,0.08)", borderRadius:10, padding:"8px 10px" }}>
                <p style={{ fontSize:9, color:"rgba(14,143,239,0.5)", margin:"0 0 2px" }}>القيمة السوقية</p>
                <p style={{ fontSize:12, fontWeight:800, color:"#60A5FA", margin:0 }}>{fmt(dgb.market_cap)}</p>
              </div>
              <div style={{ background:"rgba(14,143,239,0.08)", borderRadius:10, padding:"8px 10px" }}>
                <p style={{ fontSize:9, color:"rgba(14,143,239,0.5)", margin:"0 0 2px" }}>حجم التداول</p>
                <p style={{ fontSize:12, fontWeight:800, color:"#60A5FA", margin:0 }}>{fmt(dgb.total_volume)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      <p style={{ fontSize:10, color:"rgba(255,255,255,0.18)", textAlign:"center", margin:"14px 0 0" }}>
        البيانات من CoinGecko · تتجدد كل 60 ثانية
      </p>
    </div>
  );
}
