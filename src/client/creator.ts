/**
 * SantosRP - Character Creator (Client)
 *
 * KRİTİK: setHeadBlendData / setFaceFeature / setHeadOverlay / setHairColor / setEyeColor
 * SADECE mp.players.local (PlayerMp) üzerinde çalışır.
 * mp.peds.new ile oluşturulan NPC'lerde bu API'lar desteklenmez!
 *
 * Bu yüzden karakter yaratıcıya girildiğinde:
 *   1. auth.ts'in dummyPed + loginCamera'sı yok edilir (client:creatorReady eventi)
 *   2. mp.players.local PREVIEW_POS'a ışınlanır ve görünür yapılır
 *   3. Tüm görünüm değişiklikleri doğrudan localPlayer'a uygulanır
 */
import { loginCamera } from './auth';
import { PREVIEW_POS, PREVIEW_HEADING } from './shared-constants';

// Kollar açık duruş animasyonu
const CREATOR_ANIM_DICT = 'nm@test_character_creator';
const CREATOR_ANIM_CLIP = 'test_idle_ad';

// Timeout korumalı anim dict yükleme
function requestAnimDictSafe(dictName: string, callback: () => void, timeoutMs: number = 5000): void {
  mp.game.streaming.requestAnimDict(dictName);
  
  let timeoutId: ReturnType<typeof setTimeout>;
  let intervalId: ReturnType<typeof setInterval>;
  
  const cleanup = () => {
    clearTimeout(timeoutId);
    clearInterval(intervalId);
  };
  
  timeoutId = setTimeout(() => {
    cleanup();
    mp.console.logError(`[Creator] Animasyon yükleme zaman aşımı: ${dictName} (${timeoutMs}ms)`);
  }, timeoutMs);
  
  intervalId = setInterval(() => {
    if (mp.game.streaming.hasAnimDictLoaded(dictName)) {
      cleanup();
      callback();
    }
  }, 50);
}

function applyCreatorAnim(p: PlayerMp) {
  requestAnimDictSafe(CREATOR_ANIM_DICT, () => {
    // Flag 1 = loop; playback rate 0 = t-pose (ilk frame sabit)
    mp.game.task.playAnim(
      p.handle, CREATOR_ANIM_DICT, CREATOR_ANIM_CLIP,
      8.0, -8.0, -1, 1, 0, false, false, false
    );
  });
}

// Freemode iç çamaşır / çıplak varsayılan bileşenler
function applyNakedDefaults(p: PlayerMp) {
  p.setComponentVariation(3,  15, 0, 2);  // Gövde (torso): çıplak
  p.setComponentVariation(4,  21, 0, 2);  // Bacak: iç çamaşır
  p.setComponentVariation(6,  34, 0, 2);  // Ayak: çıplak
  p.setComponentVariation(7,   0, 0, 2);  // Aksesuar: yok
  p.setComponentVariation(8,  15, 0, 2);  // İç giyim: yok
  p.setComponentVariation(9,   0, 0, 2);  // Zırh: yok
  p.setComponentVariation(10,  0, 0, 2);  // Desen: yok
  p.setComponentVariation(11, 15, 0, 2);  // Üst giyim: yok
}

