import { useState, useEffect } from "react";
  import { Send, Star, AlertCircle, Wallet, ChevronDown, Check, Copy } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { trpc } from "@/lib/trpc";
  import { translations, type Language } from "@/lib/i18n";

  interface UserData { telegramId: number; balance: number; minWithdraw: number; starsRate: number; }
  interface WithdrawSectionProps { user: UserData; lang: Language; onSuccess: () => void; }

  type WithdrawalMethod = "telegram_stars" | "ton" | "usdt";

  export default function WithdrawSection({ user, lang, onSuccess }: WithdrawSectionProps) {
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [showMethodMenu, setShowMethodMenu] = useState(false);
    const [showWalletSetup, setShowWalletSetup] = useState(false);
    const [method, setMethod] = useState<WithdrawalMethod>("telegram_stars");
    const [tonWallet, setTonWallet] = useState("");
    const [usdtWallet, setUsdtWallet] = useState("");
    const { toast } = useToast();
    const t = translations[lang];

    const withdrawMutation = trpc.withdraw.request.useMutation();
    const walletsQuery = trpc.withdraw.getWallets.useQuery({ 
      telegramId: user.telegramId, 
      initData: window.Telegram?.WebApp?.initData || "" 
    });
    const updateTonWallet = trpc.withdraw.updateTonWallet.useMutation();
    const updateUsdtWallet = trpc.withdraw.updateUsdtWallet.useMutation();

    // Load saved wallets
    useEffect(() => {
      if (walletsQuery.data) {
        setTonWallet(walletsQuery.data.tonWallet || "");
        setUsdtWallet(walletsQuery.data.usdtWallet || "");
      }
    }, [walletsQuery.data]);

    const numAmount = parseFloat(amount) || 0;
    const starsWorth = Math.floor(numAmount / user.starsRate);
    const canWithdraw = numAmount >= user.minWithdraw && numAmount <= user.balance;

    const methodInfo: Record<WithdrawalMethod, { icon: string; label: string; desc: string; color: string }> = {
      telegram_stars: { 
        icon: "⭐", 
        label: t.withdraw_method_stars || "Telegram Stars", 
        desc: t.withdraw_method_stars_desc || "النجوم تصل كهدية", 
        color: "#FFD700" 
      },
      ton: { 
        icon: "💎", 
        label: t.withdraw_method_ton || "TON", 
        desc: t.withdraw_method_ton_desc || "تُرسَل مباشرة لمحفظتك", 
        color: "#10B981" 
      },
      usdt: { 
        icon: "💵", 
        label: t.withdraw_method_usdt || "USDT (TRC-20)", 
        desc: t.withdraw_method_usdt_desc || "تُرسَل لمحفظتك على Tron", 
        color: "#60A5FA" 
      },
    };

    const handleSaveWallets = async () => {
      try {
        if (tonWallet) {
          await updateTonWallet.mutateAsync({ telegramId: user.telegramId, initData: window.Telegram?.WebApp?.initData || "", wallet: tonWallet });
        }
        if (usdtWallet) {
          await updateUsdtWallet.mutateAsync({ telegramId: user.telegramId, initData: window.Telegram?.WebApp?.initData || "", wallet: usdtWallet });
        }
        toast({ title: t.withdraw_wallet_saved_success || "✅ تم حفظ المحفظة", description: t.withdraw_wallet_can_use || "يمكنك الآن استخدام هذه المحفظة للسحب" });
        setShowWalletSetup(false);
      } catch (e: any) {
        toast({ title: t.error || "❌ خطأ", description: e.message || t.withdraw_save_failed || "فشل حفظ المحفظة", variant: "destructive" });
      }
    };

    const handleWithdraw = async () => {
      // Check if user has wallet for selected method
      if (method === "ton" && !tonWallet) {
        toast({ title: "⚠️ " + (t.withdraw_ton_wallet || "محفظة TON"), description: t.withdraw_no_wallet_error || "يجب إضافة محفظة TON أولاً", variant: "destructive" });
        setShowWalletSetup(true);
        return;
      }
      if (method === "usdt" && !usdtWallet) {
        toast({ title: "⚠️ " + (t.withdraw_usdt_wallet || "محفظة USDT"), description: t.withdraw_no_usdt_error || "يجب إضافة محفظة USDT أولاً", variant: "destructive" });
        setShowWalletSetup(true);
        return;
      }

      if (!canWithdraw) return;
      setLoading(true);
      try {
        const result = await withdrawMutation.mutateAsync({
          telegramId: user.telegramId,
          amount: numAmount,
          initData: window.Telegram?.WebApp?.initData || "",
          method,
        });
        if (result.success) {
          toast({ 
            title: t.withdraw_success || "طلب مُرسَل!", 
            description: result.message || t.withdraw_pending || "سيتم مراجعة طلبك قريباً" 
          });
          setAmount("");
          onSuccess();
        } else {
          toast({ title: t.error || "خطأ", description: result.message || t.withdraw_error || "فشل الطلب", variant: "destructive" });
        }
      } catch (e: any) {
        toast({ title: t.error || "خطأ", description: e.message || t.withdraw_error || "فشل الطلب", variant: "destructive" });
      } finally { setLoading(false); }
    };

    const pct = Math.min((user.balance / user.minWithdraw) * 100, 100);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Balance overview */}
        <div style={{ borderRadius: 22, padding: 20, background: "linear-gradient(145deg, #071a14, #051210)", border: "1px solid rgba(16,185,129,0.25)", boxShadow: "0 4px 30px rgba(16,185,129,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 9, color: "rgba(16,185,129,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>{t.balance || "رصيدك"}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, background: "linear-gradient(135deg,#34D399,#10B981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{user.balance.toLocaleString()}</span>
                <span style={{ fontSize: 14, color: "rgba(16,185,129,0.45)", fontWeight: 700 }}>{t.points || "PTS"}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 9, color: "rgba(16,185,129,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{t.stars_equivalent || "يعادل"}</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#FFD700" }}>⭐ {Math.floor(user.balance / user.starsRate)}</p>
            </div>
          </div>

          {/* Progress to min withdraw */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{t.min_withdraw || "الحد الأدنى للسحب"}</p>
              <p style={{ fontSize: 10, fontWeight: 800, color: pct >= 100 ? "#10B981" : "#FFD700" }}>{user.minWithdraw.toLocaleString()} {t.points || "PTS"}</p>
            </div>
            <div style={{ height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FFD700)", borderRadius: 6, transition: "width 0.6s ease", boxShadow: pct >= 100 ? "0 0 12px rgba(16,185,129,0.5)" : "none" }} />
            </div>
          </div>
        </div>

        {user.balance < user.minWithdraw && (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertCircle size={20} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#FCD34D", marginBottom: 3 }}>{t.not_enough_balance || "الرصيد غير كافٍ"}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{t.need_more_points || "تحتاج"} {(user.minWithdraw - user.balance).toLocaleString()} {t.points || "نقطة"} {t.to_reach_min || "للوصول إلى الحد الأدنى"}</p>
            </div>
          </div>
        )}

        {/* Withdrawal Method Selector */}
        {user.balance >= user.minWithdraw && (
          <>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{t.withdraw_method_title || "طريقة الاستلام"}</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["telegram_stars", "ton", "usdt"] as WithdrawalMethod[]).map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setMethod(m);
                      if (m === "ton" && !tonWallet) setShowWalletSetup(true);
                      if (m === "usdt" && !usdtWallet) setShowWalletSetup(true);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      borderRadius: 12, border: `2px solid ${method === m ? methodInfo[m].color : "rgba(255,255,255,0.08)"}`,
                      background: method === m ? `${methodInfo[m].color}15` : "rgba(255,255,255,0.02)",
                      cursor: "pointer", transition: "all 0.2s", textAlign: "left"
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{methodInfo[m].icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: method === m ? methodInfo[m].color : "#fff", marginBottom: 2 }}>{methodInfo[m].label}</p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{methodInfo[m].desc}</p>
                    </div>
                    {method === m && <Check size={18} color={methodInfo[m].color} />}
                    {(m === "ton" || m === "usdt") && (
                      <div style={{ 
                        fontSize: 9, padding: "3px 8px", borderRadius: 6,
                        background: (m === "ton" && tonWallet) || (m === "usdt" && usdtWallet) ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                        color: (m === "ton" && tonWallet) || (m === "usdt" && usdtWallet) ? "#10B981" : "rgba(255,255,255,0.3)"
                      }}>
                        {(m === "ton" && tonWallet) || (m === "usdt" && usdtWallet) ? t.withdraw_wallet_saved || "✓ محفظة مُضافة" : t.withdraw_wallet_add || "إضافة محفظة"}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Wallet Setup Section */}
            {(method === "ton" || method === "usdt") && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Wallet size={16} style={{ color: methodInfo[method].color }} />
                    <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                      {method === "ton" ? (t.withdraw_ton_wallet || "محفظة TON") : (t.withdraw_usdt_wallet || "محفظة USDT (TRC-20)")}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowWalletSetup(!showWalletSetup)}
                    style={{ fontSize: 10, color: methodInfo[method].color, background: "none", border: "none", cursor: "pointer" }}
                  >
                    {showWalletSetup ? (t.withdraw_wallet_hide || "إخفاء") : (tonWallet || usdtWallet) ? (t.withdraw_wallet_edit || "تعديل") : (t.withdraw_wallet_add || "إضافة")}
                  </button>
                </div>

                {(method === "ton" ? tonWallet : usdtWallet) && !showWalletSetup ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(16,185,129,0.1)", borderRadius: 10 }}>
                    <code style={{ fontSize: 11, color: "#10B981", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {method === "ton" ? tonWallet : usdtWallet}
                    </code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(method === "ton" ? tonWallet : usdtWallet);
                        toast({ title: t.success || "✅", description: t.withdraw_wallet_copied || "تم نسخ عنوان المحفظة" });
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <Copy size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                    </button>
                  </div>
                ) : showWalletSetup && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input
                      type="text"
                      placeholder={method === "ton" ? (t.withdraw_wallet_placeholder_ton || "EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") : (t.withdraw_wallet_placeholder_usdt || "Txxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")}
                      value={method === "ton" ? tonWallet : usdtWallet}
                      onChange={e => method === "ton" ? setTonWallet(e.target.value) : setUsdtWallet(e.target.value)}
                      style={{ 
                        width: "100%", padding: "12px 14px", borderRadius: 12, 
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff", fontSize: 12, outline: "none"
                      }}
                    />
                    <button
                      onClick={handleSaveWallets}
                      style={{
                        padding: "10px 16px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg, #10B981, #059669)",
                        color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer"
                      }}
                    >
                      {t.withdraw_save_wallet || "حفظ المحفظة"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{t.withdraw_select_amount || "المبلغ (بالنقاط)"}</p>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={t.withdraw_minimum_placeholder?.replace("{min}", user.minWithdraw.toLocaleString()) || `الحد الأدنى ${user.minWithdraw.toLocaleString()}`}
                    style={{ width: "100%", height: 54, borderRadius: 16, padding: "0 16px", background: "rgba(255,255,255,0.04)", border: `1px solid ${numAmount > 0 && !canWithdraw ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`, color: "#fff", fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                {numAmount > 0 && (
                  <p style={{ fontSize: 11, color: methodInfo[method].color, fontWeight: 600, marginTop: 6 }}>
                    {methodInfo[method].icon} ≈ {starsWorth} {method === "telegram_stars" ? "Telegram Stars" : method === "ton" ? "TON" : "USDT"}
                  </p>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[user.minWithdraw, Math.floor(user.balance / 2), user.balance].map((v, i) => (
                  <button key={i} onClick={() => setAmount(String(v))} style={{ height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {i === 0 ? (t.withdraw_quick_select || "الحد الأدنى") : i === 1 ? (t.withdraw_quick_half || "النصف") : (t.withdraw_quick_all || "الكل")}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* CTA */}
        {user.balance >= user.minWithdraw && (
          <button
            onClick={handleWithdraw}
            disabled={!canWithdraw || loading}
            style={{
              width: "100%", height: 60, borderRadius: 20, border: "none",
              cursor: canWithdraw && !loading ? "pointer" : "not-allowed",
              fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              background: canWithdraw && !loading ? `linear-gradient(135deg, ${methodInfo[method].color}, ${methodInfo[method].color}cc)` : "rgba(255,255,255,0.05)",
              color: canWithdraw && !loading ? "#fff" : "rgba(255,255,255,0.25)",
              boxShadow: canWithdraw && !loading ? `0 6px 24px ${methodInfo[method].color}40` : "none",
              transition: "all 0.3s",
            }}
          >
            {loading ? (
              <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <Send size={20} />
            )}
            {loading ? (t.withdraw_sending || "جاري الإرسال...") : `${t.withdraw || "سحب"} ${starsWorth > 0 ? starsWorth : "?"} ${methodInfo[method].label}`}
          </button>
        )}

        {/* Info cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: t.withdraw_conversion_rate || "معدل التحويل", value: `${user.starsRate} ${t.points || "PTS"} = ⭐1`, color: "#A78BFA" },
            { label: t.withdraw_minimum_amount || "الحد الأدنى", value: `${user.minWithdraw.toLocaleString()} ${t.points || "PTS"}`, color: "#60A5FA" },
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  