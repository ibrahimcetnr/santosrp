<script lang="ts">
    import { onMount } from 'svelte';
    import { SvelteMap } from 'svelte/reactivity';
    import Icon from './Icon.svelte';
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
        otherType?:      number;
        otherId?:        number;
    otherName?:      string;
    otherMaxWeight?: number;
    otherWeight?:    number;
        otherGridRows?:  number;
        otherGridCols?:  number;
  }

  // ── State (Svelte 5 Runes) ────────────────────────────────────────────────
  let charName       = $state('Karakter');
  let maxWeight      = $state(30);
  let currentWeight  = $state(0);
  
  let items          = $state<Record<string, ItemDef>>({});
    let playerSlots    = $state(new SvelteMap<number, InventorySlot>());

    let otherSlots     = $state(new SvelteMap<number, InventorySlot>());
    let otherType      = $state<number | null>(null);
    let otherId        = $state<number | null>(null);
  let otherName      = $state('');
    let otherGridRows  = $state(3);
    let otherGridCols  = $state(7);
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

    // Split Modal State
    let splitOpen  = $state(false);
    let splitTitle = $state('Miktar');
    let splitMax   = $state(1);
    let splitValue = $state('1');
    let splitResolver = $state<((value: number | null) => void) | null>(null);

  // Toplam Gösterilecek Slot Sayısı (Görseldeki gibi kompakt bir grid için 25 veya 30 idealdir, 30 yapıyoruz)
    const GRID_COLUMNS = 7;
    const GRID_ROWS = 3;
    const TOTAL_SLOTS = GRID_COLUMNS * GRID_ROWS;

    type InventoryCategory = 'general' | 'keys' | 'food' | 'weapons' | 'clothes';

    const INVENTORY_CATEGORIES: Array<{ key: InventoryCategory; label: string; icon: string }> = [
        { key: 'general', label: 'Genel', icon: 'backpack' },
        { key: 'keys', label: 'Anahtarlar', icon: 'car-lock' },
        { key: 'food', label: 'Yiyecek İçecekler', icon: 'burger' },
        { key: 'weapons', label: 'Silahlar', icon: 'pistol' },
        { key: 'clothes', label: 'Kıyafetler', icon: 'users' }
    ];

    let activeCategory = $state<InventoryCategory>('general');

    // ── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────

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
        activeCategory = 'general';
        triggerMP('client:inventory:closeRequest');
  }

    function requestSplitAmount(maxAmount: number, title: string): Promise<number | null> {
        if (maxAmount <= 1) return Promise.resolve(1);

        splitTitle = title;
        splitMax = maxAmount;
        splitValue = `${maxAmount}`;
        splitOpen = true;

        return new Promise((resolve) => {
            splitResolver = resolve;
        });
    }

    function closeSplitModal(result: number | null) {
        splitOpen = false;
        if (splitResolver) {
            const resolver = splitResolver;
            splitResolver = null;
            resolver(result);
        }
    }

    function confirmSplitModal() {
        const parsed = Number.parseInt(splitValue, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            closeSplitModal(null);
            return;
        }
        closeSplitModal(Math.min(parsed, splitMax));
    }

    function isKeyItem(def: ItemDef): boolean {
        return def.type === 'key' || /anahtar|key/i.test(def.id) || /anahtar|key/i.test(def.name);
    }

    function isFoodItem(def: ItemDef): boolean {
        return def.type === 'consumable';
    }

    function isWeaponItem(def: ItemDef): boolean {
        return (
            def.type === 'weapon' ||
            /weapon|silah|gun|pistol|rifle|shotgun|smg/i.test(def.id) ||
            /weapon|silah|gun|pistol|rifle|shotgun|smg/i.test(def.name)
        );
    }

    function isClothesItem(def: ItemDef): boolean {
        return (
            def.type === 'clothes' ||
            def.type === 'clothing' ||
            /clothes|clothing|kıyafet|kiyafet|shirt|pants|jacket|hat|shoe/i.test(def.id) ||
            /kıyafet|kiyafet|elbise|ceket|pantolon|şapka|sapka|ayakkabı|ayakkabi/i.test(def.name)
        );
    }

    function getCategoryForDef(def: ItemDef): InventoryCategory {
        if (isKeyItem(def)) return 'keys';
        if (isFoodItem(def)) return 'food';
        if (isWeaponItem(def)) return 'weapons';
        if (isClothesItem(def)) return 'clothes';
        return 'general';
    }

    function getCategorySlotPool(category: InventoryCategory): number[] {
        const startByCategory: Record<InventoryCategory, number> = {
            general: 0,
            keys: 100,
            food: 200,
            weapons: 300,
            clothes: 400
        };

        const start = startByCategory[category];
        return Array.from({ length: TOTAL_SLOTS }, (_, i) => start + i);
    }

    function getPlayerGridCells(): Array<{ slotIndex: number; entry: InventorySlot | null; def: ItemDef | null }> {
        const slotPool = getCategorySlotPool(activeCategory);
        const allCategoryEntries: Array<{ slotIndex: number; entry: InventorySlot; def: ItemDef }> = Array.from(playerSlots.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([slotIndex, entry]) => {
                const def = items[entry.itemId] || null;
                return { slotIndex, entry, def } as { slotIndex: number; entry: InventorySlot; def: ItemDef | null };
            })
            .filter((cell) => cell.def && getCategoryForDef(cell.def) === activeCategory)
            .slice(0, TOTAL_SLOTS) as Array<{ slotIndex: number; entry: InventorySlot; def: ItemDef }>;

        const inPoolEntries = new Map<number, { entry: InventorySlot; def: ItemDef }>();
        const outOfPoolEntries: Array<{ slotIndex: number; entry: InventorySlot; def: ItemDef }> = [];

        for (const cell of allCategoryEntries) {
            if (slotPool.includes(cell.slotIndex)) {
                inPoolEntries.set(cell.slotIndex, { entry: cell.entry, def: cell.def });
            } else {
                outOfPoolEntries.push(cell);
            }
        }

        const cells: Array<{ slotIndex: number; entry: InventorySlot | null; def: ItemDef | null }> = slotPool.map((slotIndex) => {
            const found = inPoolEntries.get(slotIndex);
            if (!found) return { slotIndex, entry: null, def: null };
            return { slotIndex, entry: found.entry, def: found.def };
        });

        for (const cell of outOfPoolEntries) {
            const emptyIndex = cells.findIndex((gridCell) => !gridCell.entry);
            if (emptyIndex === -1) break;
            cells[emptyIndex] = {
                slotIndex: cell.slotIndex,
                entry: cell.entry,
                def: cell.def
            };
        }

        return cells;
    }

  $effect(() => {
    const payload = $inventoryPayload as InventoryPayload | null;
    if (!payload) {
      items = {};
            playerSlots = new SvelteMap<number, InventorySlot>();
            otherSlots = new SvelteMap<number, InventorySlot>();
            otherType = null;
            otherId = null;
      hasOther = false;
      return;
    }

    items = payload.items || {};
    charName = payload.charName || 'Oyuncu';
    maxWeight = payload.maxWeight || 30;
    currentWeight = payload.weight || 0;

        const pm = new SvelteMap<number, InventorySlot>();
    for (const slot of payload.slots || []) pm.set(slot.slot, slot);
    playerSlots = pm;

        const hasOtherContext =
            payload.otherType !== undefined &&
            payload.otherId !== undefined &&
            Number(payload.otherId) > 0;

        if (hasOtherContext || payload.otherSlots !== undefined) {
            const om = new SvelteMap<number, InventorySlot>();
            for (const slot of payload.otherSlots || []) om.set(slot.slot, slot);
            otherSlots = om;
            otherType = payload.otherType ?? null;
            otherId = payload.otherId ?? null;
            otherName = payload.otherName || 'Depo / Bagaj';
            otherGridRows = Math.max(1, payload.otherGridRows || 3);
            otherGridCols = Math.max(1, payload.otherGridCols || 7);
            otherMaxWeight = payload.otherMaxWeight || 30;
            otherWeight = payload.otherWeight || 0;
            hasOther = true;
        } else {
            otherSlots = new SvelteMap<number, InventorySlot>();
            otherType = null;
            otherId = null;
            otherGridRows = 3;
            otherGridCols = 7;
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

    async function onDrop(e: DragEvent, toSlot: number, toOrigin: 'self' | 'other') {
    e.preventDefault();
    if (dragSlot === null || !dragging) return;
    if (dragOrigin === toOrigin && dragSlot === toSlot) return; 

    const entry = dragOrigin === 'self' ? playerSlots.get(dragSlot) : otherSlots.get(dragSlot);
    if (!entry) return;

                const splitAmount = entry.amount;

        const otherCtxType = otherType;
        const otherCtxId = otherId;

    if (dragOrigin === 'self' && toOrigin === 'self') {
            triggerMP('server:inventory:moveSlot', dragSlot, toSlot, splitAmount, otherCtxType, otherCtxId);
        } else if (dragOrigin === 'other' && toOrigin === 'other') {
            if (otherCtxType === null || otherCtxId === null) return;
            triggerMP('server:inventory:moveOtherSlot', dragSlot, toSlot, splitAmount, otherCtxType, otherCtxId);
    } else if (dragOrigin === 'other' && toOrigin === 'self') {
            if (otherCtxType === null || otherCtxId === null) return;
            triggerMP('server:inventory:takeFromOther', dragSlot, toSlot, splitAmount, otherCtxType, otherCtxId);
    } else if (dragOrigin === 'self' && toOrigin === 'other') {
            if (otherCtxType === null || otherCtxId === null) return;
            triggerMP('server:inventory:putToOther', dragSlot, toSlot, splitAmount, otherCtxType, otherCtxId);
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

    async function handleAction(action: 'use' | 'drop' | 'take' | 'split') {
    if (ctxSlot === null) return;
    const entry = ctxOrigin === 'self' ? playerSlots.get(ctxSlot) : otherSlots.get(ctxSlot);
    if (!entry) return;

        const hasEntryMetadata = !!entry.metadata && (typeof entry.metadata !== 'object' || Object.keys(entry.metadata).length > 0);
    const otherCtxType = otherType;
    const otherCtxId = otherId;
        const amountForAction = (action === 'drop' || action === 'take' || action === 'split')
            ? await requestSplitAmount(
                    entry.amount,
                    action === 'drop'
                        ? 'Yere atılacak miktar'
                        : action === 'take'
                            ? 'Alınacak miktar'
                            : 'Ayrılacak miktar'
                )
      : entry.amount;

    if (amountForAction === null || amountForAction <= 0) return;

    if (action === 'use') {
        triggerMP('server:inventory:useItem', ctxSlot, otherCtxType, otherCtxId);
    } else if (action === 'split') {
        if (ctxOrigin !== 'self') return;
        if (hasEntryMetadata) return;
        triggerMP('server:inventory:splitSlot', ctxSlot, amountForAction, otherCtxType, otherCtxId);
    } else if (action === 'drop') {
        triggerMP('server:inventory:dropItem', ctxSlot, amountForAction, otherCtxType, otherCtxId);
    } else if (action === 'take') {
        if (otherCtxType === null || otherCtxId === null) return;
        triggerMP('server:inventory:takeFromOther', ctxSlot, -1, amountForAction, otherCtxType, otherCtxId);
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
    
    <div class="inventory-container" onclick={(e) => { ctxVisible = false; e.stopPropagation(); }}>
        
        <div class="inventory-panel">
            <div class="panel-top">
                <div class="top-weight-value">
                    {currentWeight.toFixed(1)} <span class="weight-max">/ {maxWeight} KG</span>
                </div>
                <div class="top-weight-vertical">
                    <div class="weight-bar-fill" style="transform: scaleY({Math.max(0, Math.min(1, currentWeight / maxWeight || 0))});"></div>
                </div>
            </div>

            <div class="panel-header">
                <div class="header-title">
                    <span class="icon"><Icon name="backpack" size="1.2vw" /></span> ENVANTER
                </div>
            </div>

            <div class="category-tabs">
                {#each INVENTORY_CATEGORIES as category}
                    <button
                        type="button"
                        class="category-tab {activeCategory === category.key ? 'active' : ''}"
                        title={category.label}
                        onclick={() => activeCategory = category.key}
                    >
                        <Icon name={category.icon} size="0.82vw" />
                    </button>
                {/each}
            </div>

            <div class="slot-grid" style="--grid-cols: {GRID_COLUMNS};">
                {#each getPlayerGridCells() as cell}
                    {@const entry = cell.entry}
                    {@const def = cell.def}
                    {@const slotIndex = cell.slotIndex}
                    
                    <div class="slot {entry ? 'filled' : ''} {dragging && dragSlot === slotIndex && dragOrigin === 'self' ? 'dragging' : ''}"
                        draggable={!!entry}
                        ondragstart={(e) => entry && onDragStart(e, slotIndex, 'self')}
                         ondragend={onDragEnd}
                         ondragover={onDragOver}
                        ondrop={(e) => onDrop(e, slotIndex, 'self')}
                        oncontextmenu={(e) => entry && openCtx(e, slotIndex, 'self')}>
                        
                        {#if entry && def}
                            <div class="slot-icon">
                                <Icon name={def.icon || 'default'} size="100%" />
                            </div>
                            <div class="amount">{entry.amount}</div>
                            <div class="tooltip">{def.name}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        {#if hasOther}
        <div class="inventory-panel other-panel">
            <div class="panel-top">
                <div class="top-weight-value">
                    {otherWeight.toFixed(1)} <span class="weight-max">/ {otherMaxWeight} KG</span>
                </div>
                <div class="top-weight-vertical">
                    <div class="weight-bar-fill" style="transform: scaleY({Math.max(0, Math.min(1, otherWeight / otherMaxWeight || 0))});"></div>
                </div>
            </div>

            <div class="panel-header">
                <div class="header-title">
                    <span class="icon"><Icon name="box" size="1.2vw" /></span> {otherName.toUpperCase()}
                </div>
            </div>

            <div class="slot-grid" style="--grid-cols: {otherGridCols};">
                {#each Array(otherGridRows * otherGridCols) as _, i}
                    {@const entry = otherSlots.get(i)}
                    {@const def = entry ? items[entry.itemId] : null}
                    
                    <div class="slot {entry ? 'filled' : ''}"
                         draggable={!!entry}
                         ondragstart={(e) => entry && onDragStart(e, i, 'other')}
                         ondragend={onDragEnd}
                         ondragover={onDragOver}
                         ondrop={(e) => onDrop(e, i, 'other')}
                         oncontextmenu={(e) => entry && openCtx(e, i, 'other')}>
                        
                        {#if entry && def}
                            <div class="slot-icon">
                                <Icon name={def.icon || 'default'} size="100%" />
                            </div>
                            <div class="amount">{entry.amount}</div>
                            <div class="tooltip">{def.name}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        {/if}

        {#if splitOpen}
            <div class="split-modal-backdrop" onclick={() => closeSplitModal(null)}>
                <div class="split-modal" onclick={(e) => e.stopPropagation()}>
                    <div class="split-title">{splitTitle}</div>
                    <div class="split-desc">1 - {splitMax} arası bir miktar gir.</div>
                    <input
                        class="split-input"
                        type="number"
                        min="1"
                        max={splitMax}
                        bind:value={splitValue}
                        onkeydown={(e) => {
                            if (e.key === 'Enter') confirmSplitModal();
                            if (e.key === 'Escape') closeSplitModal(null);
                        }}
                    />
                    <div class="split-actions">
                        <button type="button" class="split-btn ghost" onclick={() => closeSplitModal(null)}>İptal</button>
                        <button type="button" class="split-btn" onclick={confirmSplitModal}>Onayla</button>
                    </div>
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
                    {#if entry.amount > 1 && (!entry.metadata || (typeof entry.metadata === 'object' && Object.keys(entry.metadata).length === 0))}
                        <div class="ctx-btn" onclick={() => handleAction('split')}>Ayır</div>
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
}

/* Üst Başlık (Header) */
.panel-header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 0.35vw;
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
.panel-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.45vw;
}

.top-weight-value {
    font-size: 0.62vw;
    font-weight: 700;
    color: #fff;
    line-height: 1;
}

.weight-max {
    opacity: 0.55;
    font-weight: 600;
}

.top-weight-vertical {
    width: 0.45vw;
    height: 3.2vw;
    margin-left: auto;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    overflow: hidden;
}

.weight-bar-fill {
    width: 100%;
    height: 100%;
    background: #3b82f6; /* Tatlı bir mavi */
    transform-origin: bottom center;
}
.other-panel .weight-bar-fill { background: #10b981; /* Karşı depo için yeşil bar */ }

.category-tabs {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.35vw;
    margin-bottom: 0.5vw;
}

.category-tab {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.22vw;
    min-height: 1.45vw;
    cursor: pointer;
}

.category-tab:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
}

.category-tab.active {
    background: rgba(59, 130, 246, 0.22);
    border-color: rgba(59, 130, 246, 0.6);
    color: #fff;
}

/* Grid Sistemi (5 Sütunlu) */
.slot-grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-cols, 7), 1fr);
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

/* Eşya İkonu */
.slot-icon {
    width: 65%;
    height: 65%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));
}

.slot-icon :global(svg) {
    width: 100%;
    height: 100%;
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
}

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
}
.ctx-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.ctx-btn.text-red { color: #ef4444; }
.ctx-btn.text-red:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }

.split-modal-backdrop {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    z-index: 1200;
}

.split-modal {
    width: 16vw;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    background: rgba(14, 14, 14, 0.96);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.5);
    padding: 0.8vw;
}

.split-title {
    color: #fff;
    font-size: 0.78vw;
    font-weight: 700;
    margin-bottom: 0.3vw;
}

.split-desc {
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.64vw;
    margin-bottom: 0.55vw;
}

.split-input {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    font-size: 0.7vw;
    padding: 0.38vw 0.5vw;
    outline: none;
}

.split-input:focus {
    border-color: rgba(59, 130, 246, 0.7);
}

.split-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.35vw;
    margin-top: 0.65vw;
}

.split-btn {
    border: 1px solid rgba(59, 130, 246, 0.65);
    background: rgba(59, 130, 246, 0.2);
    color: #fff;
    border-radius: 4px;
    font-size: 0.64vw;
    font-weight: 600;
    padding: 0.32vw 0.55vw;
    cursor: pointer;
}

.split-btn.ghost {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.07);
}
</style>