export function initCreator() {
  let creatorCamera: CameraMp | null = null;

  let camDist    = 1.8;   // Tam vücut görünümü (başlangıç)
  let camZOffset = 0.45;  // Göğüs/bel hizası — tam karakter frame'de
  let camHeading = 0.0;   // Kamera güneyden (karakterin önünden) bakar

  function updateCam() {
    if (!creatorCamera) return;
    const p   = mp.players.local;
    const pos = p.position;
    const rad = camHeading * (Math.PI / 180);
    const cx  = pos.x + Math.sin(rad) * camDist;
    const cy  = pos.y - Math.cos(rad) * camDist;
    const cz  = pos.z + camZOffset;
    creatorCamera.setCoord(cx, cy, cz);
    creatorCamera.pointAtCoord(pos.x, pos.y, pos.z + camZOffset);
  }

  // ---- Kamera / Rotasyon Kontrolleri (CEF → Client) ----
  mp.events.add('client:creatorControl', (action: string, value: number) => {
    const p = mp.players.local;
    if (action === 'rotate') {
      // Kamera SABİT durur, KARAKTER döner — kameraya bakmak gibi hissettirmek için.
      let h = p.getHeading() - value; // eksi: ekranda sağa basınca karakter sola döner
      if (h <   0) h += 360;
      if (h >= 360) h -= 360;
      p.setHeading(h);
      // Ekstra updateCam() çağırmıyoruz: kamera zaten sabit, sadece karakter döndü.
    } else if (action === 'height') {
      camZOffset = Math.max(-0.9, Math.min(0.9, camZOffset + value));
      updateCam();
    } else if (action === 'zoom') {
      camDist = Math.max(0.6, Math.min(2.2, camDist + value));
      updateCam();
    }
  });

  // ---- Karakter Yaratıcı Başlat ----
  mp.events.add('client:startCharacterCreator', (charId: number, gender: number, charDataJson?: string | null) => {
    // Önceki creator kamerasını temizle
    if (creatorCamera) { creatorCamera.destroy(); creatorCamera = null; }

    // auth.ts'e dummyPed'i yok etmesini söyle (loginCamera interp için kalacak)
    mp.events.call('client:creatorReady');

    // LocalPlayer'ı preview pozisyonuna ışınla
    const p = mp.players.local;
    p.freezePosition(false);
    p.setVisible(true, false);
    p.position  = new mp.Vector3(PREVIEW_POS.x, PREVIEW_POS.y, PREVIEW_POS.z);
    p.setHeading(PREVIEW_HEADING);
    p.clearTasksImmediately();
    p.freezePosition(true);

    // Cinsiyet bazlı freemode modeli — çıplak defaults
    const modelHash = mp.game.joaat(gender === 1 ? 'mp_f_freemode_01' : 'mp_m_freemode_01');
    if (p.model !== modelHash) {
      p.model = modelHash;
      p.freezePosition(true);
    }
    applyNakedDefaults(p);

    // Kamera parametrelerini sıfırla
    camDist    = 1.8;
    camZOffset = 0.45;
    camHeading = 0.0;

    // Hedef kamera pozisyonunu hesapla
    const pos = p.position;
    const rad = camHeading * (Math.PI / 180);
    const targetX = pos.x + Math.sin(rad) * camDist;
    const targetY = pos.y - Math.cos(rad) * camDist;
    const targetZ = pos.z + camZOffset;

    // Creator kamerasını hedef pozisyonda oluştur
    creatorCamera = mp.cameras.new(
      'default',
      new mp.Vector3(targetX, targetY, targetZ),
      new mp.Vector3(0, 0, 0),
      50
    );
    creatorCamera.pointAtCoord(pos.x, pos.y, pos.z + camZOffset);

    // Yumuşak geçiş: karakter seçim kamerasından creator kamerasına interp
    if (loginCamera) {
      // loginCamera hala aktif — ondan creator'a yumuşak geçiş yap
      creatorCamera.setActiveWithInterp(
        loginCamera.handle,
        1500,  // süre (ms)
        1,     // easePosition
        1      // easeRotation
      );
      // İnterp bitince eski kamerayı temizle (auth.ts kendi değişkenini yönetsin)
      setTimeout(() => {
        mp.events.call('client:cleanupLoginCamera');
      }, 1600);
    } else {
      // loginCamera yoksa direkt aktifleştir
      creatorCamera.setActive(true);
    }
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    // CEF imleç + odak aç
    mp.gui.cursor.show(true, true);

    // Kısa gecikme ile başlangıç blend + animasyonu uygula
    setTimeout(() => {
      if (charDataJson) {
        mp.events.call('client:updateCreatorAppearance', charDataJson);
      } else {
        p.setHeadBlendData(0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.0, false);
      }
      applyCreatorAnim(p);
    }, 300);
  });

  // ---- Görünüm Güncelle (Canlı Önizleme) ----
  mp.events.add('client:updateCreatorAppearance', (appearanceJson: string) => {
    try {
      const d = JSON.parse(appearanceJson);
      const p = mp.players.local;

      // 1. Model / Cinsiyet
      const targetModel = d.gender === 1
        ? mp.game.joaat('mp_f_freemode_01')
        : mp.game.joaat('mp_m_freemode_01');
      if (p.model !== targetModel) {
        const curH = p.getHeading();
        p.model = targetModel;
        p.setHeading(curH);
        p.clearTasksImmediately();
        applyNakedDefaults(p);
        applyCreatorAnim(p);
        p.freezePosition(true);
      }

      // 2. Genetik / Anne-Baba Karışımı
      // Wiki: thirdMix=0 bırakılmalı yoksa ten beyaza kaçabilir
      p.setHeadBlendData(
        d.mother,   // shapeFirstID  (anne yüz şekli)
        d.father,   // shapeSecondID (baba yüz şekli)
        0,          // shapeThirdID
        d.mother,   // skinFirstID   (anne cilt)
        d.father,   // skinSecondID  (baba cilt)
        0,          // skinThirdID
        d.shapeMix, // 0.0–1.0: 0=tam anne, 1=tam baba
        d.skinMix,  // 0.0–1.0: 0=tam anne teni, 1=tam baba teni
        0.0,        // thirdMix = 0
        false
      );

      // 3. Mikro Yüz Hatları (20 özellik, -1.0 … +1.0)
      const features: number[] = d.features || [];
      for (let i = 0; i < 20; i++) {
        p.setFaceFeature(i, features[i] !== undefined ? features[i] : 0.0);
      }

      // 4. Göz Rengi
      p.setEyeColor(d.eyeColor ?? 0);

      // 5. Saç Stili + Renk + Vurgu
      p.setComponentVariation(2, d.hairStyle ?? 0, 0, 2);
      p.setHairColor(d.hairColor ?? 0, d.hairHighlight ?? 0);

      // 6. Head Overlays
      // setHeadOverlayColor, wiki'ye göre setHeadOverlay'den SONRA çağrılmalı
      // colorType: 1 = saç/kaş/sakal/göğüs kılı,  2 = allık/makyaj/ruj

      // Sakal (overlayID=1, colorType=1)
      if (d.facialHairStyle === 255) {
        p.setHeadOverlay(1, 255, 1.0, 0, 0);
      } else {
        p.setHeadOverlay(1, d.facialHairStyle, d.facialHairOpacity ?? 1.0, 0, 0);
        p.setHeadOverlayColor(1, 1, d.facialHairColor ?? 0, d.facialHairColor ?? 0);
      }

      // Kaş (overlayID=2, colorType=1)
      if (d.eyebrowStyle === 255) {
        p.setHeadOverlay(2, 255, 1.0, 0, 0);
      } else {
        p.setHeadOverlay(2, d.eyebrowStyle, d.eyebrowOpacity ?? 1.0, 0, 0);
        p.setHeadOverlayColor(2, 1, d.eyebrowColor ?? 0, d.eyebrowColor ?? 0);
      }

      // Yaşlanma çizgileri (overlayID=3, renk yok)
      if (d.ageingStyle !== undefined && d.ageingStyle !== 255) {
        p.setHeadOverlay(3, d.ageingStyle, d.ageingOpacity ?? 0.5, 0, 0);
      } else {
        p.setHeadOverlay(3, 255, 1.0, 0, 0);
      }

      // Makyaj (overlayID=4)
      // makeupColorType=0 → renk basma (orijinal/joker tarzı), 2 → renkli
      if (d.makeupStyle === 255) {
        p.setHeadOverlay(4, 255, 1.0, 0, 0);
      } else {
        p.setHeadOverlay(4, d.makeupStyle, d.makeupOpacity ?? 1.0, 0, 0);
        const mcType: number = d.makeupColorType ?? 2;
        if (mcType > 0) {
          p.setHeadOverlayColor(4, mcType, d.makeupColor ?? 0, d.makeupColor ?? 0);
        }
      }

      // Cilt Lekeleri (overlayID=0, renk yok)
      if (d.blemishStyle !== undefined && d.blemishStyle !== 255) {
        p.setHeadOverlay(0, d.blemishStyle, d.blemishOpacity ?? 1.0, 0, 0);
      } else {
        p.setHeadOverlay(0, 255, 1.0, 0, 0);
      }

      // Allık (overlayID=5, colorType=2)
      if (d.blushStyle !== undefined && d.blushStyle !== 255) {
        p.setHeadOverlay(5, d.blushStyle, d.blushOpacity ?? 0.6, 0, 0);
        p.setHeadOverlayColor(5, 2, d.blushColor ?? 0, d.blushColor ?? 0);
      } else {
        p.setHeadOverlay(5, 255, 1.0, 0, 0);
      }

      // Kompleksiyon / Cilt Tipi (overlayID=6, renk yok)
      if (d.complexionStyle !== undefined && d.complexionStyle !== 255) {
        p.setHeadOverlay(6, d.complexionStyle, d.complexionOpacity ?? 1.0, 0, 0);
      } else {
        p.setHeadOverlay(6, 255, 1.0, 0, 0);
      }

      // Güneş Hasarı (overlayID=7, renk yok)
      if (d.sunDamageStyle !== undefined && d.sunDamageStyle !== 255) {
        p.setHeadOverlay(7, d.sunDamageStyle, d.sunDamageOpacity ?? 1.0, 0, 0);
      } else {
        p.setHeadOverlay(7, 255, 1.0, 0, 0);
      }

      // Ruj (overlayID=8, colorType=2)
      if (d.lipstickStyle !== undefined && d.lipstickStyle !== 255) {
        p.setHeadOverlay(8, d.lipstickStyle, d.lipstickOpacity ?? 1.0, 0, 0);
        p.setHeadOverlayColor(8, 2, d.lipstickColor ?? 0, d.lipstickColor ?? 0);
      } else {
        p.setHeadOverlay(8, 255, 1.0, 0, 0);
      }

      // Çiller & Benler (overlayID=9, renk yok)
      if (d.molesStyle !== undefined && d.molesStyle !== 255) {
        p.setHeadOverlay(9, d.molesStyle, d.molesOpacity ?? 1.0, 0, 0);
      } else {
        p.setHeadOverlay(9, 255, 1.0, 0, 0);
      }

      // Göğüs Kılı (overlayID=10, colorType=1)
      if (d.chestHairStyle !== undefined && d.chestHairStyle !== 255) {
        p.setHeadOverlay(10, d.chestHairStyle, d.chestHairOpacity ?? 1.0, 0, 0);
        p.setHeadOverlayColor(10, 1, d.chestHairColor ?? 0, d.chestHairColor ?? 0);
      } else {
        p.setHeadOverlay(10, 255, 1.0, 0, 0);
      }

    } catch (e) {
      mp.console.logError('[Creator] Görünüm güncellenemedi: ' + e);
    }
  });

  // ---- Yüz Kodu Yükle (import) ----
  mp.events.add('client:loadFaceCode', (appearanceJson: string) => {
    mp.events.call('client:updateCreatorAppearance', appearanceJson);
  });

  // ---- Yaratıcıyı Bitir ----
  mp.events.add('client:finishCharacterCreator', (charId: number, appearanceJson: string) => {
    if (creatorCamera) { creatorCamera.destroy(); creatorCamera = null; }
    mp.game.cam.renderScriptCams(false, false, 0, true, false);
    mp.gui.cursor.show(false, false);
    mp.events.callRemote('server:saveCharacterAppearance', charId, appearanceJson);
  });

  // ---- Yaratıcıyı İptal Et ----
  mp.events.add('client:cancelCreator', () => {
    mp.players.local.freezePosition(false);
    // Önce loginCamera'yı temizle (interp'ten kalmış olabilir)
    mp.events.call('client:cleanupLoginCamera');

    // Hedef kamerayı (karakter seçim) oluştur
    mp.events.call('client:createSelectCamera');

    // Animasyonlu geçiş: creator → select
    if (creatorCamera) {
      // auth.ts'deki yeni loginCamera'yı al
      if (loginCamera) {
        loginCamera.setActiveWithInterp(
          creatorCamera.handle,
          1200,
          1,
          1
        );
        mp.game.cam.renderScriptCams(true, false, 0, true, false);
      }
      // İnterp bittikten sonra creator kamerasını temizle
      setTimeout(() => {
        if (creatorCamera) {
          creatorCamera.destroy();
          creatorCamera = null;
        }
        // localPlayer'ı gizle ve dondur
        mp.players.local.setVisible(false, false);
        mp.players.local.freezePosition(true);
      }, 1300);
    } else {
      // creatorCamera yoksa direkt geç
      mp.events.call('client:restoreSelectCamera');
    }
  });

  // ---- Mevcut görünümü uygula (karakter seçim sonrası) ----
  mp.events.add('client:applyAppearance', (appearanceJson: string) => {
    mp.events.call('client:updateCreatorAppearance', appearanceJson);
  });
}
