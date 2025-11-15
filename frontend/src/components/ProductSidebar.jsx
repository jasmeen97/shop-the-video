import React, { useEffect, useRef } from 'react';

export default function ProductSidebar({ products, currentTime, onProductClick, isLoading, shoppingMap = {}, onFindLinks }) {
  const productRefs = useRef([]);
  const findingRef = useRef(new Set());

  const buildKey = (brand, name) => {
    const n = (name || '').trim();
    const b = (brand || '').trim();
    if (b && b.toLowerCase() !== 'unknown' && n.toLowerCase().includes(b.toLowerCase())) {
      return n.toLowerCase();
    }
    const composed = ((b && b.toLowerCase() !== 'unknown') ? `${b} ${n}` : n).trim();
    return composed.toLowerCase();
  };

  const dedupQuery = (brand, name) => {
    const n = (name || '').trim();
    const b = (brand || '').trim();
    if (!b || b.toLowerCase() === 'unknown') return n;
    return n.toLowerCase().includes(b.toLowerCase()) ? n : `${b} ${n}`.trim();
  };

  const ensureAffiliate = (url) => {
    try {
      const tag = import.meta?.env?.VITE_AFFILIATE_TAG;
      if (!tag) return url;
      const u = new URL(url);
      const host = (u.hostname || '').toLowerCase();
      if (!host.includes('amazon.') || host === 'amzn.to') return url;
      u.searchParams.set('tag', tag);
      return u.toString();
    } catch {
      return url;
    }
  };

  // Auto-scroll to active product - must be declared before any returns
  useEffect(() => {
    if (!products || products.length === 0) return;

    const activeIndex = products.findIndex(
      p => currentTime >= p.timeline[0] && currentTime <= p.timeline[1]
    );

    if (activeIndex !== -1 && productRefs.current[activeIndex]) {
      productRefs.current[activeIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentTime, products]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parsePrice = (price) => {
    if (!price || typeof price !== 'string') return null;
    const s = price.trim();
    const match = s.match(/(\d{1,3}(?:[\\s,]\\d{3})*(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)/);
    if (!match) return null;
    const num = match[1].replace(/[, ]/g, '');
    const value = parseFloat(num);
    return Number.isFinite(value) ? value : null;
  };

  return (
    <div className="bg-primary-ghost/90 rounded-2xl border border-primary-neutral/40 shadow-sm shadow-primary-obsidian/5 h-full flex flex-col">
      <div className="px-4 py-3 border-b border-primary-neutral/40 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-primary-obsidian">
            Shopping list <span className="text-primary-charcoal/70">({products.length || 0})</span>
          </h2>
          <p className="text-xs text-primary-charcoal/70">
            Every product we spot in this video, ready to link.
          </p>
        </div>
        <button
          className="text-[11px] md:text-xs px-3 py-1.5 rounded-lg bg-accents-frost text-white font-medium shadow-sm hover:bg-accents-frost/90 disabled:opacity-60"
          disabled={!products.length}
          onClick={() => {
            if (!products.length) return;
            // Copy affiliate link bundle
            const lines = products.map((p) => {
              const brand = p.brand && p.brand.toLowerCase() !== 'unknown' ? p.brand : '';
              const key = buildKey(brand, p.product_name);
              const item = shoppingMap[key];
              let url = item?.affiliate_url || item?.url;
              if (!url) {
                const query = dedupQuery(brand, p.product_name);
                url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
              }
              url = ensureAffiliate(url);
              return `${p.product_name} - ${url}`;
            });
            navigator.clipboard.writeText(lines.join('\n'));
          }}
        >
          Copy Affiliate Bundle
        </button>
      </div>

      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-6 text-center">
          <div className="w-9 h-9 border-2 border-accents-frost border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm font-medium text-primary-obsidian">Analyzing video…</p>
            <p className="text-xs text-primary-charcoal/70">
              Finding every shoppable moment frame-by-frame.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !products.length && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-whisper flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-primary-neutral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-primary-obsidian mb-1">No shoppable moments yet</p>
          <p className="text-xs text-primary-charcoal/70">
            Try another clip, or scrub through the video to double-check.
          </p>
        </div>
      )}

      {!isLoading && !!products.length && (
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 custom-scrollbar">
        {products.map((product, idx) => {
          const isActive = currentTime >= product.timeline[0] && currentTime <= product.timeline[1];
          const brand = product.brand && product.brand.toLowerCase() !== 'unknown' ? product.brand : '';
          const key = buildKey(brand, product.product_name);
          const shop = shoppingMap?.[key];

          // Deal badge: compute % off vs. best alternative
          let dealPercent = null;
          const primaryPrice = parsePrice(shop?.price);
          if (primaryPrice != null && Array.isArray(shop?.alternatives) && shop.alternatives.length > 0) {
            let bestAlt = null;
            for (const alt of shop.alternatives) {
              const altPrice = parsePrice(alt?.price);
              if (altPrice == null) continue;
              if (bestAlt == null || altPrice < bestAlt) {
                bestAlt = altPrice;
              }
            }
            if (bestAlt != null && bestAlt < primaryPrice) {
              const pct = Math.round(((primaryPrice - bestAlt) / primaryPrice) * 100);
              if (pct >= 5) {
                dealPercent = pct;
              }
            }
          }

          return (
            <div
              key={idx}
              ref={(el) => (productRefs.current[idx] = el)}
              className={`relative rounded-xl p-4 border cursor-pointer transition-all ${
                isActive
                  ? 'bg-accents-frost/10 border-accents-frost shadow-sm shadow-accents-frost/25'
                  : 'bg-primary-whisper border-primary-neutral/60 hover:border-primary-neutral'
              }`}
              onClick={() => onProductClick && onProductClick(product)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                  isActive ? 'bg-accents-frost text-white' : 'bg-primary-neutral/30 text-primary-charcoal/80'
                }`}>
                  {formatTime(product.timeline[0])} - {formatTime(product.timeline[1])}
                </span>
                {dealPercent != null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    <span>🔥</span>
                    <span>{dealPercent}% off</span>
                  </span>
                )}
                {isActive && dealPercent == null && (
                  <span className="text-[11px] font-medium text-accents-frost">
                    Live now
                  </span>
                )}
              </div>

              <h3 className={`font-semibold mb-1 ${isActive ? 'text-primary-obsidian' : 'text-primary-charcoal/80'}`}>
                {product.product_name}
              </h3>

              {product.brand && product.brand.toLowerCase() !== 'unknown' && (
                <p className={`text-sm mb-1 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                  Brand: {product.brand}
                </p>
              )}

              {product.price && product.price.toLowerCase() !== 'unknown' && product.price.toLowerCase() !== 'not shown in the video' && (
                <p className={`text-sm font-semibold mb-2 ${isActive ? 'text-primary-obsidian' : 'text-primary-charcoal/70'}`}>
                  {product.price}
                </p>
              )}

              <p className={`text-sm mb-3 ${isActive ? 'text-primary-charcoal/90' : 'text-primary-charcoal/70'}`}>
                {product.description}
              </p>

              {/* Enriched shopping info */}
              {shop && (() => {
                // Build unified comparison list: primary (Amazon or other) + alternatives
                const primary = {
                  retailer: shop.retailer || (shop.domain || '').replace(/^www\./, '') || 'Store',
                  url: shop.url,
                  affiliate_url: shop.affiliate_url,
                  price: shop.price,
                  price_num: undefined,
                };
                // Already ranked by backend; keep top 2
                const alts = Array.isArray(shop.alternatives) ? shop.alternatives.slice(0, 2) : [];
                const rows = [primary, ...alts];
                // Compute numeric prices so we can highlight the lowest and strike-through higher ones
                const rowsWithNum = rows.map((r) => ({
                  ...r,
                  price_num: parsePrice(r.price),
                }));
                const numericPrices = rowsWithNum.map((r) => r.price_num).filter((v) => v != null);
                const bestPrice = numericPrices.length ? Math.min(...numericPrices) : null;
                return (
                  <div className="mb-3 space-y-1">
                    <div className="text-xs text-gray-700 font-medium">Price comparison</div>
                    <div className="space-y-1">
                      {rowsWithNum.map((row, i) => {
                        const label = row.retailer || 'Store';
                        const link = row.affiliate_url || row.url;
                        const isCheapest = row.price_num != null && bestPrice != null && row.price_num === bestPrice;
                        const isHigher = row.price_num != null && bestPrice != null && row.price_num > bestPrice;
                        return (
                          <div key={i} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate max-w-[10rem]">{label}</span>
                              {isCheapest && (
                                <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">Cheapest</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`${
                                  isCheapest
                                    ? 'text-green-700 font-semibold'
                                    : isHigher && row.price
                                      ? 'text-gray-400 line-through'
                                      : 'text-gray-700'
                                }`}
                              >
                                {row.price || '—'}
                              </span>
                              {link && (
                                <a
                                  className="text-blue-600 hover:underline"
                                  href={ensureAffiliate(link)}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <button
                className={`w-full mt-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-obsidian text-white hover:bg-black'
                    : 'bg-primary-neutral/50 text-primary-charcoal/50 cursor-not-allowed'
                }`}
                disabled={!isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isActive) {
                    const aff = shop?.affiliate_url;
                    const url = (function(){
                      if (aff) return aff;
                      if (shop?.url) {
                        // If backend fallback returned an Amazon search URL, rebuild query to avoid duplicates
                        try {
                          const u = new URL(shop.url);
                          if (u.hostname.includes('amazon.') && u.pathname === '/s' && u.searchParams.has('k')) {
                            const query = dedupQuery(brand, product.product_name);
                            return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
                          }
                        } catch (e) { /* ignore parse errors */ }
                        return shop.url;
                      }
                      const query = dedupQuery(brand, product.product_name);
                      return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
                    })();
                    window.open(url, '_blank');
                  }
                }}
              >
                {shop?.affiliate_url ? 'Shop (Affiliate Link)' : 'Shop on Amazon'}
              </button>

              <div className="mt-2 flex items-center gap-2">
                <button
                  className={`text-[11px] px-3 py-1.5 rounded-lg border ${
                    isActive
                      ? 'border-accents-frost text-accents-frost hover:bg-accents-frost/10'
                      : 'border-primary-neutral text-primary-neutral/80'
                  }`}
                  disabled={!isActive || !onFindLinks}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!onFindLinks) return;
                    if (findingRef.current.has(key)) return;
                    findingRef.current.add(key);
                    try {
                      await onFindLinks(product);
                    } finally {
                      findingRef.current.delete(key);
                    }
                  }}
                >
                  {shop ? 'Refresh Links' : 'Find Best Deal'}
                </button>

                {findingRef.current.has(key) && (
                  <span className="inline-flex items-center text-[11px] text-primary-charcoal/70">
                    <span className="w-3 h-3 border-2 border-accents-frost border-t-transparent rounded-full animate-spin mr-1"></span>
                    Fetching...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
