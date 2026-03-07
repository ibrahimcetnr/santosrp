"use strict";
/**
 * SantosRP - Realtime Weather & Time Sync (Open-Meteo)
 * Ömür boyu ücretsiz, sınırsız ve API Key GEREKTİRMEZ!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWeatherSystem = initWeatherSystem;
// İstanbul Koordinatları
const LATITUDE = "41.0151";
const LONGITUDE = "28.9784";
// WMO Hava Durumu Kodlarını RAGE:MP (GTA 5) Havasına Çevirir
function mapWMOCodeToGTA(code) {
    if (code === 0)
        return "EXTRASUNNY"; // Açık
    if (code === 1)
        return "CLEAR"; // Çoğunlukla Açık
    if (code === 2)
        return "CLOUDS"; // Parçalı Bulutlu
    if (code === 3)
        return "OVERCAST"; // Çok Bulutlu/Kapalı
    if (code === 45 || code === 48)
        return "FOGGY"; // Sisli
    if (code >= 51 && code <= 57)
        return "CLEARING"; // Çisenti/Hafif Yağmur
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
        return "RAIN"; // Yağmur
    if (code >= 71 && code <= 77)
        return "SNOW"; // Kar
    if (code === 85 || code === 86)
        return "BLIZZARD"; // Yoğun Kar/Tipi
    if (code >= 95 && code <= 99)
        return "THUNDER"; // Fırtına/Gök Gürültüsü
    return "CLEAR"; // Varsayılan
}
async function fetchRealWeather() {
    try {
        // Open-Meteo API Key GEREKTİRMEZ! Direkt istek atıyoruz.
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.current_weather) {
            const wmoCode = data.current_weather.weathercode;
            const gtaWeather = mapWMOCodeToGTA(wmoCode);
            // Hava durumunu RAGE:MP dünyasına uygula
            mp.world.weather = gtaWeather;
            console.log(`[WEATHER] İstanbul Havası Çekildi: ${data.current_weather.temperature}°C | GTA Havası: ${gtaWeather} (WMO: ${wmoCode})`);
        }
    }
    catch (error) {
        console.error("[WEATHER] Open-Meteo API'sinden veri çekilemedi:", error);
    }
}
// Gerçek dünya saatini RAGE:MP dünyasına uygular (İstanbul Saatine Kilitli)
function syncRealTime() {
    // Sunucu hangi ülkede olursa olsun zamanı "Europe/Istanbul" (GMT+3) olarak çeker
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Istanbul',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '12', 10);
    const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const seconds = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
    mp.world.time.set(hours, minutes, seconds);
}
function initWeatherSystem() {
    console.log("[WEATHER] Gerçek Zamanlı İstanbul Hava & Saat sistemi başlatıldı.");
    // 1. Sunucu açılır açılmaz saati ve havayı eşitle
    syncRealTime();
    fetchRealWeather();
    // 2. Saati her 1 dakikada bir güncelle
    setInterval(syncRealTime, 60 * 1000);
    // 3. Havayı her 15 dakikada bir güncelle (Open-Meteo günde 10.000 isteğe izin verir)
    setInterval(fetchRealWeather, 15 * 60 * 1000);
}
//# sourceMappingURL=weather.js.map