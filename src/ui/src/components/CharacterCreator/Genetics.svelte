<script lang="ts">
  /**
   * Genetics Component - Anne/Baba Genetiği & Karışım Oranları
   * CharacterCreator.svelte'den ayrılmış alt component
   */
  
  // Props
  let { 
    gender,
    mother = $bindable(0), 
    father = $bindable(0), 
    shapeMix = $bindable(0.5), 
    skinMix = $bindable(0.5) 
  } = $props<{
    gender: number;
    mother: number;
    father: number;
    shapeMix: number;
    skinMix: number;
  }>();

  // Anne/Baba görsel ID'leri (0-45)
  const MAX_PARENT_ID = 45;
</script>

<div class="genetics-section">
  <div class="section-header">
    <span class="section-icon">👨‍👩‍👦</span>
    <h3>Ebeveyn Seçimi</h3>
  </div>

  <div class="control-group">
    <label>Anne (Yüz #{mother})</label>
    <input type="range" min="0" max={MAX_PARENT_ID} step="1" bind:value={mother} />
  </div>

  <div class="control-group">
    <label>Baba (Yüz #{father})</label>
    <input type="range" min="0" max={MAX_PARENT_ID} step="1" bind:value={father} />
  </div>

  <div class="section-header">
    <span class="section-icon">🎭</span>
    <h3>Genetik Karışım</h3>
  </div>

  <div class="control-group">
    <label>Yüz Şekli Karışımı ({(shapeMix * 100).toFixed(0)}%)</label>
    <div class="mix-labels">
      <span class="label-left">Anne</span>
      <span class="label-right">Baba</span>
    </div>
    <input type="range" min="0" max="1" step="0.01" bind:value={shapeMix} />
  </div>

  <div class="control-group">
    <label>Cilt Rengi Karışımı ({(skinMix * 100).toFixed(0)}%)</label>
    <div class="mix-labels">
      <span class="label-left">Anne</span>
      <span class="label-right">Baba</span>
    </div>
    <input type="range" min="0" max="1" step="0.01" bind:value={skinMix} />
  </div>
</div>

<style>
  .genetics-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .section-icon {
    font-size: 20px;
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #c9a84c;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
  }

  .mix-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  input[type="range"] {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: #c9a84c;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.2s;
  }

  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
</style>
