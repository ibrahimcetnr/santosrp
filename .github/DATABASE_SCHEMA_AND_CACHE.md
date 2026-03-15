# Santos RP - Veritabanı ve Önbellek (Cache) Mimarisi

Bu doküman, Santos RP projesindeki `PostgreSQL` veritabanı kullanımını ve performans için uygulanan önbellekleme (caching) mekanizmasını açıklar.

## 1. Veritabanı Yapısı ve Kurallar
- Modül: `pg` modülünün dahili Connection Pool özelliği (150 bağlantıya kadar uçar). Konfigürasyonu `src/server/db.ts` içerisindedir.
- **KURAL 1:** **SADECE PARAMETRELİ SORGULAR:** Tüm SQL sorguları `$1`, `$2` kullanılarak çalıştırılmak ZORUNDADIR. Kesinlikle string interpolation veya concatenation yapılmamalıdır.
    ```typescript
    // DOĞRU
    await query('SELECT * FROM accounts WHERE username = $1', [username]);

    // YANLIŞ!
    await query(`SELECT * FROM accounts WHERE username = '${username}'`);
    ```
- **KURAL 2:** Arayüz (UI) veya İstemci (Client) taraflarında hiçbir şekilde veritabanı sorgusu yapılamaz. 

## 2. Tablo Standartları
- Tablo isimleri ve kolon isimleri `snake_case` yazılmalıdır (`first_name`, `faction_id`).
- TypeScript kodunda obje yapıları (cache'te) `camelCase` olmalıdır. Bu yüzden veritabanı çekildikten sonra `toCamel` türevi fonksiyonlarla formatlanmalıdır.

## 3. Önbellekleme (Cache)
- Anlık koordinat değişiklikleri, envanter ağırlığı veya para gibi sıklıkla güncellenen verileri her saniye UPDATE olarak DBA'ye göndermeyin.
- Bunun yerine `src/server/cache.ts` ve Map/Set bazlı memory tutumu kullanın.

## 4. Toplu Kayıt Sırası (Save Queue)
- `src/server/save-queue.ts` sistemi projenin hayatta kalma garantisidir.
- Oyuncuların karakter bilgileri her 5-10 dakikada bir (veya sunucu kapatılırken) topluca veritabanına geçirilir.
- `queueCharacterSave(data)` çağrıldığında veri anında veritabanına yazılmaz, sıraya girer ve döngü bekler.
