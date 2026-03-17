<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    activeScreen,
    playerMoney,
    charName,
    playerId,
    locationName,
    directionName,
    minimapBottom,
    minimapLeft,
    minimapWidth,
    inVehicle,
    vehicleSpeed,
    vehicleFuel,
    vehicleEngineOn,
    vehicleLocked,
    vehicleSeatbelt,
    vehicleLightsOn,
    vehicleParkingBrakeOn,
    isInventoryOpen,
    inventoryPayload,
    inventoryNearbyPlayers
  } from './src/store';
  import CharacterSelect from './src/components/CharacterSelect.svelte';
  import CharacterCreator from './src/components/CharacterCreator.svelte';
  import HUD from './src/components/HUD/HUD.svelte';
  import FactionPanel from './src/components/FactionPanel.svelte';
  import OfferModal from './src/components/OfferModal.svelte';
  import Inventory from './src/components/Inventory.svelte';
  import Icon from './src/components/Icon.svelte';

  let username = $state('');
  let password = $state('');
  let errorMessage = $state('');
  let isLoading = $state(false);
  
  let userCharacters = $state<any[]>([]);
  let pendingCharacterId = $state<number>(0);
  let pendingGender = $state<number>(0);
  let pendingCharData = $state<string | null>(null);
  let myAdminLevel = $state(0);
  let commandList = $state<any[]>([]);
  let passwordInput: HTMLInputElement | undefined = $state();
  let rememberMe = $state(false);
  let isFactionPanelOpen = $state(false);
  let currentFactionData = $state<any>(null);

  function triggerLogin() {
    if (!username.trim() || !password.trim()) {
      errorMessage = 'Kullanıcı adı ve şifre boş olamaz.';
      return;
    }

    errorMessage = '';
    isLoading = true;

    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger('server:tryLogin', username.trim().toLowerCase(), password, rememberMe);
    } else {
      // Dev mode - simulate login with adminLevel 10
      setTimeout(() => {
        isLoading = false;
        myAdminLevel = 10;
        $activeScreen = 'characterSelect';
      }, 1000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') triggerLogin();
    if (e.key === 'Tab' && (e.target as HTMLElement).id === 'username') {
      e.preventDefault();
      passwordInput.focus();
    }
  }

  function parseMoney(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const numeric = Number(String(value ?? '0').replace(/[^0-9-]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function safeParseJson<T>(input: unknown, fallback: T): T {
    if (typeof input !== 'string') {
      return (input as T) ?? fallback;
    }

    try {
      return JSON.parse(input) as T;
    } catch (error) {
      console.error('[APP] JSON parse hatası:', error);
      return fallback;
    }
  }

  onMount(() => {
    window.forceScreen = (screen: string) => {
      $activeScreen = screen;
    };

    window.hudInit = (data: { charName: string; playerId: number; money: string | number }) => {
      charName.set(data?.charName ?? 'Oyuncu');
      playerId.set(Number(data?.playerId) || 0);
      playerMoney.set(parseMoney(data?.money));
    };

    window.hudUpdateMoney = (data: { money: string | number }) => {
      playerMoney.set(parseMoney(data?.money));
    };

    window.hudUpdateLocation = (data: { location: string; direction: string }) => {
      if (data?.location) locationName.set(data.location);
      if (data?.direction) directionName.set(data.direction);
    };

    window.syncMinimapData = (bottom: number, left: number, width: number) => {
      if (typeof bottom === 'number') minimapBottom.set(bottom);
      if (typeof left === 'number') minimapLeft.set(left);
      if (typeof width === 'number') minimapWidth.set(width);
    };

    window.syncMinimap = (anchor: { bottom?: number; left?: number; width?: number }) => {
      if (typeof anchor?.bottom === 'number') minimapBottom.set(anchor.bottom);
      if (typeof anchor?.left === 'number') minimapLeft.set(anchor.left);
      if (typeof anchor?.width === 'number') minimapWidth.set(anchor.width);
    };

    window.hudUpdateMapPosition = (data: { bottom: number; left: number }) => {
      if (typeof data?.bottom === 'number') minimapBottom.set(data.bottom);
      if (typeof data?.left === 'number') minimapLeft.set(data.left);
    };

    let lastVehicleUpdate = 0;

    window.chv = (data: {
      inVehicle?: boolean;
      speed?: number;
      fuel?: number;
      f?: number;
      lightsOn?: boolean;
      parkingBrakeOn?: boolean;
    }) => {
      const hasDiscreteFlags =
        data.inVehicle !== undefined ||
        data.f !== undefined ||
        typeof data.lightsOn === 'boolean' ||
        typeof data.parkingBrakeOn === 'boolean';

      const now = Date.now();
      const canProcessContinuous = now - lastVehicleUpdate >= 50;
      if (canProcessContinuous) {
        lastVehicleUpdate = now;
      }

      if (data.inVehicle !== undefined) inVehicle.set(data.inVehicle);
      if (canProcessContinuous || hasDiscreteFlags) {
        if (typeof data.speed === 'number') vehicleSpeed.set(data.speed);
        if (typeof data.fuel === 'number') vehicleFuel.set(data.fuel);
      }
      if (typeof data.f === 'number') {
        vehicleEngineOn.set((data.f & 1) !== 0);
        vehicleLocked.set((data.f & 2) !== 0);
        vehicleSeatbelt.set((data.f & 4) !== 0);
      }
      if (typeof data.lightsOn === 'boolean') vehicleLightsOn.set(data.lightsOn);
      if (typeof data.parkingBrakeOn === 'boolean') vehicleParkingBrakeOn.set(data.parkingBrakeOn);
    };

    window.openInventory = (payloadInput: string | object) => {
      const payload = safeParseJson<any | null>(payloadInput, null);
      if (!payload) return;
      inventoryPayload.set(payload);
      inventoryNearbyPlayers.set([]);
      isInventoryOpen.set(true);
    };

    window.closeInventory = () => {
      isInventoryOpen.set(false);
      inventoryNearbyPlayers.set([]);
    };

    window.setInventoryNearbyPlayers = (payloadInput: string | Array<{ id: number; name: string }>) => {
      const payload = safeParseJson<Array<{ id: number; name: string }> | null>(payloadInput, null);
      if (!Array.isArray(payload)) {
        inventoryNearbyPlayers.set([]);
        return;
      }

      inventoryNearbyPlayers.set(
        payload
          .filter((entry) => Number.isInteger(entry?.id) && Number(entry.id) > 0 && typeof entry?.name === 'string')
          .map((entry) => ({ id: Number(entry.id), name: entry.name }))
      );
    };

    window.setSavedCredentials = (user: string, pass: string) => {
      username = user;
      password = pass;
      rememberMe = true;
    };

    window.onLoginError = (msg: string) => {
      isLoading = false;
      errorMessage = msg;
      const box = document.querySelector('.login-box') as HTMLElement;
      if (box) {
        box.classList.add('shake');
        setTimeout(() => box.classList.remove('shake'), 500);
      }
    };

    window.onLoginSuccess = (_username: string, adminLevel: number, charactersJson: string) => {
      isLoading = false;
      myAdminLevel = adminLevel;
      userCharacters = safeParseJson<any[]>(charactersJson, []);
      
      $activeScreen = 'characterSelect';
    };

    window.openFactionUI = (dataJson: string) => {
      currentFactionData = safeParseJson<any | null>(dataJson, null);
      if (!currentFactionData) return;
      isFactionPanelOpen = true;
    };

    window.patchFactionUI = (patchJson: string) => {
      if (!isFactionPanelOpen || !currentFactionData) return;
      const patch = safeParseJson<Record<string, unknown> | null>(patchJson, null);
      if (!patch) return;
      currentFactionData = { ...currentFactionData, ...patch };
    };

    // Client'tan F3 toggle ile kapatılabilmesi için global köprü
    window.closeFactionUI = closeFactionUI;

    // Komut listesini kaydet
    window.updateCommandList = (commands: any[]) => {
      commandList = commands;
      console.log(`[APP] ${commands.length} komut alındı (adminLevel: ${myAdminLevel})`);
    };
  });

  function closeFactionUI() {
    isFactionPanelOpen = false;
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger('client:closeFactionUI');
    }
  }

  function inviteMemberUI() {
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger('client:factionInviteClick');
    }
  }

  function onCancelCreator() {
    $activeScreen = 'characterSelect';
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger('client:cancelCreator');
    }
  }

  function onPlay(char: any) {
    if (char && char.created === 0) {
      pendingCharacterId = char.id;
      pendingGender = char.gender ?? 0;
      pendingCharData = char.charData ?? null;
      $activeScreen = 'characterCreator';
      if (typeof (window as any).mp !== 'undefined') {
        (window as any).mp.trigger('client:startCharacterCreator', char.id, char.gender ?? 0, char.charData ?? null);
      }
    } else {
      $activeScreen = 'playing';
    }
  }

  onDestroy(() => {
    delete (window as any).forceScreen;
    delete (window as any).hudInit;
    delete (window as any).hudUpdateMoney;
    delete (window as any).hudUpdateLocation;
    delete (window as any).syncMinimapData;
    delete (window as any).syncMinimap;
    delete (window as any).hudUpdateMapPosition;
    delete (window as any).chv;
    delete (window as any).openInventory;
    delete (window as any).closeInventory;
    delete (window as any).setInventoryNearbyPlayers;
    delete (window as any).setSavedCredentials;
    delete (window as any).onLoginError;
    delete (window as any).onLoginSuccess;
    delete (window as any).openFactionUI;
    delete (window as any).patchFactionUI;
    delete (window as any).closeFactionUI;
    delete (window as any).updateCommandList;
  });
</script>

{#if $activeScreen === 'login'}
  <main class:fade-out={$activeScreen !== 'login'}>
    <div class="login-box">
      <!-- Logo / Başlık -->
      <div class="logo-area">
        <div class="logo-icon">S</div>
        <h1 class="logo-title">Santos<span class="logo-accent">RP</span></h1>
        <p class="logo-sub">Los Santos Roleplay Sunucusu</p>
      </div>

      <!-- Form -->
      <div class="form-group">
        <label for="username">KULLANICI ADI</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          onkeydown={handleKeydown}
          placeholder="Kullanıcı adınızı girin"
          autocomplete="off"
          spellcheck="false"
          disabled={isLoading}
        />
      </div>

      <div class="form-group">
        <label for="password">ŞİFRE</label>
        <input
          id="password"
          type="password"
          bind:this={passwordInput}
          bind:value={password}
          onkeydown={handleKeydown}
          placeholder="Şifrenizi girin"
          autocomplete="off"
          disabled={isLoading}
        />
      </div>

      <div class="form-group remember-me-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={rememberMe} disabled={isLoading} />
          Beni Hatırla
        </label>
      </div>

      <!-- Hata mesajı -->
      {#if errorMessage}
        <div class="error-message">
          <span class="error-icon"><Icon name="warning" size="16px" color="#f87171" /></span>
          {errorMessage}
        </div>
      {/if}

      <!-- Giriş Butonu -->
      <button
        class="login-btn"
        class:loading={isLoading}
        onclick={triggerLogin}
        disabled={isLoading}
      >
        {#if isLoading}
          <span class="spinner"></span>
          Doğrulanıyor...
        {:else}
          GİRİŞ YAP
        {/if}
      </button>

      <p class="info-text">Hesap oluşturmak için web panelini ziyaret edin.</p>
    </div>
  </main>
{:else if $activeScreen === 'characterSelect'}
  <CharacterSelect {onPlay} characters={userCharacters} />
{:else if $activeScreen === 'characterCreator'}
  <CharacterCreator characterId={pendingCharacterId} gender={pendingGender} charData={pendingCharData} onCancel={onCancelCreator} />
{:else if $activeScreen === 'playing'}
  <HUD {myAdminLevel} commands={commandList} />
  <OfferModal />
  <Inventory />
  {#if isFactionPanelOpen && currentFactionData}
    <FactionPanel factionData={currentFactionData} onClose={closeFactionUI} onInviteMember={inviteMemberUI} />
  {/if}
{/if}

<style>
  :global(:root) {
    --bg-primary: #0a0a0a;
    --bg-secondary: #141414;
    --bg-panel: rgba(15, 23, 42, 0.95);
    --bg-modal: #0e0e16;
    
    --text-main: #ffffff;
    --text-muted: #94a3b8;
    --text-dark: #64748b;
    --text-danger: #ef4444;
    --text-success: #10b981;

    --accent-color: #3b82f6;
    --accent-glow: rgba(59, 130, 246, 0.3);
    
    --color-primary: #3b82f6;
    --color-secondary: #c9a84c; /* Goldish for CC */
    --color-secondary-hover: #e2c05a;
    --color-danger: #ef4444;
    --color-danger-hover: #f87171;
    --color-success: #10b981;
    --color-success-hover: #34d399;
    
    --border-subtle: rgba(255, 255, 255, 0.1);
    
    --font-primary: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: var(--font-primary);
  }

  :global(*, *::before, *::after) {
    animation: none !important;
    transition: none !important;
  }

  :global(body) {
    background: transparent;
  }

  main {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
    transition: opacity 0.8s ease;
  }

  main.fade-out {
    opacity: 0;
    pointer-events: none;
  }

  .login-box {
    width: 380px;
    padding: 40px 36px 32px;
    background: rgba(10, 10, 18, 0.90);
    backdrop-filter: blur(8px) saturate(1.2);
    -webkit-backdrop-filter: blur(8px) saturate(1.2);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    box-shadow:
      0 8px 40px rgba(0, 0, 0, 0.6),
      0 1px 0 rgba(255, 255, 255, 0.05) inset;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* Titreme animasyonu */
  :global(.login-box.shake) {
    animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
  @keyframes shake {
    10%, 90%  { transform: translateX(-3px); }
    20%, 80%  { transform: translateX(4px);  }
    30%, 50%, 70% { transform: translateX(-5px); }
    40%, 60%  { transform: translateX(5px);  }
  }

  /* Logo */
  .logo-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .logo-icon {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, #c9a84c 0%, #e8c96a 50%, #b8912e 100%);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    font-weight: 900;
    color: #0a0a12;
    box-shadow: 0 4px 20px rgba(201, 168, 76, 0.35);
    margin-bottom: 4px;
  }

  .logo-title {
    font-size: 28px;
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    letter-spacing: 0.5px;
  }

  .logo-accent {
    color: #c9a84c;
  }

  .logo-sub {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  /* Form */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .form-group label {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 1.8px;
    text-transform: uppercase;
  }

  .form-group input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 11px 14px;
    font-size: 14px;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    outline: none;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease;
    font-family: inherit;
  }

  .form-group input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .form-group input:focus {
    border-color: rgba(201, 168, 76, 0.6);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.1);
  }

  .form-group input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Remember Me */
  .remember-me-group {
    flex-direction: row;
    align-items: center;
    margin-top: -2px;
    margin-bottom: 2px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6) !important;
    text-transform: none !important;
    letter-spacing: normal !important;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    appearance: none;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    width: 16px;
    height: 16px;
    padding: 0;
    margin: 0;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .checkbox-label input[type="checkbox"]:checked {
    background: #c9a84c;
    border-color: #c9a84c;
  }

  .checkbox-label input[type="checkbox"]:checked::after {
    content: '';
    width: 4px;
    height: 8px;
    border: solid #0a0a12;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    position: absolute;
    top: 2px;
  }

  .checkbox-label input[type="checkbox"]:hover {
    border-color: rgba(201, 168, 76, 0.6);
  }

  /* Hata */
  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    color: #f87171;
    line-height: 1.4;
  }

  .error-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  /* Buton */
  .login-btn {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #c9a84c 0%, #e8c96a 100%);
    border: none;
    border-radius: 9px;
    color: #0a0a12;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 2px;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      box-shadow 0.2s ease,
      opacity 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 4px;
    font-family: inherit;
    box-shadow: 0 4px 18px rgba(201, 168, 76, 0.3);
  }

  .login-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(201, 168, 76, 0.45);
  }

  .login-btn:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 10px rgba(201, 168, 76, 0.25);
  }

  .login-btn:disabled,
  .login-btn.loading {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  /* Spinner */
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(10, 10, 18, 0.3);
    border-top-color: #0a0a12;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Alt bilgi */
  .info-text {
    font-size: 10.5px;
    color: rgba(255, 255, 255, 0.2);
    text-align: center;
    line-height: 1.5;
  }
</style>
