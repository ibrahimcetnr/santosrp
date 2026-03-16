<script lang="ts">
        import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
  import type { ItemDef, InventorySlot } from '../../../../shared/types';
  import { isInventoryOpen, inventoryPayload } from '../store';


  // ── Tipler ────────────────────────────────────────────────────────────────
      interface InventoryPayload {
    slots:           InventorySlot[];
    maxWeight:       number;
    weight:          number;
    items:           Record<string, ItemDef>;
    charName?:       string;
    otherSlots?:     InventorySlot[];
    otherName?:      string;
    otherMaxWeight?: number;
    otherWeight?:    number;
  }

  // ── State (Svelte 5 Runes) ────────────────────────────────────────────────
  let charName       = $state('Karakter');
  let maxWeight      = $state(30);
  let currentWeight  = $state(0);
  
  let items          = $state<Record<string, ItemDef>>({});
  let playerSlots    = $state<Map<number, InventorySlot>>(new Map());

  let otherSlots     = $state<Map<number, InventorySlot>>(new Map());
  let otherName      = $state('');
  let otherMaxWeight = $state(30);
  let otherWeight    = $state(0);
  let hasOther       = $state(false);

  // Sürükle-Bırak State
  let dragging   = $state(false);
  let dragSlot   = $state<number | null>(null);
  let dragOrigin = $state<'self' | 'other'>('self');

  // Sağ Tık (Context - İşlem) Menü
  let ctxVisible = $state(false);
  let ctxX       = $state(0);
  let ctxY       = $state(0);
  let ctxSlot    = $state<number | null>(null);
  let ctxOrigin  = $state<'self' | 'other'>('self');

  // Toplam Gösterilecek Slot Sayısı (Görseldeki gibi kompakt bir grid için 25 veya 30 idealdir, 30 yapıyoruz)
  const TOTAL_SLOTS = 30;

  // ── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────
  function getImgUrl(itemId: string) {
    const def = items[itemId];
    return def ? `./assets/images/icons/items/${def.img}.png` : './assets/images/icons/items/default.png';
  }

  function handleImgError(e: Event) {
    const target = e.target as HTMLImageElement;
    target.src = './assets/images/icons/items/default.png';
  }

  function triggerMP(fnName: string, ...args: any[]) {
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger(fnName, ...args);
    } else {
      console.log(`[RAGE-MOCK] ${fnName}`, args);
    }
  }

  function closeInv() {
    isInventoryOpen.set(false);
    ctxVisible = false;
    triggerMP('server:inventory:close');
  }

  $effect(() => {
    const payload = $inventoryPayload as InventoryPayload | null;
    if (!payload) {
      items = {};
      playerSlots = new Map();
      otherSlots = new Map();
      hasOther = false;
      return;
    }

    items = payload.items || {};
    charName = payload.charName || 'Oyuncu';
    maxWeight = payload.maxWeight || 30;
    currentWeight = payload.weight || 0;

    const pm = new Map<number, InventorySlot>();
    for (const slot of payload.slots || []) pm.set(slot.slot, slot);
    playerSlots = pm;

    if (payload.otherSlots && payload.otherSlots.length > 0) {
      const om = new Map<number, InventorySlot>();
      for (const slot of payload.otherSlots) om.set(slot.slot, slot);
      otherSlots = om;
      otherName = payload.otherName || 'Depo / Bagaj';
      otherMaxWeight = payload.otherMaxWeight || 30;
      otherWeight = payload.otherWeight || 0;
      hasOther = true;
    } else {
      otherSlots = new Map();
      hasOther = false;
    }
  });

  // ── Sürükle-Bırak İşlemleri ────────────────────────────────────────────────
  function onDragStart(e: DragEvent, slot: number, origin: 'self' | 'other') {
    dragging = true;
    dragSlot = slot;
    dragOrigin = origin;
    ctxVisible = false;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', slot.toString()); 
    }
  }

  function onDragEnd() {
    dragging = false;
    dragSlot = null;
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function onDrop(e: DragEvent, toSlot: number, toOrigin: 'self' | 'other') {
    e.preventDefault();
    if (dragSlot === null || !dragging) return;
    if (dragOrigin === toOrigin && dragSlot === toSlot) return; 

    const entry = dragOrigin === 'self' ? playerSlots.get(dragSlot) : otherSlots.get(dragSlot);
    if (!entry) return;

    if (dragOrigin === 'self' && toOrigin === 'self') {
      triggerMP('server:inventory:moveSlot', dragSlot, toSlot, entry.amount);
    } else if (dragOrigin === 'other' && toOrigin === 'self') {
      triggerMP('server:inventory:takeFromOther', dragSlot, toSlot, entry.amount);
    } else if (dragOrigin === 'self' && toOrigin === 'other') {
      triggerMP('server:inventory:putToOther', dragSlot, toSlot, entry.amount);
    }
    dragging = false;
  }

  // ── Sağ Tık (Context Menü) ─────────────────────────────────────────────────
  function openCtx(e: MouseEvent, slot: number, origin: 'self' | 'other') {
    e.preventDefault();
    e.stopPropagation();
    
    const entry = origin === 'self' ? playerSlots.get(slot) : otherSlots.get(slot);
    if (!entry) return;

    ctxSlot = slot;
    ctxOrigin = origin;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Ekrana sığdırma koruması
    if (x + 150 > window.innerWidth) x -= 150;
    if (y + 150 > window.innerHeight) y -= 150;
    
    ctxX = x;
    ctxY = y;
    ctxVisible = true;
  }

  function handleAction(action: 'use' | 'drop' | 'take') {
    if (ctxSlot === null) return;
    const entry = ctxOrigin === 'self' ? playerSlots.get(ctxSlot) : otherSlots.get(ctxSlot);
    if (!entry) return;

    if (action === 'use') {
        triggerMP('server:inventory:useItem', ctxSlot);
    } else if (action === 'drop') {
        triggerMP('server:inventory:dropItem', ctxSlot, entry.amount); // Hepsini atar (Miktar bölme eklenebilir)
    } else if (action === 'take') {
        triggerMP('server:inventory:takeFromOther', ctxSlot, entry.amount);
    }
    ctxVisible = false;
  }

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
          if ($isInventoryOpen) {
              e.preventDefault();
              closeInv();
          }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  });

