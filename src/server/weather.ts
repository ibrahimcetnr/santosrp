/**
 * SantosRP - Realtime Weather & Time Sync (Open-Meteo)
 * Ömür boyu ücretsiz, sınırsız ve API Key GEREKTİRMEZ!
 */
import * as https from 'https';

// İstanbul Koordinatları
const LATITUDE  = "41.0151";
const LONGITUDE = "28.9784";

// WMO Hava Durumu Kodlarını RAGE:MP (GTA 5) Havasına Çevirir
function mapWMOCodeToGTA(code: number): string {
  if (code === 0)                                        return "EXTRASUNNY"; // Açık
  if (code === 1)                                        return "CLEAR";      // Çoğunlukla Açık
  if (code === 2)                                        return "CLOUDS";     // Parçalı Bulutlu
  if (code === 3)                                        return "OVERCAST";   // Çok Bulutlu/Kapalı
  if (code === 45 || code === 48)                        return "FOGGY";      // Sisli
  if (code >= 51 && code <= 57)                         return "CLEARING";   // Çisenti/Hafif Yağmur
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "RAIN"; // Yağmur
  if (code >= 71 && code <= 77)                         return "SNOW";       // Kar
  if (code === 85 || code === 86)                       return "BLIZZARD";   // Yoğun Kar/Tipi
  if (code >= 95 && code <= 99)                         return "THUNDER";    // Fırtına/Gök Gürültüsü
  return "CLEAR"; // Varsayılan
}

// RAGEMP kendi Node.js sandbox'ını kullandığı için global fetch expose etmez.
// Node.js yerleşik https modülü ile istek atıyoruz.
function fetchRealWeather(): Promise<void> {
  return new Promise((resolve) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true`;
    https.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk: string) => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw) as { current_weather?: { weathercode: number; temperature: number } };
          if (data?.current_weather) {
            const wmoCode    = data.current_weather.weathercode;
            const gtaWeather = mapWMOCodeToGTA(wmoCode);
            mp.world.weather = gtaWeather;
            console.log(`[WEATHER] İstanbul Havası Çekildi: ${data.current_weather.temperature}°C | GTA Havası: ${gtaWeather} (WMO: ${wmoCode})`);
          }
        } catch (e) {
          console.error('[WEATHER] Open-Meteo API yanıtı parse edilemedi:', e);
        }
        resolve();
      });
    }).on('error', (error: Error) => {
      console.error("[WEATHER] Open-Meteo API'sinden veri çekilemedi:", error);
      resolve();
    });
  });
}

// Gerçek dünya saatini RAGE:MP dünyasına uygular (İstanbul Saatine Kilitli)
function syncRealTime() {
  // Sunucu hangi ülkede olursa olsun zamanı "Europe/Istanbul" (GMT+3) olarak çeker
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });

  const parts   = formatter.formatToParts(new Date());
  const hours   = parseInt(parts.find(p => p.type === 'hour')?.value   || '12', 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0',  10);
  const seconds = parseInt(parts.find(p => p.type === 'second')?.value || '0',  10);

  mp.world.time.set(hours, minutes, seconds);
}

export function initWeatherSystem() {
  console.log("[WEATHER] Gerçek Zamanlı İstanbul Hava & Saat sistemi başlatıldı.");

  // 1. Sunucu açılır açılmaz saati ve havayı eşitle
  syncRealTime();
  fetchRealWeather();

  // 2. Saati her 1 dakikada bir güncelle
  setInterval(syncRealTime, 60 * 1000);
  // 3. Havayı her 15 dakikada bir güncelle (Open-Meteo günde 10.000 isteğe izin verir)
  setInterval(fetchRealWeather, 15 * 60 * 1000);
}
