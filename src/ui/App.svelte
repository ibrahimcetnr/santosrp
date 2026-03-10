<script lang="ts">
  import { onMount } from 'svelte';
  import CharacterSelect from './src/components/CharacterSelect.svelte';
  import CharacterCreator from './src/components/CharacterCreator.svelte';
  import HUD from './src/components/HUD/HUD.svelte';
  import FactionPanel from './src/components/FactionPanel.svelte';

  let username = $state('');
  let password = $state('');
  let errorMessage = $state('');
  let isLoading = $state(false);
  let view = $state<'login' | 'characterSelect' | 'characterCreator' | 'playing'>('login');
  let userCharacters = $state<any[]>([]);
  let pendingCharacterId = $state<number>(0);
  let pendingGender = $state<number>(0);
  let pendingCharData = $state<string | null>(null);
  let myAdminLevel = $state(0);
  let commandList = $state<any[]>([]);
  let passwordInput: HTMLInputElement;
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
        view = 'characterSelect';
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

  onMount(() => {
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
      
      // Parse characters
      try {
        userCharacters = typeof charactersJson === 'string' ? JSON.parse(charactersJson) : charactersJson;
      } catch {
        userCharacters = charactersJson as any;
      }
      
      view = 'characterSelect';
    };

    window.openFactionUI = (dataJson: string) => {
      try {
        currentFactionData = JSON.parse(dataJson);
      } catch {
        currentFactionData = null;
      }
      isFactionPanelOpen = true;
    };

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
    view = 'characterSelect';
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger('client:cancelCreator');
    }
  }

  function onPlay(char: any) {
    if (char && char.created === 0) {
      pendingCharacterId = char.id;
      pendingGender = char.gender ?? 0;
      pendingCharData = char.charData ?? null;
      view = 'characterCreator';
      if (typeof (window as any).mp !== 'undefined') {
        (window as any).mp.trigger('client:startCharacterCreator', char.id, char.gender ?? 0, char.charData ?? null);
      }
    } else {
      view = 'playing';
    }
  }
</script>

{#if view === 'login'}
  <main class:fade-out={view !== 'login'}>
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
          <span class="error-icon">⚠</span>
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
{:else if view === 'characterSelect'}
  <CharacterSelect {onPlay} characters={userCharacters} />
{:else if view === 'characterCreator'}
  <CharacterCreator characterId={pendingCharacterId} gender={pendingGender} charData={pendingCharData} onCancel={onCancelCreator} />
{:else if view === 'playing'}
  <HUD {myAdminLevel} commands={commandList} />
  {#if isFactionPanelOpen && currentFactionData}
    <FactionPanel factionData={currentFactionData} onClose={closeFactionUI} onInviteMember={inviteMemberUI} />
  {/if}
{/if}

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
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