</script>

{#if $isInventoryOpen}
<div class="inventory-overlay" onclick={() => ctxVisible = false}>
    
    <div class="inventory-container" onclick={(e) => e.stopPropagation()}>
        
        <div class="inventory-panel" transition:fly={{ x: 40, duration: 180 }}>
            <div class="panel-header">
                <div class="header-title">
                    <span class="icon">🎒</span> ENVANTER
                </div>
                <div class="header-weight">
                    {currentWeight.toFixed(1)} <span style="opacity: 0.5">/ {maxWeight} KG</span>
                </div>
            </div>
            
            <div class="weight-bar-bg">
                <div class="weight-bar-fill" style="width: {(currentWeight / maxWeight) * 100}%"></div>
            </div>

            <div class="slot-grid">
                {#each Array(TOTAL_SLOTS) as _, i}
                    {@const entry = playerSlots.get(i)}
                    {@const def = entry ? items[entry.itemId] : null}
                    
                    <div class="slot {entry ? 'filled' : ''} {dragging && dragSlot === i && dragOrigin === 'self' ? 'dragging' : ''}"
                         ondragover={onDragOver}
                         ondrop={(e) => onDrop(e, i, 'self')}
                         oncontextmenu={(e) => entry && openCtx(e, i, 'self')}>
                        
                        {#if entry && def}
                            <img src={getImgUrl(entry.itemId)} alt={def.name} onerror={handleImgError}
                                 draggable="true"
                                 ondragstart={(e) => onDragStart(e, i, 'self')}
                                 ondragend={onDragEnd}>
                            <div class="amount">{entry.amount}</div>
                            <div class="tooltip">{def.name}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        {#if hasOther}
        <div class="inventory-panel other-panel" transition:fly={{ x: 40, duration: 180 }}>
            <div class="panel-header">
                <div class="header-title">
                    <span class="icon">📦</span> {otherName.toUpperCase()}
                </div>
                <div class="header-weight">
                    {otherWeight.toFixed(1)} <span style="opacity: 0.5">/ {otherMaxWeight} KG</span>
                </div>
            </div>
            
            <div class="weight-bar-bg">
                <div class="weight-bar-fill" style="width: {(otherWeight / otherMaxWeight) * 100}%"></div>
            </div>

            <div class="slot-grid">
                {#each Array(TOTAL_SLOTS) as _, i}
                    {@const entry = otherSlots.get(i)}
                    {@const def = entry ? items[entry.itemId] : null}
                    
                    <div class="slot {entry ? 'filled' : ''}"
                         ondragover={onDragOver}
                         ondrop={(e) => onDrop(e, i, 'other')}
                         oncontextmenu={(e) => entry && openCtx(e, i, 'other')}>
                        
                        {#if entry && def}
                            <img src={getImgUrl(entry.itemId)} alt={def.name} onerror={handleImgError}
                                 draggable="true"
                                 ondragstart={(e) => onDragStart(e, i, 'other')}
                                 ondragend={onDragEnd}>
                            <div class="amount">{entry.amount}</div>
                            <div class="tooltip">{def.name}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        {/if}

    </div>

    {#if ctxVisible && ctxSlot !== null}
        {@const entry = ctxOrigin === 'self' ? playerSlots.get(ctxSlot) : otherSlots.get(ctxSlot)}
        {@const def = entry ? items[entry.itemId] : null}
        
        {#if entry && def}
            <div class="context-menu" style="left: {ctxX}px; top: {ctxY}px;" onclick={(e) => e.stopPropagation()}>
                <div class="ctx-header">
                    <div class="ctx-name">{def.name}</div>
                    <div class="ctx-desc">{def.weight} KG • {entry.amount} Adet</div>
                </div>
                
                {#if ctxOrigin === 'self'}
                    {#if def.usable}
                        <div class="ctx-btn" onclick={() => handleAction('use')}>Eşyayı Kullan</div>
                    {/if}
                    <div class="ctx-btn text-red" onclick={() => handleAction('drop')}>Yere At</div>
                {:else}
                    <div class="ctx-btn" onclick={() => handleAction('take')}>Envantere Al</div>
                {/if}
            </div>
        {/if}
    {/if}

</div>
{/if}

<style>
/* =========================================================================
   COMPACT TOP-RIGHT INVENTORY CSS (Görseldeki Gibi)
========================================================================== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.inventory-overlay {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: transparent; /* Arka planı karartmıyoruz, oyunu görmeye devam */
    z-index: 1000;
    font-family: 'Inter', sans-serif;
    user-select: none;
}

.inventory-container {
    position: absolute;
    top: 2vw;          /* Sağ üstten boşluk */
    right: 2vw;        /* Sağ üstten boşluk */
    display: flex;
    flex-direction: column;
    gap: 1vw;
    align-items: flex-end;
}

/* Panel Genel Yapısı */
.inventory-panel {
    width: 22vw; /* Panel genişliği */
    background: rgba(15, 15, 15, 0.85); /* Koyu, hafif saydam arka plan */
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 0.8vw;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    animation: slideInRight 0.2s ease-out;
}

@keyframes slideInRight {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
}

/* Üst Başlık (Header) */
.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5vw;
    color: #fff;
}
.header-title {
    font-size: 0.8vw;
    font-weight: 700;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 0.4vw;
}
.header-weight {
    font-size: 0.7vw;
    font-weight: 600;
}

/* Yatay Ağırlık Barı */
.weight-bar-bg {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    margin-bottom: 1vw;
    overflow: hidden;
}
.weight-bar-fill {
    height: 100%;
    background: #3b82f6; /* Tatlı bir mavi */
    transition: width 0.3s ease;
}
.other-panel .weight-bar-fill { background: #10b981; /* Karşı depo için yeşil bar */ }

/* Grid Sistemi (5 Sütunlu) */
.slot-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.4vw;
}

/* Slot Tasarımı */
.slot {
    aspect-ratio: 1 / 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}
.slot.filled {
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
}
.slot.filled:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
}
.slot.dragging {
    opacity: 0.4;
}

/* Eşya Görseli */
.slot img {
    width: 65%;
    height: 65%;
    object-fit: contain;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));
}

/* Miktar Yazısı */
.amount {
    position: absolute;
    bottom: 2px;
    right: 4px;
    color: #fff;
    font-size: 0.6vw;
    font-weight: 700;
    text-shadow: 1px 1px 2px #000;
    pointer-events: none;
}

/* Hover Tooltip (Eşya İsmi) */
.tooltip {
    display: none;
    position: absolute;
    bottom: 110%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    padding: 0.3vw 0.5vw;
    font-size: 0.6vw;
    border-radius: 3px;
    white-space: nowrap;
    z-index: 10;
    pointer-events: none;
    border: 1px solid rgba(255,255,255,0.1);
}
.slot.filled:hover .tooltip { display: block; }

/* Sağ Tık (Context) Menüsü */
.context-menu {
    position: absolute;
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    width: 10vw;
    box-shadow: 0 5px 15px rgba(0,0,0,0.6);
    z-index: 1000;
    overflow: hidden;
    animation: fadeIn 0.1s ease-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.ctx-header {
    padding: 0.6vw;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.ctx-name { color: #fff; font-size: 0.75vw; font-weight: 600; margin-bottom: 0.2vw; }
.ctx-desc { color: #aaa; font-size: 0.6vw; font-weight: 500; }

.ctx-btn {
    padding: 0.6vw;
    color: #ddd;
    font-size: 0.7vw;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
}
.ctx-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.ctx-btn.text-red { color: #ef4444; }
.ctx-btn.text-red:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }
</style>
