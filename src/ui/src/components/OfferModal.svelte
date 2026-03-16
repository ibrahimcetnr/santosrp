<script lang="ts">
  /**
   * OfferModal — Bağımsız teklif/onay modülü.
   * Birlik daveti, takas teklifi, taksi onayı vb. her türlü
   * karşı taraf onayı gereken sistemde yeniden kullanılabilir.
   *
   * window.showOffer(jsonStr)  çağrısıyla açılır.
   * Onay → mp.trigger('client:acceptOffer', offerId)
   * Red  → mp.trigger('client:rejectOffer', offerId)
   */

  interface Offer {
    id: string;
    type: string;
    title: string;
    description: string;
    from?: string;
    timeout?: number; // saniye
  }

  let offers = $state<Offer[]>([]);
  let timers: Record<string, ReturnType<typeof setInterval>> = {};
  let countdowns = $state<Record<string, number>>({});

  function addOffer(offer: Offer) {
    // Aynı id tekrarlanmasın
    if (offers.find(o => o.id === offer.id)) return;
    offers = [...offers, offer];

    if (offer.timeout && offer.timeout > 0) {
      countdowns = { ...countdowns, [offer.id]: offer.timeout };
      timers[offer.id] = setInterval(() => {
        const remaining = (countdowns[offer.id] ?? 1) - 1;
        if (remaining <= 0) {
          dismissOffer(offer.id, false);
        } else {
          countdowns = { ...countdowns, [offer.id]: remaining };
        }
      }, 1000);
    }
  }

  function dismissOffer(offerId: string, accepted: boolean) {
    clearInterval(timers[offerId]);
    delete timers[offerId];
    const { [offerId]: _, ...rest } = countdowns;
    countdowns = rest;
    offers = offers.filter(o => o.id !== offerId);

    if (typeof (window as any).mp !== 'undefined') {
      const event = accepted ? 'client:acceptOffer' : 'client:rejectOffer';
      (window as any).mp.trigger(event, offerId);
    }
  }

  // Global hook — CEF'ten çağrılır
  if (typeof window !== 'undefined') {
    (window as any).showOffer = (jsonStr: string) => {
      try {
        const offer: Offer = JSON.parse(jsonStr);
        addOffer(offer);
      } catch {}
    };
  }

  const ICON_BY_TYPE: Record<string, string> = {
    faction_invite: '⚔',
    trade:          '⇌',
    taxi:           '🚕',
  };

  onDestroy(() => {
    delete (window as any).showOffer;
  });
</script>

{#if offers.length > 0}
  <div class="offer-container">
    {#each offers as offer (offer.id)}
      {@const icon = ICON_BY_TYPE[offer.type] ?? '●'}
      {@const secs = countdowns[offer.id]}
      <div class="offer-card" role="dialog" aria-modal="true" aria-label={offer.title}>
        <div class="offer-header">
          <span class="offer-icon">{icon}</span>
          <span class="offer-title">{offer.title}</span>
          {#if secs !== undefined}
            <span class="offer-timer" class:offer-timer-urgent={secs <= 10}>{secs}s</span>
          {/if}
        </div>

        {#if offer.from}
          <div class="offer-from">{offer.from}</div>
        {/if}

        <div class="offer-desc">{offer.description}</div>

        {#if secs !== undefined}
          <div class="offer-progress-track">
            <div
              class="offer-progress-bar"
              style="width: {((secs / (offer.timeout ?? 30)) * 100).toFixed(1)}%"
            ></div>
          </div>
        {/if}

        <div class="offer-actions">
          <button class="offer-btn accept" onclick={() => dismissOffer(offer.id, true)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 6.5L4.5 9.5L10.5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Kabul Et
          </button>
          <button class="offer-btn reject" onclick={() => dismissOffer(offer.id, false)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            Reddet
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .offer-container {
    position: fixed;
    bottom: 80px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 9000;
    pointer-events: none;
    max-width: 320px;
    width: 320px;
  }

  .offer-card {
    pointer-events: all;
    background: rgba(16, 16, 22, 0.96);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 14px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.55),
      0 1px 0 rgba(255, 255, 255, 0.04) inset;
    font-family: 'Segoe UI', 'Inter', sans-serif;
    animation: slide-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes slide-in {
    from { transform: translateX(40px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }

  .offer-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .offer-icon {
    font-size: 16px;
    line-height: 1;
  }

  .offer-title {
    flex: 1;
    font-size: 13px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: 0.01em;
  }

  .offer-timer {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    min-width: 28px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .offer-timer.offer-timer-urgent {
    color: #f87171;
  }

  .offer-from {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 500;
  }

  .offer-desc {
    font-size: 12px;
    color: #cbd5e1;
    line-height: 1.5;
  }

  .offer-progress-track {
    height: 2px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
  }

  .offer-progress-bar {
    height: 100%;
    background: rgba(194, 160, 82, 0.7);
    border-radius: 2px;
    transition: width 1s linear;
  }

  .offer-actions {
    display: flex;
    gap: 8px;
  }

  .offer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.12s, opacity 0.12s;
  }

  .offer-btn.accept {
    background: rgba(52, 211, 153, 0.15);
    color: #34d399;
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .offer-btn.accept:hover {
    background: rgba(52, 211, 153, 0.28);
    border-color: rgba(52, 211, 153, 0.5);
  }

  .offer-btn.reject {
    background: rgba(248, 113, 113, 0.1);
    color: #f87171;
    border: 1px solid rgba(248, 113, 113, 0.25);
  }

  .offer-btn.reject:hover {
    background: rgba(248, 113, 113, 0.22);
    border-color: rgba(248, 113, 113, 0.4);
  }
</style>
