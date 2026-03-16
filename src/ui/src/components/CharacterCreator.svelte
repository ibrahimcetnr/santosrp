<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let { characterId, gender: genderProp = 0, onCancel, charData = null } = $props<{ characterId: number; gender?: number; onCancel?: () => void; charData?: string | null }>();

  let showConfirm = $state(false);
  let showFaceCode = $state(false);
  let faceCodeTab = $state<'export' | 'import' | 'menyoo'>('export');
  let importInput = $state('');
  let importError = $state('');
  let copied = $state(false);
  let copiedMenyoo = $state(false);

  const TABS = [
    { id: 'genetics', icon: '🧬', label: 'Genetik' },
    { id: 'features', icon: '😶', label: 'Yüz Hatları' },
    { id: 'hair',     icon: '💇', label: 'Saç & Kıllar' },
    { id: 'skin',     icon: '🧴', label: 'Cilt & Doku' },
    { id: 'makeup',   icon: '💄', label: 'Makyaj & Göz' },
  ];

  let activeTab = $state('genetics');

  // ── Genetik ──────────────────────────────────────
  // Cinsiyet DB'den gelir, değiştirilemez
  const gender = $derived(genderProp);
  let mother    = $state(0);
  let father    = $state(0);
  let shapeMix  = $state(0.5);
  let skinMix   = $state(0.5);

  // ── Yüz Hatları ──────────────────────────────────
  let features = $state(Array(20).fill(0.0));
  const featureNames = [
    'Burun Genişliği','Burun Yüksekliği','Burun Uzunluğu','Burun Eğriliği','Burun Ucu Açısı',
    'Burun Çarpıklığı','Kaş Yüksekliği','Kaş Derinliği','Elmacık Yüksekliği','Elmacık Genişliği',
    'Yanak Genişliği','Göz Açıklığı','Dudak Kalınlığı','Çene Genişliği','Çene Uzunluğu',
    'Çene Pozisyonu','Çene Profili','Çene Şekli','Çene Ucu','Boyun Kalınlığı'
  ];

  // ── Saç & Kıllar ─────────────────────────────────
  let hairStyle       = $state(0);
  let hairColor       = $state(0);
  let hairHighlight   = $state(0);

  let eyebrowStyle    = $state(0);
  let eyebrowColor    = $state(0);
  let eyebrowOpacity  = $state(1.0);

  let facialHairStyle   = $state(255);
  let facialHairColor   = $state(0);
  let facialHairOpacity = $state(1.0);

  let chestHairStyle   = $state(255);
  let chestHairColor   = $state(0);
  let chestHairOpacity = $state(1.0);

  // ── Cilt & Doku ───────────────────────────────────
  let blemishStyle   = $state(255);
  let blemishOpacity = $state(1.0);

  let ageingStyle    = $state(255);
  let ageingOpacity  = $state(0.8);

  let molesStyle     = $state(255);
  let molesOpacity   = $state(1.0);

  let complexionStyle   = $state(255);
  let complexionOpacity = $state(1.0);

  let sunDamageStyle    = $state(255);
  let sunDamageOpacity  = $state(1.0);

  // ── Makyaj & Göz ─────────────────────────────────
  let eyeColor = $state(0);

  let makeupStyle         = $state(255);
  let makeupColor         = $state(0);
  let makeupOpacity       = $state(1.0);
  /** true → colorType 0 (renk basma / orijinal), false → colorType 2 (renkli) */
  let makeupOriginalColor = $state(true);

  let blushStyle    = $state(255);
  let blushColor    = $state(0);
  let blushOpacity  = $state(0.6);

  let lipstickStyle   = $state(255);
  let lipstickColor   = $state(0);
  let lipstickOpacity = $state(1.0);

  // ── Canlı önizleme: her state değişince RAGE'e gönder (Debounced) ────
  function buildPayload() {
    return JSON.stringify({
      gender, mother, father, shapeMix, skinMix, features,
      hairStyle, hairColor, hairHighlight,
      eyebrowStyle, eyebrowColor, eyebrowOpacity,
      facialHairStyle, facialHairColor, facialHairOpacity,
      chestHairStyle, chestHairColor, chestHairOpacity,
      blemishStyle, blemishOpacity,
      ageingStyle, ageingOpacity,
      molesStyle, molesOpacity,
      complexionStyle, complexionOpacity,
      sunDamageStyle, sunDamageOpacity,
      eyeColor,
      makeupStyle, makeupColor, makeupOpacity,
      makeupColorType: makeupOriginalColor ? 0 : 2,
      blushStyle, blushColor, blushOpacity,
      lipstickStyle, lipstickColor, lipstickOpacity,
    });
  }

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const DEBOUNCE_DELAY = 50; // 50ms debounce

  $effect(() => {
    const payload = buildPayload();
    
    if (debounceTimer) clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
      window.mp?.trigger('client:updateCreatorAppearance', payload);
    }, DEBOUNCE_DELAY);
  });

  // ── Kamera klavye kontrolü ────────────────────────
  let keys = { w: false, a: false, s: false, d: false };

  function handleKeydown(e: KeyboardEvent) {
    // Ctrl+A seçimini engelle
    if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); return; }
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    if (e.target instanceof HTMLSelectElement) return;
    const key = e.key.toLowerCase();
    if (key in keys) keys[key as keyof typeof keys] = true;
  }
  function handleKeyup(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    if (key in keys) keys[key as keyof typeof keys] = false;
  }
  function handleWheel(e: WheelEvent) {
    const target = e.target as HTMLElement;
    const isInsideContent = target.closest('.content');
    if (!isInsideContent) {
      e.preventDefault();
      window.mp?.trigger('client:creatorControl', 'zoom', e.deltaY > 0 ? 0.06 : -0.06);
    }
  }

  function handleCancel() {
    showConfirm = false;
    window.mp?.trigger('client:cancelCreator');
    onCancel?.();
  }

  let raf: number;
  function gameLoop() {
    if (window.mp) {
      if (keys.a) window.mp.trigger('client:creatorControl', 'rotate',  1.8);
      if (keys.d) window.mp.trigger('client:creatorControl', 'rotate', -1.8);
      if (keys.w) window.mp.trigger('client:creatorControl', 'height',  0.01);
      if (keys.s) window.mp.trigger('client:creatorControl', 'height', -0.01);
    }
    raf = requestAnimationFrame(gameLoop);
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keyup', handleKeyup);
    window.addEventListener('wheel', handleWheel, { passive: false });
    raf = requestAnimationFrame(gameLoop);
    if (charData) loadFromData(charData);
  });
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('keyup', handleKeyup);
    window.removeEventListener('wheel', handleWheel);
    cancelAnimationFrame(raf);
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  function handleSave() {
    window.mp?.trigger('client:finishCharacterCreator', characterId, buildPayload());
  }

  function resetAll() {
    mother = 0; father = 0; shapeMix = 0.5; skinMix = 0.5;
    features = Array(20).fill(0.0);
    hairStyle = 0; hairColor = 0; hairHighlight = 0;
    eyebrowStyle = 0; eyebrowColor = 0; eyebrowOpacity = 1.0;
    facialHairStyle = 255; facialHairColor = 0; facialHairOpacity = 1.0;
    chestHairStyle = 255; chestHairColor = 0; chestHairOpacity = 1.0;
    blemishStyle = 255; blemishOpacity = 1.0;
    ageingStyle = 255; ageingOpacity = 0.8;
    molesStyle = 255; molesOpacity = 1.0;
    complexionStyle = 255; complexionOpacity = 1.0;
    sunDamageStyle = 255; sunDamageOpacity = 1.0;
    eyeColor = 0;
    makeupStyle = 255; makeupColor = 0; makeupOpacity = 1.0;
    makeupOriginalColor = true;
    blushStyle = 255; blushColor = 0; blushOpacity = 0.6;
    lipstickStyle = 255; lipstickColor = 0; lipstickOpacity = 1.0;
  }

  function loadFromData(json: string) {
    try {
      const d = JSON.parse(json);
      if (d.mother !== undefined) mother = d.mother;
      if (d.father !== undefined) father = d.father;
      if (d.shapeMix !== undefined) shapeMix = d.shapeMix;
      if (d.skinMix !== undefined) skinMix = d.skinMix;
      if (Array.isArray(d.features)) features = Array.from({ length: 20 }, (_, i) => d.features[i] !== undefined ? d.features[i] : 0.0);
      if (d.hairStyle !== undefined) hairStyle = d.hairStyle;
      if (d.hairColor !== undefined) hairColor = d.hairColor;
      if (d.hairHighlight !== undefined) hairHighlight = d.hairHighlight;
      if (d.eyebrowStyle !== undefined) eyebrowStyle = d.eyebrowStyle;
      if (d.eyebrowColor !== undefined) eyebrowColor = d.eyebrowColor;
      if (d.eyebrowOpacity !== undefined) eyebrowOpacity = d.eyebrowOpacity;
      if (d.facialHairStyle !== undefined) facialHairStyle = d.facialHairStyle;
      if (d.facialHairColor !== undefined) facialHairColor = d.facialHairColor;
      if (d.facialHairOpacity !== undefined) facialHairOpacity = d.facialHairOpacity;
      if (d.chestHairStyle !== undefined) chestHairStyle = d.chestHairStyle;
      if (d.chestHairColor !== undefined) chestHairColor = d.chestHairColor;
      if (d.chestHairOpacity !== undefined) chestHairOpacity = d.chestHairOpacity;
      if (d.blemishStyle !== undefined) blemishStyle = d.blemishStyle;
      if (d.blemishOpacity !== undefined) blemishOpacity = d.blemishOpacity;
      if (d.ageingStyle !== undefined) ageingStyle = d.ageingStyle;
      if (d.ageingOpacity !== undefined) ageingOpacity = d.ageingOpacity;
      if (d.molesStyle !== undefined) molesStyle = d.molesStyle;
      if (d.molesOpacity !== undefined) molesOpacity = d.molesOpacity;
      if (d.complexionStyle !== undefined) complexionStyle = d.complexionStyle;
      if (d.complexionOpacity !== undefined) complexionOpacity = d.complexionOpacity;
      if (d.sunDamageStyle !== undefined) sunDamageStyle = d.sunDamageStyle;
      if (d.sunDamageOpacity !== undefined) sunDamageOpacity = d.sunDamageOpacity;
      if (d.eyeColor !== undefined) eyeColor = d.eyeColor;
      if (d.makeupStyle !== undefined) makeupStyle = d.makeupStyle;
      if (d.makeupColor !== undefined) makeupColor = d.makeupColor;
      if (d.makeupOpacity !== undefined) makeupOpacity = d.makeupOpacity;
      if (d.makeupColorType !== undefined) makeupOriginalColor = d.makeupColorType === 0;
      if (d.blushStyle !== undefined) blushStyle = d.blushStyle;
      if (d.blushColor !== undefined) blushColor = d.blushColor;
      if (d.blushOpacity !== undefined) blushOpacity = d.blushOpacity;
      if (d.lipstickStyle !== undefined) lipstickStyle = d.lipstickStyle;
      if (d.lipstickColor !== undefined) lipstickColor = d.lipstickColor;
      if (d.lipstickOpacity !== undefined) lipstickOpacity = d.lipstickOpacity;
    } catch {}
  }

  function buildMenyooXml(): string {
    const ols = [
      { id: 0, index: blemishStyle, opacity: blemishOpacity, ct: 0, color: 0 },
      { id: 1, index: facialHairStyle, opacity: facialHairOpacity, ct: 1, color: facialHairColor },
      { id: 2, index: eyebrowStyle, opacity: eyebrowOpacity, ct: 1, color: eyebrowColor },
      { id: 3, index: ageingStyle, opacity: ageingOpacity, ct: 0, color: 0 },
      { id: 4, index: makeupStyle, opacity: makeupOpacity, ct: makeupOriginalColor ? 0 : 2, color: makeupColor },
      { id: 5, index: blushStyle, opacity: blushOpacity, ct: 2, color: blushColor },
      { id: 6, index: complexionStyle, opacity: complexionOpacity, ct: 0, color: 0 },
      { id: 7, index: sunDamageStyle, opacity: sunDamageOpacity, ct: 0, color: 0 },
      { id: 8, index: lipstickStyle, opacity: lipstickOpacity, ct: 2, color: lipstickColor },
      { id: 9, index: molesStyle, opacity: molesOpacity, ct: 0, color: 0 },
      { id: 10, index: chestHairStyle, opacity: chestHairOpacity, ct: 1, color: chestHairColor },
    ];
    const featXml = (features as number[]).map((f, i) => `    <Feature index="${i}">${f.toFixed(4)}</Feature>`).join('\n');
    const olXml = ols.map(o =>
      `    <HeadOverlay id="${o.id}">\n      <Index>${o.index}</Index>\n      <Opacity>${o.opacity.toFixed(4)}</Opacity>\n      <ColourType>${o.ct}</ColourType>\n      <FirstColour>${o.color}</FirstColour>\n      <SecondColour>${o.color}</SecondColour>\n    </HeadOverlay>`
    ).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<OutfitPedData>\n  <ModelHash>${gender === 1 ? 'mp_f_freemode_01' : 'mp_m_freemode_01'}</ModelHash>\n  <HeadBlendData>\n    <ShapeFirst>${mother}</ShapeFirst>\n    <ShapeSecond>${father}</ShapeSecond>\n    <ShapeThird>0</ShapeThird>\n    <SkinFirst>${mother}</SkinFirst>\n    <SkinSecond>${father}</SkinSecond>\n    <SkinThird>0</SkinThird>\n    <ShapeMix>${shapeMix.toFixed(4)}</ShapeMix>\n    <SkinMix>${skinMix.toFixed(4)}</SkinMix>\n    <ThirdMix>0</ThirdMix>\n    <IsParent>false</IsParent>\n  </HeadBlendData>\n  <FaceFeatures>\n${featXml}\n  </FaceFeatures>\n  <HeadOverlayData>\n${olXml}\n  </HeadOverlayData>\n  <EyeColour>${eyeColor}</EyeColour>\n  <HairColour>${hairColor}</HairColour>\n  <HairHighlightColour>${hairHighlight}</HairHighlightColour>\n  <HairStyle>${hairStyle}</HairStyle>\n</OutfitPedData>`;
  }

  function exportCode(): string {
    return btoa(unescape(encodeURIComponent(buildPayload())));
  }

  function copyCode(text: string, setCopied: (v: boolean) => void) {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {});
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.cssText = 'position:absolute;opacity:0;';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function parseMenyooXml(xml: string): Record<string, any> {
    const gS = (tag: string) => { const m = xml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`)); return m ? m[1].trim() : null; };
    const gI = (tag: string) => { const v = gS(tag); return v !== null ? parseInt(v) : null; };
    const gF = (tag: string) => { const v = gS(tag); return v !== null ? parseFloat(v) : null; };
    const feats: number[] = Array(20).fill(0);
    const fr = /<Feature index="(\d+)">(.*?)<\/Feature>/g;
    let m: RegExpExecArray | null;
    while ((m = fr.exec(xml)) !== null) { const i = parseInt(m[1]); if (i < 20) feats[i] = parseFloat(m[2]); }
    const ols: Record<number, any> = {};
    const or2 = /<HeadOverlay id="(\d+)">([\ \S]*?)<\/HeadOverlay>/g;
    while ((m = or2.exec(xml)) !== null) {
      const id = parseInt(m[1]), block = m[2];
      const b = (t: string) => { const bm = block.match(new RegExp(`<${t}>(.*?)<\\/${t}>`)); return bm ? bm[1].trim() : null; };
      ols[id] = { index: parseInt(b('Index') || '255'), opacity: parseFloat(b('Opacity') || '1'), ct: parseInt(b('ColourType') || '0'), color: parseInt(b('FirstColour') || '0') };
    }
    return {
      mother: gI('ShapeFirst') ?? 0, father: gI('ShapeSecond') ?? 0,
      shapeMix: gF('ShapeMix') ?? 0.5, skinMix: gF('SkinMix') ?? 0.5,
      features: feats,
      hairStyle: gI('HairStyle') ?? 0, hairColor: gI('HairColour') ?? 0, hairHighlight: gI('HairHighlightColour') ?? 0,
      eyeColor: gI('EyeColour') ?? 0,
      blemishStyle: ols[0]?.index ?? 255, blemishOpacity: ols[0]?.opacity ?? 1,
      facialHairStyle: ols[1]?.index ?? 255, facialHairOpacity: ols[1]?.opacity ?? 1, facialHairColor: ols[1]?.color ?? 0,
      eyebrowStyle: ols[2]?.index ?? 255, eyebrowOpacity: ols[2]?.opacity ?? 1, eyebrowColor: ols[2]?.color ?? 0,
      ageingStyle: ols[3]?.index ?? 255, ageingOpacity: ols[3]?.opacity ?? 0.8,
      makeupStyle: ols[4]?.index ?? 255, makeupOpacity: ols[4]?.opacity ?? 1, makeupColorType: ols[4]?.ct ?? 0, makeupColor: ols[4]?.color ?? 0,
      blushStyle: ols[5]?.index ?? 255, blushOpacity: ols[5]?.opacity ?? 0.6, blushColor: ols[5]?.color ?? 0,
      complexionStyle: ols[6]?.index ?? 255, complexionOpacity: ols[6]?.opacity ?? 1,
      sunDamageStyle: ols[7]?.index ?? 255, sunDamageOpacity: ols[7]?.opacity ?? 1,
      lipstickStyle: ols[8]?.index ?? 255, lipstickOpacity: ols[8]?.opacity ?? 1, lipstickColor: ols[8]?.color ?? 0,
      molesStyle: ols[9]?.index ?? 255, molesOpacity: ols[9]?.opacity ?? 1,
      chestHairStyle: ols[10]?.index ?? 255, chestHairOpacity: ols[10]?.opacity ?? 1, chestHairColor: ols[10]?.color ?? 0,
    };
  }

  function applyImportCode() {
    importError = '';
    const raw = importInput.trim();
    if (!raw) { importError = 'Kod boş olamaz.'; return; }
    try {
      let parsed: Record<string, any>;
      if (raw.startsWith('<')) {
        parsed = parseMenyooXml(raw);
      } else {
        let jsonStr = raw;
        try { jsonStr = decodeURIComponent(escape(atob(raw))); } catch {}
        parsed = JSON.parse(jsonStr);
      }
      loadFromData(JSON.stringify(parsed));
      if (typeof (window as any).mp !== 'undefined') {
        (window as any).mp.trigger('client:loadFaceCode', buildPayload());
      }
      showFaceCode = false;
      importInput = '';
    } catch {
      importError = 'Geçersiz kod formatı.';
    }
  }
