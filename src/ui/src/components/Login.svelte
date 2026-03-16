<script lang="ts">
  import { activeScreen } from '../store';
  import { onMount, onDestroy } from 'svelte';

  let username = '';
  let password = '';
  let errorMessage = '';
  let isLoading = false;
  let rememberMe = false;

  function triggerLogin() {
    if (!username.trim() || !password.trim()) {
      errorMessage = 'Kullanıcı adı ve şifre boş olamaz.';
      return;
    }
    isLoading = true;
    errorMessage = '';
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger('client:auth:tryLogin', username, password, rememberMe);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') triggerLogin();
  }

  onMount(() => {
    (window as any).setSavedCredentials = (user: string, pass: string) => {
      username = user;
      password = pass;
      rememberMe = true;
    };
    (window as any).onLoginError = (msg: string) => {
      isLoading = false;
      errorMessage = msg;
    };
    
    // Add global keydown listener
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    delete (window as any).setSavedCredentials;
    delete (window as any).onLoginError;
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="login-container">
  <div class="login-box">
    <h1>Santos Roleplay</h1>
    <p class="subtitle">Hoşgeldiniz, lütfen giriş yapın veya kayıt olun.</p>

    <!-- Error Message -->
    {#if errorMessage}
      <div class="error-alert">{errorMessage}</div>
    {/if}

    <div class="inputs">
      <input type="text" placeholder="Kullanıcı Adı" bind:value={username} disabled={isLoading} />
      <input type="password" placeholder="Şifre" bind:value={password} disabled={isLoading} />
      
      <label class="remember-label">
        <input type="checkbox" bind:checked={rememberMe} disabled={isLoading} />
        Beni Hatırla
      </label>
    </div>

    <div class="buttons">
      <button class="btn-login" onclick={triggerLogin} disabled={isLoading}>
        {#if isLoading} Giriş yapılıyor... {:else} Giriş Yap {/if}
      </button>
      <button class="btn-register" onclick={() => {
        if (typeof (window as any).mp !== 'undefined') {
          (window as any).mp.trigger('client:auth:tryRegister', username, password);
        }
      }} disabled={isLoading}>Kayıt Ol</button>
    </div>
  </div>
</div>

<style>
  .login-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
  }
  .login-box {
    background: var(--bg-panel);
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    width: 400px;
    text-align: center;
    border: 1px solid var(--border-subtle);
  }
  h1 { margin-bottom: 5px; color: var(--text-main); font-weight: 700; font-size: 28px; }
  .subtitle { color: var(--text-muted); font-size: 14px; margin-bottom: 25px; }
  .error-alert {
    background: rgba(239, 68, 68, 0.1);
    color: var(--text-danger);
    padding: 10px;
    border-radius: 6px;
    margin-bottom: 20px;
    font-size: 13px;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .inputs { display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px; }
  input[type="text"], input[type="password"] {
    background: rgba(0,0,0,0.5);
    border: 1px solid var(--border-subtle);
    padding: 12px 15px;
    border-radius: 8px;
    color: var(--text-main);
    font-size: 14px;
    transition: all 0.2s;
  }
  input[type="text"]:focus, input[type="password"]:focus {
    outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .remember-label {
    display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); cursor: pointer; text-align: left;
  }
  .buttons { display: flex; gap: 15px; }
  button {
    flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s;
  }
  .btn-login { background: var(--color-primary); color: var(--text-main); }
  .btn-login:hover:not(:disabled) { filter: brightness(1.1); }
  .btn-login:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-register { background: transparent; border: 1px solid var(--color-primary); color: var(--color-primary); }
  .btn-register:hover:not(:disabled) { background: rgba(59, 130, 246, 0.1); }
  .btn-register:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
