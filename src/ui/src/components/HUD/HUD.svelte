<script lang="ts">
  import { onMount, tick } from 'svelte';

  // Props
  let { myAdminLevel = 0, commands = [] } = $props<{ myAdminLevel?: number; commands?: any[] }>();

  // --- STATE: HUD Verileri ---
  let charName    = $state('Oyuncu');        // hudInit ile gelir
  let playerId    = $state(0);              // RAGE player.id
  let location    = $state('Los Santos');
  let direction   = $state('K');
  let serverDate  = $state('--.--.----');
  let serverTime  = $state('--:--');
  let cashMoney   = $state('0$');
  let currentWeapon = $state('');           // Şimdilik devre dışı
  let mapAnchor = $state({ bottom: 184, left: 24, width: 300 });
  let isWindowLoaded = $state(false);
  
  // Dinamik minimap position state
  let mapBottom = $state(184);
  let mapLeft = $state(24);
  
  // Time offset for server sync
  let timeOffset = $state(0);

  // --- STATE: Araç Verileri --- (Araç sistemi hazır olunca aktif edilecek)
  let inVehicle   = $state(false); // DISABLED: araç veritabanı hazır değil
  let vehicleSpeed = $state(124);
  let isEngineOn = $state(true);
  let isLocked = $state(false);
  let hasSeatbelt = $state(true);
  let fuelLevel = $state(65);

  // --- STATE: Chatbox Verileri ---
  type ChatSegment = { text: string; color: string | null };
  type ChatMessage = { id: number; type: 'rp' | 'ooc' | 'system' | 'ic'; segments: ChatSegment[] };
  const MAX_MESSAGES = 250;

  /**
   * RAGE:MP outputChatBox mesajlarını renk segmentlerine dönüştürür.
   * RAGE, sunucudan gelen !{#RRGGBB} kodlarını client'a iletmeden önce
   * <span style="color: #RRGGBB"> HTML etiketlerine çevirir.
   * Bu fonksiyon o span etiketlerini parse eder.
   * Svelte {} binding kullandığı için seg.text otomatik escape edilir — XSS yok.
   */
  function parseColors(raw: string): ChatSegment[] {
    const segments: ChatSegment[] = [];

    // RAGE'in ürettiği <span style="color: #RRGGBB">metin</span> formatı
    if (raw.includes('<span')) {
      const spanRe = /<span\s[^>]*style="[^"]*color:\s*(#[0-9A-Fa-f]{6})[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = spanRe.exec(raw)) !== null) {
        if (m.index > last) segments.push({ text: raw.slice(last, m.index), color: null });
        segments.push({ text: m[2], color: m[1] });
        last = spanRe.lastIndex;
      }
      if (last < raw.length) segments.push({ text: raw.slice(last), color: null });
      if (segments.length > 0) return segments;
    }

    // Doğrudan !{#RRGGBB} formatı (custom eventlar için fallback)
    const parts = raw.split(/(!\{#[0-9A-Fa-f]{6}\})/);
    let color: string | null = null;
    for (const part of parts) {
      const cm = part.match(/^!\{(#[0-9A-Fa-f]{6})\}$/);
      if (cm) { color = cm[1]; }
      else if (part) { segments.push({ text: part, color }); }
    }
    return segments.length > 0 ? segments : [{ text: raw, color: null }];
  }

  /** Mesaj tipi tespiti */
  function detectType(_raw: string): ChatMessage['type'] {
    return 'ic';
  }

  let messages = $state<ChatMessage[]>([
    { id: 1,  type: 'system', segments: [{ text: '═══════════════════════════════════════════════', color: null }] },
    { id: 2,  type: 'system', segments: [{ text: '🎮 SantosRP | Los Santos Roleplay Sunucusuna Hoş Geldiniz!', color: '#c9a84c' }] },
    { id: 3,  type: 'system', segments: [{ text: '═══════════════════════════════════════════════', color: null }] },
    { id: 4,  type: 'system', segments: [{ text: '✅ Enterprise düzeyde performans ve güvenlik', color: '#22c55e' }] },
    { id: 5,  type: 'system', segments: [{ text: '✅ Dinamik komut sistemi (Sayısal yetki tabanlı)', color: '#22c55e' }] },
    { id: 6,  type: 'system', segments: [{ text: '✅ Akıllı Ghost Text (Çoklu argüman takibi)', color: '#22c55e' }] },
    { id: 7,  type: 'system', segments: [{ text: '✅ Gelişmiş karakter yaratıcı (Svelte 5 Runes)', color: '#22c55e' }] },
    { id: 8,  type: 'system', segments: [{ text: '═══════════════════════════════════════════════', color: null }] },
    { id: 9,  type: 'system', segments: [{ text: '💬 Chat açmak için T tuşuna basın', color: '#94a3b8' }] },
    { id: 10, type: 'system', segments: [{ text: '📝 Komut listesi için /admins yazın', color: '#94a3b8' }] },
    { id: 11, type: 'system', segments: [{ text: '🎯 İyi roller dileriz!', color: '#c9a84c' }] },
    { id: 12, type: 'system', segments: [{ text: '═══════════════════════════════════════════════', color: null }] }
  ]);
  
  let isChatActive = $state(false);
  let chatInput = $state('');
  let chatContainer: HTMLElement;

  // --- KOMUT SİSTEMİ ---
  type CommandPermissions = { admin?: number; faction?: number; vip?: number; helper?: number };
  type Command = { name: string; syntax: string; description?: string; permissions?: CommandPermissions };
  let allCommands = $state<Command[]>([]);
  
  // Props'tan gelen komutları allCommands'a yükle
  $effect(() => {
    if (commands.length > 0) {
      allCommands = commands;
      console.log(`[HUD] ${commands.length} komut yüklendi (adminLevel: ${myAdminLevel})`);
    }
  });
  
  // DERIVED: Komut Filtreleme (Yetki + Input bazlı)
  let filteredCommands = $derived.by(() => {
    if (!chatInput.startsWith('/')) return [];
    
    const parts = chatInput.split(' ');
    const baseCmd = parts[0].toLowerCase();
    const hasSpace = parts.length > 1;

    // Önce yetki filtresi
    const accessible = allCommands.filter(c => {
      const reqAdmin = c.permissions?.admin ?? 0;
      return myAdminLevel >= reqAdmin;
    });

    // Sonra input filtresi
    return accessible.filter(c => {
      if (hasSpace) {
        // Boşluk varsa tam eşleşme (syntax göstermek için)
        return c.name.toLowerCase() === baseCmd;
      } else {
        // Boşluk yoksa kısmi eşleşme (autocomplete)
        return c.name.toLowerCase().includes(baseCmd);
      }
    }).slice(0, 5);
  });

  // --- DERIVED: Akıllı Ghost Text Hesabı (Çoklu Argüman Takibi) ---
  let firstSuggestion = $derived(filteredCommands.length > 0 ? filteredCommands[0] : null);
  
  let ghostSuffix = $derived.by(() => {
    if (!firstSuggestion || !chatInput.startsWith('/')) return '';
    
    const inputLower = chatInput.toLowerCase();
    const cmdLower = firstSuggestion.name.toLowerCase();
    
    // 1. Durum: Henüz komut adını yazıyorsa (Örn: "/ki")
    if (cmdLower.startsWith(inputLower)) {
      return firstSuggestion.name.substring(chatInput.length) + (firstSuggestion.syntax ? ' ' + firstSuggestion.syntax : '');
    }
    
    // 2. Durum: Komut adı bitti, argümanlar giriliyor (Örn: "/kick 5 " → "[Sebep]")
    const inputParts = chatInput.split(' ');
    const typedCmd = inputParts[0].toLowerCase();
    
    if (typedCmd === cmdLower && firstSuggestion.syntax) {
      const syntaxParts = firstSuggestion.syntax.split(' ');
      const typedArgsCount = inputParts.length - 1;
      const endsWithSpace = chatInput.endsWith(' ');
      
      if (endsWithSpace) {
        // Kullanıcı boşluk bıraktı → sıradaki argümanı göster
        // Örn: "/kick 5 " → "[Sebep]" (2. argüman)
        const neededIndex = typedArgsCount;
        const remaining = syntaxParts.slice(neededIndex);
        return remaining.join(' ');
      } else {
        // Kullanıcı argüman yazıyor → kalanları göster
        // Örn: "/kick 5" → " [Sebep]"
        const neededIndex = typedArgsCount;
        const remaining = syntaxParts.slice(neededIndex);
        if (remaining.length > 0) {
          return ' ' + remaining.join(' ');
        }
      }
    }
    
    return '';
  });

  // --- FONKSİYONLAR ---
  
  async function pushMessage(msg: ChatMessage) {
    let wasAtBottom = true;
    if (chatContainer) {
      wasAtBottom = (chatContainer.scrollHeight - chatContainer.clientHeight) <= (chatContainer.scrollTop + 15);
    }
    // 250 mesaj limiti: en eski mesajı at
    if (messages.length >= MAX_MESSAGES) {
      messages = [...messages.slice(1), msg];
    } else {
      messages = [...messages, msg];
    }
    await tick();
    if (wasAtBottom && chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  /** Komutun görsel kategorisini permissions objesine göre belirler */
  function getCmdClass(cmd: Command): string {
    const p = cmd.permissions;
    if (!p) return 'player';

    if (p.admin && p.admin > 0) return 'staff';
    if (p.faction && p.faction > 0) return 'faction';
    if (p.helper && p.helper > 0) return 'helper';
    if (p.vip && p.vip > 0) return 'vip';

    return 'player';
  }

  // --- STATE: Chat Geçmişi ---
  let messageHistory = $state<string[]>([]);
  let historyIndex   = $state(-1);
  let savedDraft     = $state('');

  /** Ham mesajı parse edip $state dizisine ekler (window.addChatMessage + chat:push için) */
  function addChatMessage(raw: string) {
    try {
      if (messages.length > 50) messages.shift();
      pushMessage({ id: Date.now(), type: detectType(raw), segments: parseColors(raw) });
    } catch (e: any) {
      window.mp?.trigger('client:debug:ui', e?.message ?? String(e));
    }
  }

  function handleChatKeydown(event: KeyboardEvent) {
    // T tuşu: native bridge focus
    if ((event.key === 't' || event.key === 'T') && !isChatActive) {
      event.preventDefault();
      isChatActive = true;
      window.mp?.invoke('focus', true);
      tick().then(() => document.querySelector<HTMLInputElement>('.chat-input')?.focus());
      return;
    }

    if (!isChatActive) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      const msg = chatInput.trim();
      if (msg.length > 0) {
        // Geçmişe ekle (max 20, en başa)
        messageHistory = [msg, ...messageHistory].slice(0, 20);
        historyIndex   = -1;
        savedDraft     = '';

        if (window.mp) {
          if (msg.startsWith('/')) {
            window.mp.invoke('command', msg.substring(1));
          } else {
            window.mp.invoke('chatMessage', msg);
          }
        } else {
          addChatMessage(`${charName}: ${msg}`);
        }
      }
      chatInput    = '';
      isChatActive = false;
      window.mp?.invoke('focus', false);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (messageHistory.length === 0) return;
      if (historyIndex === -1) savedDraft = chatInput; // taslağı yedekle
      historyIndex = Math.min(historyIndex + 1, messageHistory.length - 1);
      chatInput    = messageHistory[historyIndex];
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === -1) return;
      historyIndex--;
      chatInput = historyIndex === -1 ? savedDraft : messageHistory[historyIndex];
    } else if (event.key === 'Escape') {
      event.preventDefault();
      chatInput    = '';
      historyIndex = -1;
      isChatActive = false;
      window.mp?.invoke('focus', false);
    }
  }

  function selectCommand(cmdName: string) {
    chatInput = cmdName + ' ';
    tick().then(() => {
      document.querySelector<HTMLInputElement>('.chat-input')?.focus();
    });
  }

  onMount(() => {
    window.addEventListener('keydown', handleChatKeydown);

    // ── Senkronize saat sistemi (Time Offset yöntemi) ──────
    function updateSyncedTime() {
      const now = Date.now() + timeOffset;
      const date = new Date(now);
      serverTime = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', hour12: false });
      serverDate = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    updateSyncedTime();
    const timeInterval = setInterval(updateSyncedTime, 1000);

    // ── Server/Client'tan gelen HUD güncellemeleri ──────────────────────────────
    window.syncMinimapData = (bottom: number, left: number, width: number) => {
      mapAnchor = { bottom, left, width };
    };

    window.hudInit = (data: { charName: string; playerId: number; money: string }) => {
      charName  = data.charName;
      playerId  = data.playerId;
      cashMoney = data.money;
    };

    window.hudUpdateLocation = (data: { location: string; direction: string }) => {
      if (data.location) location = data.location;
      direction = data.direction;
    };

    // Dinamik minimap pozisyon güncelleme
    window.hudUpdateMapPosition = (data: { bottom: number; left: number }) => {
      mapBottom = data.bottom;
      mapLeft = data.left;
    };

    window.hudUpdateTime = (_data: { time: string; date: string }) => {};

    window.hudUpdateMoney = (data: { money: string }) => {
      cashMoney = data.money;
    };

    window.openChat = () => {
      isChatActive = true;
      window.mp?.invoke('focus', true);
      tick().then(() => document.querySelector<HTMLInputElement>('.chat-input')?.focus());
    };

    // Native bridge: markAsChat() ile bağlı browser'a server outputChatBox → chat:push eventi gelir
    window.mp?.events?.add('chat:push', (text: string) => {
      addChatMessage(text);
    });

    // Fallback: client/hud.ts üzerinden gelen hudMessage (markAsChat yoksa)
    window.addChatMessage = (text: string) => { addChatMessage(text); };

    
    window.chatAPI = {
      push: (text: string) => { addChatMessage(text); },
      clear: () => { messages = []; },
      activate: (_toggle: boolean) => {},
      show: (_toggle: boolean) => {}
    };

    window.hudMessage = (data: { type: string; text: string }) => {
      addChatMessage(data.text);
    };

    // Araç gösterge paneli güncellemesi (hud.ts'den 100ms'de bir gelir)
    window.hudVehicle = (data: {
      inVehicle: boolean;
      speed?: number;
      fuel?: number;
      engineOn?: boolean;
      isLocked?: boolean;
      seatbelt?: boolean;
    }) => {
      inVehicle    = data.inVehicle;
      if (!data.inVehicle) return;
      vehicleSpeed = data.speed    ?? vehicleSpeed;
      fuelLevel    = data.fuel     ?? fuelLevel;
      isEngineOn   = data.engineOn ?? isEngineOn;
      isLocked     = data.isLocked ?? isLocked;
      hasSeatbelt  = data.seatbelt ?? hasSeatbelt;
    };

    // Komut listesi güncelleme
    window.updateCommandList = (commands: Command[]) => {
      allCommands = commands;
      console.log(`[HUD] ${commands.length} komut yüklendi (adminLevel: ${myAdminLevel})`);
    };

    return () => {
      clearInterval(timeInterval);
      window.removeEventListener('keydown', handleChatKeydown);
      delete window.hudInit;
      delete window.hudUpdateLocation;
      delete window.hudUpdateTime;
      delete window.hudUpdateMoney;
      delete window.hudUpdateMapPosition;
      delete window.openChat;
      delete window.hudMessage;
      delete window.chatAPI;
      delete window.updateCommandList;
      delete window.hudVehicle;
    };
  });
  
  // ── SYNC_TIME event listener ──
  $effect(() => {
    const handleSyncTime = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_TIME' && typeof event.data.timestamp === 'number') {
        timeOffset = event.data.timestamp - Date.now();
      }
    };
    
    window.addEventListener('message', handleSyncTime);
    
    return () => {
      window.removeEventListener('message', handleSyncTime);
    };
  });
</script>

<div class="hud-wrapper">

  <div class="chat-container">
    <div class="chat-messages" bind:this={chatContainer}>
      <div class="chat-messages-inner">
        {#each messages as msg (msg.id)}
          <div class="chat-message {msg.type}">
            {#each msg.segments as seg}
              {#if seg.color}<span style="color:{seg.color}">{seg.text}</span>{:else}{seg.text}{/if}
            {/each}
          </div>
        {/each}
      </div>
    </div>
    
    {#if isChatActive}
      <div class="chat-input-wrapper">
        <div class="chat-input-backdrop">
          <span class="invisible-text">{chatInput}</span>
          <span class="ghost-text">{ghostSuffix}</span>
        </div>
        
        <input 
          type="text" 
          class="chat-input" 
          bind:value={chatInput} 
          autofocus 
          placeholder={chatInput.length === 0 ? "Yaz..." : ""} 
        />
        
        {#if filteredCommands.length > 0}
          <div class="command-row">
            {#each filteredCommands as cmd}
              <div class="cmd-box {getCmdClass(cmd)}" role="button" tabindex="-1" onclick={() => selectCommand(cmd.name)} onkeydown={(e) => e.key === 'Enter' && selectCommand(cmd.name)}>
                {cmd.name} <span class="cmd-syntax">{cmd.syntax}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="minimap-info-container" style="bottom: {mapBottom}px; left: {mapLeft}px; width: {mapAnchor.width}px;">
    <div class="map-box split-box">
      <div class="map-left location-part">
        <svg class="map-icon text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        <span class="map-value">{location}</span>
      </div>
      <div class="map-separator"></div>
      <div class="map-right direction-part">
        <span class="map-value text-accent">{direction}</span>
      </div>
    </div>

    <div class="map-box split-box">
      <div class="map-left time-part">
        <span class="map-date">{serverDate}</span>
        <span class="map-value time-val">{serverTime}</span>
      </div>
      <div class="map-right icon-part bg-accent">
        <svg class="map-icon text-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>
    </div>
  </div>

  <div class="stats-container">
    <div class="stat-box compact">
      <div class="text-col align-right">
        <span class="value cash">{cashMoney}</span>
      </div>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle></svg>
    </div>

    <!-- DISABLED: Silah sistemi henüz hazır değil (S/Y/O modları ile aktif edilecek)
    <div class="stat-box compact">
      <div class="text-col align-right">
        <span class="value">{currentWeapon}</span>
      </div>
      <svg class="icon" ...></svg>
    </div>
    -->
  </div>

  {#if inVehicle}
    <div class="vehicle-container">
      <div class="stat-box speed-box">
        <span class="speed-val">{vehicleSpeed.toString().padStart(3, '0')}</span>
        <span class="speed-unit">KM/H</span>
      </div>

      <div class="vehicle-icon-bar">
        <div class="icon-btn {isEngineOn ? 'active' : 'inactive'}">
          <svg class="v-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path></svg>
        </div>
        <div class="icon-btn {isLocked ? 'danger' : 'active'}">
          <svg class="v-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <div class="icon-btn {hasSeatbelt ? 'active' : 'danger'}">
          <svg class="v-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M15 2v6h-6V2z"></path><path d="M8 14l8-8"></path></svg>
        </div>
        <div class="icon-btn fuel-btn">
          <svg class="v-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22v-8c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v8"></path><path d="M11 12v-4c0-2.2-1.8-4-4-4h0c-2.2 0-4 1.8-4 4v4"></path><path d="M15 6h4a2 2 0 0 1 2 2v6l-4 4v4"></path></svg>
          <div class="fuel-fill" style="height: {fuelLevel}%"></div>
        </div>
      </div>
    </div>
  {/if}

  <div class="watermark">santos-roleplay.com | {charName} ({playerId})</div>
</div>

<style>
  /* --- GLOBAL DEĞİŞKENLER --- */
  .hud-wrapper {
    --color-accent: #c9a84c;
    --color-bg-panel: rgba(15, 15, 22, 0.40);
    --color-bg-chat: rgba(10, 10, 18, 0.50);
    --color-border-subtle: rgba(255, 255, 255, 0.05);
    --color-text-primary: #ffffff;
    --color-text-muted: #bbbbbb;
    --backdrop: blur(14px) saturate(1.2); 
    
    position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
    pointer-events: none; font-family: 'Segoe UI', 'Inter', sans-serif; overflow: hidden;
  }

  /* --- CHATBOX --- */
  .chat-container {
    position: absolute; top: 20px; left: 20px; width: 480px;
    display: flex; flex-direction: column; gap: 8px; pointer-events: auto;
  }
  
  .chat-messages {
    max-height: 250px; overflow-y: auto; overflow-x: hidden; direction: rtl; padding-left: 6px;
  }
  .chat-messages-inner { direction: ltr; display: flex; flex-direction: column; gap: 4px; padding: 10px 0; }
  .chat-messages::-webkit-scrollbar { width: 4px; }
  .chat-messages::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); border-radius: 4px; }
  .chat-messages::-webkit-scrollbar-thumb { background: rgba(201, 168, 76, 0.4); border-radius: 4px; }

  .chat-message {
    font-size: 15px; font-weight: 700; line-height: 1.4; letter-spacing: 0.3px;
    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0px 2px 4px rgba(0,0,0,0.8);
  }
  .chat-message.rp { color: #d6a8ff; }
  .chat-message.ooc { color: #b3b3b3; }
  .chat-message.system { color: #ffeb3b; }
  .chat-message.ic { color: #ffffff; }

  /* CHAT INPUT VE GHOST TEXT YERLEŞİMİ */
  .chat-input-wrapper {
    position: relative; width: 100%;
    background: var(--color-bg-chat); backdrop-filter: var(--backdrop);
    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 2px;
  }

  .chat-input-wrapper:focus-within { border-color: rgba(201, 168, 76, 0.5); }

  .chat-input-backdrop {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    padding: 10px 14px; box-sizing: border-box;
    display: flex; pointer-events: none;
    font-size: 14px; font-weight: 600; font-family: inherit;
    white-space: pre; overflow: hidden;
  }

  .invisible-text { color: transparent; }
  .ghost-text { color: rgba(255, 255, 255, 0.35); }

  .chat-input { 
    width: 100%; padding: 10px 14px; position: relative; z-index: 2;
    background: transparent; border: none; color: #fff; 
    font-size: 14px; font-weight: 600; font-family: inherit;
    outline: none; box-sizing: border-box;
  }

  /* YATAY KOMUT ÖNERİLERİ */
  .command-row {
    position: absolute; top: 100%; left: 0; width: 100%; margin-top: 6px;
    display: flex; flex-direction: row; flex-wrap: wrap; gap: 6px; pointer-events: auto;
  }

  .cmd-box {
    padding: 6px 12px; font-size: 12px; font-weight: 700; color: #fff;
    background-color: var(--color-bg-chat); backdrop-filter: var(--backdrop);
    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px;
    cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .cmd-box:hover { filter: brightness(1.2); transform: translateY(-1px); }
  
  .cmd-syntax { color: rgba(255, 255, 255, 0.5); margin-left: 4px; font-weight: 600; }

  .cmd-box.staff { background-image: linear-gradient(135deg, rgba(239, 68, 68, 0.20) 0%, transparent 80%); border-color: rgba(239, 68, 68, 0.3); }
  .cmd-box.faction { background-image: linear-gradient(135deg, rgba(59, 130, 246, 0.20) 0%, transparent 80%); border-color: rgba(59, 130, 246, 0.3); }
  .cmd-box.player { background-image: linear-gradient(135deg, rgba(201, 168, 76, 0.15) 0%, transparent 80%); border-color: rgba(201, 168, 76, 0.3); }

  /* --- SOL ALT: RESPONSIVE MİNİMAP BİLGİ KUTULARI --- */
  .minimap-info-container {
    position: absolute; display: flex; gap: 5px; width: 288px;
  }

  .map-box {
    flex: 1; background: var(--color-bg-panel); backdrop-filter: var(--backdrop);
    border: 1px solid var(--color-border-subtle);
    border-radius: 4px 4px 0 0;
    display: flex; align-items: stretch; height: 38px; box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
  }

  .map-left { display: flex; align-items: center; justify-content: center; padding: 0 10px; }
  .map-right { display: flex; align-items: center; justify-content: center; padding: 0 10px; }
  .icon-part { border-radius: 0px 4px 0px 0px; }

  .map-separator { width: 1px; background: var(--color-border-subtle); margin: 6px 0; }

  .location-part { gap: 6px; }
  .time-part { flex-direction: column; align-items: flex-start; justify-content: center; }
  
  .bg-accent { background: var(--color-accent); }
  .text-accent { color: var(--color-accent); font-weight: 800; }
  .text-dark { color: #0a0a12; }

  .map-value { font-size: 12px; font-weight: 700; color: #fff; letter-spacing: 0.5px; }
  .time-val { font-size: 13px; font-weight: 800; line-height: 1; }
  .map-date { font-size: 9px; font-weight: 600; color: var(--color-text-muted); margin-bottom: 2px; letter-spacing: 0.5px; }
  .map-icon { width: 15px; height: 15px; }

  /* --- SAĞ ÜST & SAĞ ALT --- */
  .stats-container { position: absolute; top: 20px; right: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .stat-box.compact {
    background: var(--color-bg-panel); border: 1px solid var(--color-border-subtle);
    backdrop-filter: var(--backdrop); border-radius: 4px; padding: 8px 12px; display: flex; align-items: center; gap: 10px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); min-width: 90px;
  }
  .text-col { display: flex; flex-direction: column; justify-content: center; }
  .align-right { align-items: flex-end; justify-content: space-between; }
  .value { font-size: 12px; color: var(--color-text-primary); font-weight: 700; letter-spacing: 0.5px; }
  .value.cash { color: #86efac; font-size: 14px; }
  .icon { width: 18px; height: 18px; opacity: 0.7; color: var(--color-text-primary); }

  .vehicle-container { position: absolute; bottom: 30px; right: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  .stat-box.speed-box {
    background: var(--color-bg-panel); border: 1px solid var(--color-border-subtle);
    backdrop-filter: var(--backdrop); border-radius: 4px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    min-width: 130px; justify-content: flex-end; gap: 6px; padding: 10px 16px; display: flex; align-items: baseline;
  }
  .speed-val { font-size: 32px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; color: #fff;}
  .speed-unit { font-size: 11px; font-weight: 700; color: var(--color-accent); }

  .vehicle-icon-bar { display: flex; gap: 6px; }
  .icon-btn {
    width: 40px; height: 40px; background: var(--color-bg-panel); backdrop-filter: var(--backdrop);
    border: 1px solid var(--color-border-subtle); border-radius: 4px;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); transition: all 0.2s ease;
  }
  .v-icon { width: 18px; height: 18px; color: var(--color-text-primary); transition: color 0.2s ease; }
  .icon-btn.active .v-icon { color: var(--color-accent); }
  .icon-btn.inactive { opacity: 0.5; }
  .icon-btn.danger { border-color: rgba(239, 68, 68, 0.3); }
  .icon-btn.danger .v-icon { color: #f87171; }
  .fuel-btn { position: relative; overflow: hidden; }
  .fuel-btn .v-icon { position: relative; z-index: 2; color: #fff; }
  .fuel-fill { position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(201, 168, 76, 0.4); z-index: 1; transition: height 0.5s ease; }

  /* --- WATERMARK --- */
  .watermark {
    position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
    font-size: 11px; color: rgba(255, 255, 255, 0.4); font-weight: 500; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8); pointer-events: none;
  }
</style>