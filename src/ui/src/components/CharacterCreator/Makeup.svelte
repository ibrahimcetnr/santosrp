<script lang="ts">
  /**
   * Makeup Component - Makyaj, Allık, Ruj Ayarları
   * CharacterCreator.svelte'den ayrılmış alt component
   */
  
  // Props
  let { 
    eyeColor = $bindable(0),
    makeupStyle = $bindable(255),
    makeupColor = $bindable(0),
    makeupOpacity = $bindable(1.0),
    makeupOriginalColor = $bindable(true),
    blushStyle = $bindable(255),
    blushColor = $bindable(0),
    blushOpacity = $bindable(0.6),
    lipstickStyle = $bindable(255),
    lipstickColor = $bindable(0),
    lipstickOpacity = $bindable(1.0)
  } = $props<{
    eyeColor: number;
    makeupStyle: number;
    makeupColor: number;
    makeupOpacity: number;
    makeupOriginalColor: boolean;
    blushStyle: number;
    blushColor: number;
    blushOpacity: number;
    lipstickStyle: number;
    lipstickColor: number;
    lipstickOpacity: number;
  }>();

  const MAX_EYE_COLOR = 31;
  const MAX_MAKEUP_STYLE = 74;
  const MAX_MAKEUP_COLOR = 63;
  const MAX_BLUSH_STYLE = 6;
  const MAX_BLUSH_COLOR = 63;
  const MAX_LIPSTICK_STYLE = 9;
  const MAX_LIPSTICK_COLOR = 63;
</script>

<div class="makeup-section">
  <div class="section-header">
    <span class="section-icon">👁️</span>
    <h3>Göz Rengi</h3>
  </div>

  <div class="control-group">
    <label>Renk #{eyeColor}</label>
    <input type="range" min="0" max={MAX_EYE_COLOR} step="1" bind:value={eyeColor} />
  </div>

  <div class="section-header">
    <span class="section-icon">💄</span>
    <h3>Makyaj</h3>
  </div>

  <div class="control-group">
    <label>Stil #{makeupStyle === 255 ? 'Yok' : makeupStyle}</label>
    <input type="range" min="-1" max={MAX_MAKEUP_STYLE} step="1" 
           value={makeupStyle === 255 ? -1 : makeupStyle}
           oninput={(e) => makeupStyle = e.currentTarget.valueAsNumber === -1 ? 255 : e.currentTarget.valueAsNumber} />
  </div>

  {#if makeupStyle !== 255}
    <div class="control-group">
      <label>Renk Modu</label>
      <div class="toggle-group">
        <button 
          class:active={makeupOriginalColor}
          onclick={() => makeupOriginalColor = true}>
          Orijinal
        </button>
        <button 
          class:active={!makeupOriginalColor}
          onclick={() => makeupOriginalColor = false}>
          Renkli
        </button>
      </div>
    </div>

    {#if !makeupOriginalColor}
      <div class="control-group">
        <label>Renk #{makeupColor}</label>
        <input type="range" min="0" max={MAX_MAKEUP_COLOR} step="1" bind:value={makeupColor} />
      </div>
    {/if}

    <div class="control-group">
      <label>Opaklık ({(makeupOpacity * 100).toFixed(0)}%)</label>
      <input type="range" min="0" max="1" step="0.05" bind:value={makeupOpacity} />
    </div>
  {/if}

  <div class="section-header">
    <span class="section-icon">🌸</span>
    <h3>Allık</h3>
  </div>

  <div class="control-group">
    <label>Stil #{blushStyle === 255 ? 'Yok' : blushStyle}</label>
    <input type="range" min="-1" max={MAX_BLUSH_STYLE} step="1" 
           value={blushStyle === 255 ? -1 : blushStyle}
           oninput={(e) => blushStyle = e.currentTarget.valueAsNumber === -1 ? 255 : e.currentTarget.valueAsNumber} />
  </div>

  {#if blushStyle !== 255}
    <div class="control-group">
      <label>Renk #{blushColor}</label>
      <input type="range" min="0" max={MAX_BLUSH_COLOR} step="1" bind:value={blushColor} />
    </div>

    <div class="control-group">
      <label>Opaklık ({(blushOpacity * 100).toFixed(0)}%)</label>
      <input type="range" min="0" max="1" step="0.05" bind:value={blushOpacity} />
    </div>
  {/if}

  <div class="section-header">
    <span class="section-icon">💋</span>
    <h3>Ruj</h3>
  </div>

  <div class="control-group">
    <label>Stil #{lipstickStyle === 255 ? 'Yok' : lipstickStyle}</label>
    <input type="range" min="-1" max={MAX_LIPSTICK_STYLE} step="1" 
           value={lipstickStyle === 255 ? -1 : lipstickStyle}
           oninput={(e) => lipstickStyle = e.currentTarget.valueAsNumber === -1 ? 255 : e.currentTarget.valueAsNumber} />
  </div>

  {#if lipstickStyle !== 255}
    <div class="control-group">
      <label>Renk #{lipstickColor}</label>
      <input type="range" min="0" max={MAX_LIPSTICK_COLOR} step="1" bind:value={lipstickColor} />
    </div>

    <div class="control-group">
      <label>Opaklık ({(lipstickOpacity * 100).toFixed(0)}%)</label>
      <input type="range" min="0" max="1" step="0.05" bind:value={lipstickOpacity} />
    </div>
  {/if}
</div>

<style>
  .makeup-section {
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
    margin-top: 12px;
  }

  .section-header:first-child {
    margin-top: 0;
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

  .toggle-group {
    display: flex;
    gap: 8px;
  }

  .toggle-group button {
    flex: 1;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-group button:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .toggle-group button.active {
    background: rgba(201, 168, 76, 0.2);
    border-color: #c9a84c;
    color: #c9a84c;
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
