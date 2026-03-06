<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onPlay: (char: any) => void;
    characters?: any[];
  }

  let { onPlay, characters = [] }: Props = $props();

  // 3 slota tamamla
  let displayChars = $derived.by(() => {
    const arr = [...characters];
    while (arr.length < 3) {
      arr.push({
        id: -1,
        name: 'Boş Slot',
        age: 0,
        model: 'mp_m_freemode_01',
        created: 0
      });
    }
    return arr;
  });

  let currentIndex = $state(0);

  let currentChar = $derived(displayChars[currentIndex]);

  function nextChar() {
    currentIndex = (currentIndex + 1) % displayChars.length;
    updatePed();
  }

  function prevChar() {
    currentIndex = (currentIndex - 1 + displayChars.length) % displayChars.length;
    updatePed();
  }

  function updatePed() {
    const c = displayChars[currentIndex];
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger('client:previewCharacter', c.model, (c as any).charData ?? null);
    }
  }

  function handlePlay() {
    if (currentChar.created === 0) {
      onPlay(currentChar);
      return;
    }
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger('client:playCharacter', displayChars[currentIndex].id);
    }
    onPlay(currentChar);
  }

  onMount(() => {
    updatePed();
  });
</script>

<div class="char-container">
  <!-- Sol Ok -->
  <button class="nav-btn left" onclick={prevChar}>&#10094;</button>

  <!-- Ortadaki Bilgi ve Hover Kutusu -->
  <div class="char-info">
    <h2>{currentChar.name.replace(/_/g, ' ')}</h2>
    
    <div class="glow-box"></div>
    <button class="play-btn" onclick={handlePlay}>{currentChar.created === 0 ? 'YARAT' : 'OYNA'}</button>
  </div>

  <!-- Sağ Ok -->
  <button class="nav-btn right" onclick={nextChar}>&#10095;</button>
</div>

<style>
  .char-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 10vw;
    pointer-events: none; /* Arkaplan tıklamalarını kapat */
  }

  .nav-btn {
    pointer-events: auto;
    background: rgba(10, 10, 18, 0.8);
    color: #fff;
    border: 2px solid rgba(201, 168, 76, 0.5);
    border-radius: 50%;
    width: 60px;
    height: 60px;
    font-size: 24px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 0 15px rgba(201, 168, 76, 0.2);
  }

  .nav-btn:hover {
    background: rgba(201, 168, 76, 0.8);
    transform: scale(1.1);
    box-shadow: 0 0 25px rgba(201, 168, 76, 0.6);
  }

  .char-info {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 70vh;
    position: relative;
  }

  /* Karakter üstüne gelince gösterilecek glow efekti için ekranın ortasında görünmez div */
  .glow-box {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -60%);
    width: 500px;
    height: 800px;
    background: radial-gradient(ellipse at center, rgba(201, 168, 76, 0.3) 0%, transparent 60%);
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.4s ease;
    cursor: crosshair;
    z-index: 1;
  }
  
  .glow-box:hover {
    opacity: 1;
  }

  .char-info h2 {
    color: #fff;
    font-size: 36px;
    text-shadow: 0 2px 5px rgba(0,0,0,1);
    margin-bottom: 5px;
    z-index: 10;
  }

  .char-info p {
    color: #ccc;
    font-size: 18px;
    text-shadow: 0 2px 4px rgba(0,0,0,1);
    margin-bottom: 20px;
    z-index: 10;
  }

  .play-btn {
    z-index: 10;
    padding: 15px 50px;
    background: linear-gradient(135deg, #c9a84c 0%, #e8c96a 100%);
    border: none;
    border-radius: 9px;
    color: #0a0a12;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(201, 168, 76, 0.3);
    transition: transform 0.2s;
  }

  .play-btn:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 24px rgba(201, 168, 76, 0.6);
  }
</style>
