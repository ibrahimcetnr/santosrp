# CharacterCreator Component Yapısı

Bu klasör, `CharacterCreator.svelte` dosyasını daha yönetilebilir parçalara bölmek için örnek alt componentleri içerir.

## Mevcut Componentler

### 1. **Genetics.svelte** (Genetik)
- Anne/Baba seçimi (0-45 ID aralığı)
- Yüz şekli karışım oranı (shapeMix)
- Cilt rengi karışım oranı (skinMix)

**Kullanım:**
```svelte
<Genetics 
  {gender}
  bind:mother
  bind:father
  bind:shapeMix
  bind:skinMix
/>
```

### 2. **Makeup.svelte** (Makyaj & Göz)
- Göz rengi seçimi
- Makyaj stili ve renk modu (Orijinal/Renkli)
- Allık stili ve rengi
- Ruj stili ve rengi

**Kullanım:**
```svelte
<Makeup 
  bind:eyeColor
  bind:makeupStyle
  bind:makeupColor
  bind:makeupOpacity
  bind:makeupOriginalColor
  bind:blushStyle
  bind:blushColor
  bind:blushOpacity
  bind:lipstickStyle
  bind:lipstickColor
  bind:lipstickOpacity
/>
```

## Önerilen Ek Componentler

### 3. **Features.svelte** (Yüz Hatları)
```svelte
<!-- 20 adet yüz özelliği slider'ı -->
<Features bind:features />
```

### 4. **Hair.svelte** (Saç & Kıllar)
```svelte
<Hair 
  bind:hairStyle
  bind:hairColor
  bind:hairHighlight
  bind:eyebrowStyle
  bind:eyebrowColor
  bind:eyebrowOpacity
  bind:facialHairStyle
  bind:facialHairColor
  bind:facialHairOpacity
  bind:chestHairStyle
  bind:chestHairColor
  bind:chestHairOpacity
/>
```

### 5. **Skin.svelte** (Cilt & Doku)
```svelte
<Skin 
  bind:blemishStyle
  bind:blemishOpacity
  bind:ageingStyle
  bind:ageingOpacity
  bind:molesStyle
  bind:molesOpacity
  bind:complexionStyle
  bind:complexionOpacity
  bind:sunDamageStyle
  bind:sunDamageOpacity
/>
```

## Ana Dosyada Kullanım

`CharacterCreator.svelte` içinde:

```svelte
<script lang="ts">
  import Genetics from './CharacterCreator/Genetics.svelte';
  import Makeup from './CharacterCreator/Makeup.svelte';
  import Features from './CharacterCreator/Features.svelte';
  import Hair from './CharacterCreator/Hair.svelte';
  import Skin from './CharacterCreator/Skin.svelte';

  // ... state tanımlamaları ...

  // activeTab'e göre component göster
</script>

<div class="creator-content">
  {#if activeTab === 'genetics'}
    <Genetics 
      {gender}
      bind:mother
      bind:father
      bind:shapeMix
      bind:skinMix
    />
  {:else if activeTab === 'features'}
    <Features bind:features />
  {:else if activeTab === 'hair'}
    <Hair 
      bind:hairStyle
      bind:hairColor
      bind:hairHighlight
      bind:eyebrowStyle
      bind:eyebrowColor
      bind:eyebrowOpacity
      bind:facialHairStyle
      bind:facialHairColor
      bind:facialHairOpacity
      bind:chestHairStyle
      bind:chestHairColor
      bind:chestHairOpacity
    />
  {:else if activeTab === 'skin'}
    <Skin 
      bind:blemishStyle
      bind:blemishOpacity
      bind:ageingStyle
      bind:ageingOpacity
      bind:molesStyle
      bind:molesOpacity
      bind:complexionStyle
      bind:complexionOpacity
      bind:sunDamageStyle
      bind:sunDamageOpacity
    />
  {:else if activeTab === 'makeup'}
    <Makeup 
      bind:eyeColor
      bind:makeupStyle
      bind:makeupColor
      bind:makeupOpacity
      bind:makeupOriginalColor
      bind:blushStyle
      bind:blushColor
      bind:blushOpacity
      bind:lipstickStyle
      bind:lipstickColor
      bind:lipstickOpacity
    />
  {/if}
</div>
```

## Faydalar

1. **Daha İyi Organizasyon**: Her category kendi dosyasında
2. **Kolay Bakım**: Değişiklikler izole edilmiş
3. **Performans**: Lazy loading potansiyeli (sadece aktif tab render edilir)
4. **Yeniden Kullanılabilirlik**: Componentler başka projelerde kullanılabilir
5. **Daha Az Scroll**: 50KB dosya yerine her biri ~150-200 satır

## Not

- Tüm componentler `$bindable()` ile two-way binding kullanır
- Parent component'teki `$effect` bloğu tüm değişiklikleri otomatik yakalar
- Debounce mantığı parent'ta kalır (tüm alt componentler için geçerli)