</script>

<div class="creator-wrapper">

  <!-- Sol alt kamera ipucu -->
  <div class="controls-hint">
    <div class="hint-title">KAMERA</div>
    <div class="hint-row"><kbd>A</kbd><kbd>D</kbd><span>Döndür</span></div>
    <div class="hint-row"><kbd>W</kbd><kbd>S</kbd><span>Yükseklik</span></div>
    <div class="hint-row"><kbd>⇕</kbd><span>Yakınlaş</span></div>
  </div>

  <div class="creator-panel">

    <!-- ── Üst Bar ── -->
    <div class="panel-topbar">
      <button class="topbar-btn" onclick={resetAll}>↺ Sıfırla</button>
      <button class="topbar-btn fc-btn" onclick={() => { showFaceCode = true; faceCodeTab = 'export'; }}>💾 Yüz Kodu</button>
    </div>

    <!-- ── İptal Onay Overlay ── -->
    {#if showConfirm}
      <div class="confirm-overlay">
        <div class="confirm-box">
          <p class="confirm-title">Emin misiniz?</p>
          <p class="confirm-sub">Yapılan tüm değişiklikler kaybolacak.</p>
          <div class="confirm-actions">
            <button class="confirm-yes" onclick={handleCancel}>Evet, İptal Et</button>
            <button class="confirm-no" onclick={() => showConfirm = false}>Vazgeç</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Yüz Kodu Overlay ── -->
    {#if showFaceCode}
      <div class="facecc-overlay">
        <div class="facecc-box">
          <div class="facecc-header">
            <span class="facecc-title">💾 YÜZ KODU</span>
            <button class="facecc-close" onclick={() => { showFaceCode = false; importInput = ''; importError = ''; }}>✕</button>
          </div>
          <div class="facecc-tabs">
            <button class:active={faceCodeTab === 'export'} onclick={() => faceCodeTab = 'export'}>Dışa Aktar</button>
            <button class:active={faceCodeTab === 'import'} onclick={() => faceCodeTab = 'import'}>İçe Aktar</button>
            <button class:active={faceCodeTab === 'menyoo'} onclick={() => faceCodeTab = 'menyoo'}>Menyoo XML</button>
          </div>
          {#if faceCodeTab === 'export'}
            <p class="facecc-desc">Bu kodu kopyalayarak başkalarıyla paylaşabilirsiniz.</p>
            <textarea class="facecc-code" readonly value={exportCode()} onclick={(e) => (e.target as HTMLTextAreaElement).select()}></textarea>
            <button class="facecc-action-btn" onclick={() => copyCode(exportCode(), (v) => copied = v)}>{copied ? '✓ Kopyalandı!' : '📋 Kopyala'}</button>
          {:else if faceCodeTab === 'import'}
            <p class="facecc-desc">Paylaşım kodunu veya Menyoo XML içeriğini yapıştırın.</p>
            <textarea class="facecc-code editable" bind:value={importInput} placeholder="Kodu buraya yapıştırın..."></textarea>
            {#if importError}<p class="facecc-error">{importError}</p>{/if}
            <button class="facecc-action-btn facecc-apply" onclick={applyImportCode}>▶ Uygula</button>
          {:else}
            <p class="facecc-desc">Menyoo Trainer ile uyumlu XML formatı.</p>
            <textarea class="facecc-code" readonly value={buildMenyooXml()} onclick={(e) => (e.target as HTMLTextAreaElement).select()}></textarea>
            <button class="facecc-action-btn" onclick={() => copyCode(buildMenyooXml(), (v) => copiedMenyoo = v)}>{copiedMenyoo ? '✓ Kopyalandı!' : '📋 Kopyala'}</button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ── Ana Gövde ── -->
    <div class="panel-body">
    <!-- ── Sidebar ── -->
    <nav class="sidebar">
      {#each TABS as tab}
        <button
          class="nav-btn"
          class:active={activeTab === tab.id}
          onclick={() => activeTab = tab.id}
          title={tab.label}
        >
          <span class="nav-icon">{tab.icon}</span>
          <span class="nav-label">{tab.label}</span>
        </button>
      {/each}

      <div class="flex-spacer"></div>

      <button class="cancel-btn" onclick={() => showConfirm = true}>
        <span>✕</span>
        <span>İPTAL</span>
      </button>

      <button class="finish-btn" onclick={handleSave}>
        <span>✓</span>
        <span>BİTİR</span>
      </button>
    </nav>

    <!-- ── İçerik ── -->
    <div class="content">

      <!-- ═══ GENETİK ═══ -->
      {#if activeTab === 'genetics'}
        <h2 class="section-title">Genetik</h2>

        <!-- Cinsiyet badge - değiştirilemez, DB'den geliyor -->
        <div class="gender-badge">
          <span class="gender-icon">{gender === 1 ? '♀️' : '♂️'}</span>
          <div>
            <div class="gender-label">CİNSİYET</div>
            <div class="gender-value">{gender === 1 ? 'Kadın' : 'Erkek'}</div>
          </div>
          <span class="gender-lock">🔒 Karakter oluşturulurken belirlendi</span>
        </div>

        <div class="card">
          <div class="card-header">Ebeveyn DNA</div>
          <div class="field">
            <label>Anne <span class="val">{mother}</span></label>
            <input type="range" min="0" max="45" bind:value={mother}>
          </div>
          <div class="field">
            <label>Baba <span class="val">{father}</span></label>
            <input type="range" min="0" max="45" bind:value={father}>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Karışım Oranı</div>
          <div class="field">
            <label>Yüz Şekli <span class="val">{shapeMix.toFixed(2)}</span></label>
            <div class="range-track">
              <span class="track-label">Anne</span>
              <input type="range" min="0" max="1" step="0.05" bind:value={shapeMix}>
              <span class="track-label">Baba</span>
            </div>
          </div>
          <div class="field">
            <label>Cilt Tonu <span class="val">{skinMix.toFixed(2)}</span></label>
            <div class="range-track">
              <span class="track-label">Anne</span>
              <input type="range" min="0" max="1" step="0.05" bind:value={skinMix}>
              <span class="track-label">Baba</span>
            </div>
          </div>
        </div>

      <!-- ═══ YÜZ HATLARI ═══ -->
      {:else if activeTab === 'features'}
        <h2 class="section-title">Yüz Hatları</h2>
        <p class="section-sub">← Küçük / Büyük → &nbsp;&middot;&nbsp; Orta = 0.0</p>

        <div class="card">
          <div class="card-header">Burun</div>
          {#each [0,1,2,3,4,5] as i}
            <div class="feat-row">
              <span class="feat-name">{featureNames[i]}</span>
              <input type="range" min="-1" max="1" step="0.05" bind:value={features[i]}>
              <span class="feat-val">{(features[i] as number).toFixed(2)}</span>
            </div>
          {/each}
        </div>

        <div class="card">
          <div class="card-header">Kaş & Alın</div>
          {#each [6,7] as i}
            <div class="feat-row">
              <span class="feat-name">{featureNames[i]}</span>
              <input type="range" min="-1" max="1" step="0.05" bind:value={features[i]}>
              <span class="feat-val">{(features[i] as number).toFixed(2)}</span>
            </div>
          {/each}
        </div>

        <div class="card">
          <div class="card-header">Elmacık & Yanak</div>
          {#each [8,9,10] as i}
            <div class="feat-row">
              <span class="feat-name">{featureNames[i]}</span>
              <input type="range" min="-1" max="1" step="0.05" bind:value={features[i]}>
              <span class="feat-val">{(features[i] as number).toFixed(2)}</span>
            </div>
          {/each}
        </div>

        <div class="card">
          <div class="card-header">Göz & Dudak</div>
          {#each [11,12] as i}
            <div class="feat-row">
              <span class="feat-name">{featureNames[i]}</span>
              <input type="range" min="-1" max="1" step="0.05" bind:value={features[i]}>
              <span class="feat-val">{(features[i] as number).toFixed(2)}</span>
            </div>
          {/each}
        </div>

        <div class="card">
          <div class="card-header">Çene & Çarpıklık</div>
          {#each [13,14,15,16,17,18] as i}
            <div class="feat-row">
              <span class="feat-name">{featureNames[i]}</span>
              <input type="range" min="-1" max="1" step="0.05" bind:value={features[i]}>
              <span class="feat-val">{(features[i] as number).toFixed(2)}</span>
            </div>
          {/each}
        </div>

        <div class="card">
          <div class="card-header">Boyun</div>
          {#each [19] as i}
            <div class="feat-row">
              <span class="feat-name">{featureNames[i]}</span>
              <input type="range" min="-1" max="1" step="0.05" bind:value={features[i]}>
              <span class="feat-val">{(features[i] as number).toFixed(2)}</span>
            </div>
          {/each}
        </div>

      <!-- ═══ SAÇ & KILLAR ═══ -->
      {:else if activeTab === 'hair'}
        <h2 class="section-title">Saç & Kıllar</h2>

        <div class="card">
          <div class="card-header">Baş Saçı</div>
          <div class="field">
            <label>Stil <span class="val">{hairStyle}</span></label>
            <input type="range" min="0" max="75" bind:value={hairStyle}>
          </div>
          <div class="row-2">
            <div class="field">
              <label>Ana Renk <span class="val">{hairColor}</span></label>
              <input type="range" min="0" max="60" bind:value={hairColor}>
            </div>
            <div class="field">
              <label>Vurgu <span class="val">{hairHighlight}</span></label>
              <input type="range" min="0" max="60" bind:value={hairHighlight}>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Kaşlar <button class="reset-badge" onclick={() => eyebrowStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{eyebrowStyle === 255 ? '—' : eyebrowStyle}</span></label>
            <input type="range" min="0" max="34" bind:value={eyebrowStyle}>
          </div>
          <div class="row-2">
            <div class="field">
              <label>Renk <span class="val">{eyebrowColor}</span></label>
              <input type="range" min="0" max="60" bind:value={eyebrowColor}>
            </div>
            <div class="field">
              <label>Opaklık <span class="val">{eyebrowOpacity.toFixed(1)}</span></label>
              <input type="range" min="0" max="1" step="0.1" bind:value={eyebrowOpacity}>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Sakal / Bıyık <button class="reset-badge" onclick={() => facialHairStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{facialHairStyle === 255 ? '—' : facialHairStyle}</span></label>
            <input type="range" min="0" max="28" bind:value={facialHairStyle}>
          </div>
          <div class="row-2">
            <div class="field">
              <label>Renk <span class="val">{facialHairColor}</span></label>
              <input type="range" min="0" max="60" bind:value={facialHairColor}>
            </div>
            <div class="field">
              <label>Opaklık <span class="val">{facialHairOpacity.toFixed(1)}</span></label>
              <input type="range" min="0" max="1" step="0.1" bind:value={facialHairOpacity}>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Göğüs Kılı <button class="reset-badge" onclick={() => chestHairStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{chestHairStyle === 255 ? '—' : chestHairStyle}</span></label>
            <input type="range" min="0" max="16" bind:value={chestHairStyle}>
          </div>
          <div class="row-2">
            <div class="field">
              <label>Renk <span class="val">{chestHairColor}</span></label>
              <input type="range" min="0" max="60" bind:value={chestHairColor}>
            </div>
            <div class="field">
              <label>Opaklık <span class="val">{chestHairOpacity.toFixed(1)}</span></label>
              <input type="range" min="0" max="1" step="0.1" bind:value={chestHairOpacity}>
            </div>
          </div>
        </div>

      <!-- ═══ CİLT & DOKU ═══ -->
      {:else if activeTab === 'skin'}
        <h2 class="section-title">Cilt & Doku</h2>

        <div class="card">
          <div class="card-header">Cilt Lekeleri <button class="reset-badge" onclick={() => blemishStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{blemishStyle === 255 ? '—' : blemishStyle}</span></label>
            <input type="range" min="0" max="23" bind:value={blemishStyle}>
          </div>
          <div class="field">
            <label>Opaklık <span class="val">{blemishOpacity.toFixed(1)}</span></label>
            <input type="range" min="0" max="1" step="0.1" bind:value={blemishOpacity}>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Yaşlanma (Kırışıklıklar) <button class="reset-badge" onclick={() => ageingStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{ageingStyle === 255 ? '—' : ageingStyle}</span></label>
            <input type="range" min="0" max="14" bind:value={ageingStyle}>
          </div>
          <div class="field">
            <label>Opaklık <span class="val">{ageingOpacity.toFixed(1)}</span></label>
            <input type="range" min="0" max="1" step="0.1" bind:value={ageingOpacity}>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Çiller & Benler <button class="reset-badge" onclick={() => molesStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{molesStyle === 255 ? '—' : molesStyle}</span></label>
            <input type="range" min="0" max="17" bind:value={molesStyle}>
          </div>
          <div class="field">
            <label>Opaklık <span class="val">{molesOpacity.toFixed(1)}</span></label>
            <input type="range" min="0" max="1" step="0.1" bind:value={molesOpacity}>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Cilt Tipi (Kompleksiyon) <button class="reset-badge" onclick={() => complexionStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{complexionStyle === 255 ? '—' : complexionStyle}</span></label>
            <input type="range" min="0" max="11" bind:value={complexionStyle}>
          </div>
          <div class="field">
            <label>Opaklık <span class="val">{complexionOpacity.toFixed(1)}</span></label>
            <input type="range" min="0" max="1" step="0.1" bind:value={complexionOpacity}>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Güneş Hasarı <button class="reset-badge" onclick={() => sunDamageStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{sunDamageStyle === 255 ? '—' : sunDamageStyle}</span></label>
            <input type="range" min="0" max="11" bind:value={sunDamageStyle}>
          </div>
          <div class="field">
            <label>Opaklık <span class="val">{sunDamageOpacity.toFixed(1)}</span></label>
            <input type="range" min="0" max="1" step="0.1" bind:value={sunDamageOpacity}>
          </div>
        </div>

      <!-- ═══ MAKYAJ & GÖZ ═══ -->
      {:else if activeTab === 'makeup'}
        <h2 class="section-title">Makyaj & Göz</h2>

        <div class="card">
          <div class="card-header">Göz Rengi</div>
          <div class="field">
            <label>Renk <span class="val">{eyeColor}</span></label>
            <input type="range" min="0" max="31" bind:value={eyeColor}>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Ruj <button class="reset-badge" onclick={() => lipstickStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{lipstickStyle === 255 ? '—' : lipstickStyle}</span></label>
            <input type="range" min="0" max="9" bind:value={lipstickStyle}>
          </div>
          <div class="row-2">
            <div class="field">
              <label>Renk <span class="val">{lipstickColor}</span></label>
              <input type="range" min="0" max="60" bind:value={lipstickColor}>
            </div>
            <div class="field">
              <label>Opaklık <span class="val">{lipstickOpacity.toFixed(1)}</span></label>
              <input type="range" min="0" max="1" step="0.1" bind:value={lipstickOpacity}>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Allık <button class="reset-badge" onclick={() => blushStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{blushStyle === 255 ? '—' : blushStyle}</span></label>
            <input type="range" min="0" max="6" bind:value={blushStyle}>
          </div>
          <div class="row-2">
            <div class="field">
              <label>Renk <span class="val">{blushColor}</span></label>
              <input type="range" min="0" max="60" bind:value={blushColor}>
            </div>
            <div class="field">
              <label>Opaklık <span class="val">{blushOpacity.toFixed(1)}</span></label>
              <input type="range" min="0" max="1" step="0.1" bind:value={blushOpacity}>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Göz Altı Makyajı <button class="reset-badge" onclick={() => makeupStyle = 255}>Kaldır</button></div>
          <div class="field">
            <label>Stil <span class="val">{makeupStyle === 255 ? '—' : makeupStyle}</span></label>
            <input type="range" min="0" max="74" bind:value={makeupStyle}>
          </div>
          <div class="field field-checkbox">
            <label class="toggle-row">
              <input type="checkbox" bind:checked={makeupOriginalColor}>
              <span>Orijinal Renk <span class="hint">(renk basma — joker tarzı)</span></span>
            </label>
          </div>
          {#if !makeupOriginalColor}
          <div class="row-2">
            <div class="field">
              <label>Renk <span class="val">{makeupColor}</span></label>
              <input type="range" min="0" max="60" bind:value={makeupColor}>
            </div>
            <div class="field">
              <label>Opaklık <span class="val">{makeupOpacity.toFixed(1)}</span></label>
              <input type="range" min="0" max="1" step="0.1" bind:value={makeupOpacity}>
            </div>
          </div>
          {/if}
        </div>

      {/if}

    </div><!-- /content -->
    </div><!-- /panel-body -->
  </div><!-- /creator-panel -->
</div><!-- /creator-wrapper -->

<style>
  .field-checkbox { padding-top: 6px; }
  /* ── Genel ─────────────────────────────────────── */
  :global(*) { box-sizing: border-box; }
  :global(body) { user-select: none !important; -webkit-user-select: none !important; }

  .creator-wrapper {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #e8e8e8;
    user-select: none;
    -webkit-user-select: none;
  }

  /* ── Kamera İpucu ─────────────────────────────── */
  .controls-hint {
    position: absolute;
    bottom: 36px;
    left: 36px;
    background: rgba(8, 8, 14, 0.88);
    border: 1px solid rgba(255,255,255,0.07);
    border-left: 3px solid var(--color-secondary);
    padding: 14px 18px;
    border-radius: 8px;
    pointer-events: none;
    backdrop-filter: blur(8px);
    min-width: 170px;
  }
  .hint-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--color-secondary);
    margin-bottom: 10px;
    text-transform: uppercase;
  }
  .hint-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 13px;
    color: #bbb;
  }
  .hint-row:last-child { margin-bottom: 0; }
  .hint-row span { margin-left: 4px; }
  kbd {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    font-family: inherit;
    font-weight: 700;
    color: #ddd;
  }

  /* ── Panel ────────────────────────────────────── */
  .creator-panel {
    position: absolute;
    top: 24px;
    right: 32px;
    width: 500px;
    height: calc(100vh - 48px);
    background: rgba(10, 11, 16, 0.97);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.08);
    backdrop-filter: blur(12px);
  }

  /* ── Sidebar ──────────────────────────────────── */
  .sidebar {
    width: 80px;
    background: rgba(0,0,0,0.5);
    border-right: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 8px 0;
  }
  .nav-btn {
    background: transparent;
    border: none;
    border-left: 3px solid transparent;
    color: #555;
    padding: 14px 6px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    transition: color 0.2s, background 0.2s, border-color 0.2s;
  }
  .nav-btn:hover { background: rgba(255,255,255,0.04); color: #aaa; }
  .nav-btn.active {
    background: rgba(201,168,76,0.08);
    border-left-color: var(--color-secondary);
    color: var(--color-secondary);
  }
  .nav-icon { font-size: 22px; line-height: 1; }
  .nav-label { font-size: 11px; font-weight: 600; letter-spacing: 0.3px; text-align: center; line-height: 1.2; }

  .flex-spacer { flex: 1; }

  .finish-btn {
    background: var(--color-secondary);
    border: none;
    color: var(--bg-primary);
    cursor: pointer;
    font-weight: 800;
    padding: 18px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    letter-spacing: 1px;
    transition: background 0.2s;
  }
  .finish-btn:hover { background: var(--color-secondary-hover); }
  .finish-btn span:first-child { font-size: 18px; }

  .cancel-btn {
    background: rgba(180, 60, 60, 0.18);
    border: none;
    border-top: 1px solid rgba(180,60,60,0.25);
    color: #e08080;
    cursor: pointer;
    font-weight: 700;
    padding: 14px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    letter-spacing: 1px;
    transition: background 0.2s, color 0.2s;
  }
  .cancel-btn:hover { background: rgba(180,60,60,0.35); color: #ff9999; }
  .cancel-btn span:first-child { font-size: 16px; }

  .confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    border-radius: 12px;
  }
  .confirm-box {
    background: var(--bg-secondary);
    border: 1px solid rgba(201,168,76,0.3);
    border-radius: 10px;
    padding: 28px 32px;
    max-width: 260px;
    text-align: center;
  }
  .confirm-title {
    font-size: 17px;
    font-weight: 800;
    color: #f0d98b;
    margin: 0 0 8px 0;
    letter-spacing: 0.8px;
  }
  .confirm-sub {
    font-size: 12px;
    color: #999;
    margin: 0 0 20px 0;
    line-height: 1.5;
  }
  .confirm-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .confirm-yes {
    background: var(--color-danger);
    border: none;
    color: #fff;
    border-radius: 6px;
    padding: 11px 18px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    transition: background 0.2s;
  }
  .confirm-yes:hover { background: var(--color-danger-hover); }
  .confirm-no {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    color: #aaa;
    border-radius: 6px;
    padding: 10px 18px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
  }
  .confirm-no:hover { background: rgba(255,255,255,0.12); color: #eee; }

  /* ── İçerik ───────────────────────────────────── */
  .content {
    flex: 1;
    padding: 22px 20px;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .content::-webkit-scrollbar { width: 5px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 3px; }

  .section-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--color-secondary);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin: 0 0 16px 0;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(201,168,76,0.15);
  }
  .section-sub {
    font-size: 12px;
    color: #666;
    margin: -10px 0 16px 0;
  }

  /* ── Cinsiyet Badge ────────────────────────────── */
  .gender-badge {
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(201,168,76,0.06);
    border: 1px solid rgba(201,168,76,0.18);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 14px;
  }
  .gender-icon { font-size: 28px; }
  .gender-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .gender-value {
    font-size: 16px;
    font-weight: 700;
    color: #e8e8e8;
  }
  .gender-lock {
    margin-left: auto;
    font-size: 10px;
    color: #555;
    text-align: right;
    line-height: 1.4;
  }

  /* ── Card ─────────────────────────────────────── */
  .card {
    background: rgba(255,255,255,0.028);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 12px;
  }
  .card-header {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #aaa;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* ── Field ────────────────────────────────────── */
  .field {
    margin-bottom: 14px;
  }
  .field:last-child { margin-bottom: 0; }

  .field label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-size: 13px;
    color: #aaa;
    font-weight: 500;
    margin-bottom: 7px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .val {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-secondary);
    text-transform: none;
    letter-spacing: 0;
  }

  .row-2 { display: flex; gap: 12px; }
  .row-2 .field { flex: 1; }

  .range-track {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .range-track input { flex: 1; }
  .track-label {
    font-size: 11px;
    color: #666;
    white-space: nowrap;
  }

  /* ── Feature Row ──────────────────────────────── */
  .feat-row {
    display: grid;
    grid-template-columns: 130px 1fr 32px;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .feat-row:last-child { margin-bottom: 0; }
  .feat-name {
    font-size: 12px;
    color: #aaa;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .feat-val {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-secondary);
    text-align: right;
    min-width: 28px;
  }

  /* ── Range Input ──────────────────────────────── */
  input[type="range"] {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.1);
    outline: none;
    cursor: pointer;
    transition: background 0.2s;
  }
  input[type="range"]:hover { background: rgba(255,255,255,0.18); }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: var(--color-secondary);
    border: 2px solid rgba(255,255,255,0.9);
    cursor: pointer;
    box-shadow: 0 0 8px rgba(201,168,76,0.55);
    transition: transform 0.15s;
  }
  input[type="range"]:active::-webkit-slider-thumb { transform: scale(1.25); }

  /* ── Select ───────────────────────────────────── */
  
  

  /* ── Reset badge ──────────────────────────────── */
  .reset-badge {
    background: rgba(255,60,60,0.08);
    border: 1px solid rgba(255,60,60,0.22);
    color: #ff7070;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    transition: background 0.2s, color 0.2s;
    flex-shrink: 0;
  }
  .reset-badge:hover { background: rgba(255,60,60,0.65); color: #fff; }

  /* ── Panel Topbar ─────────────────────────────── */
  .panel-topbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 12px;
    height: 40px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(0,0,0,0.25);
  }
  .topbar-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: #aaa;
    padding: 5px 12px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }
  .topbar-btn:hover { background: rgba(255,255,255,0.10); color: #eee; }
  .fc-btn { border-color: rgba(201,168,76,0.25); color: var(--color-secondary); }
  .fc-btn:hover { background: rgba(201,168,76,0.12); color: var(--color-secondary-hover); }

  /* ── Panel Body ────────────────────────────────── */
  .panel-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* ── Yüz Kodu Overlay ──────────────────────────── */
  .facecc-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.78);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    border-radius: 12px;
  }
  .facecc-box {
    background: var(--bg-modal);
    border: 1px solid rgba(201,168,76,0.25);
    border-radius: 12px;
    padding: 22px 24px;
    width: 380px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .facecc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .facecc-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: var(--color-secondary);
    text-transform: uppercase;
  }
  .facecc-close {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
    color: #aaa;
    width: 28px;
    height: 28px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }
  .facecc-close:hover { background: rgba(255,60,60,0.3); color: #fff; }
  .facecc-tabs { display: flex; gap: 6px; }
  .facecc-tabs button {
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    color: #666;
    padding: 8px 4px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .facecc-tabs button:hover { background: rgba(255,255,255,0.08); color: #aaa; }
  .facecc-tabs button.active { background: rgba(201,168,76,0.12); border-color: rgba(201,168,76,0.35); color: var(--color-secondary); }
  .facecc-desc { font-size: 11px; color: #666; line-height: 1.5; margin: 0; }
  .facecc-code {
    width: 100%;
    height: 110px;
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 6px;
    color: var(--color-secondary);
    font-size: 11px;
    font-family: 'Courier New', monospace;
    padding: 10px;
    resize: none;
    outline: none;
    word-break: break-all;
  }
  .facecc-code.editable { color: #e8e8e8; }
  .facecc-code::placeholder { color: #444; }
  .facecc-action-btn {
    background: rgba(201,168,76,0.12);
    border: 1px solid rgba(201,168,76,0.3);
    color: var(--color-secondary);
    padding: 10px 16px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .facecc-action-btn:hover { background: rgba(201,168,76,0.25); color: var(--color-secondary-hover); }
  .facecc-apply { background: rgba(50,180,100,0.12); border-color: rgba(50,180,100,0.3); color: #5ec98a; }
  .facecc-apply:hover { background: rgba(50,180,100,0.25); color: #7de0a8; }
  .facecc-error { font-size: 11px; color: #ff7070; margin: 0; }

  /* ── Toggle row (makyaj orijinal renk) ──────── */
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #c8b97c;
  }
  .toggle-row input[type="checkbox"] {
    width: 15px;
    height: 15px;
    accent-color: var(--color-secondary);
    cursor: pointer;
    flex-shrink: 0;
  }
  .toggle-row .hint {
    color: #888;
    font-size: 11px;
  }
</style>
