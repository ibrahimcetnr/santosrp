"use strict";
/**
 * SantosRP - Client Auth Sistemi
 * Login UI yönetimi, kamera kurulumu
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginCamera = void 0;
exports.getGameBrowser = getGameBrowser;
exports.registerClientAuthEvents = registerClientAuthEvents;
let loginBrowser = null;
exports.loginCamera = null;
// UI'ın yüklü olduğu adres (CEF)
const UI_URL = 'package://santosrp/ui/index.html';
// Giriş kamerası — güneye (şehire) baksın
const CAM_POS = new mp.Vector3(716.81, 1198.80, 359.52);
const CAM_LOOK = new mp.Vector3(350.0, -200.0, 40.0);
function showLoginUI() {
    // Map/Ağaçların/Dokuların yüklenmesi için oyuncunun fiziksel bedenini kameranın yanına ışınla
    // Kameranın kadrajına ayağı veya kafası girmemesi için 5 birim aşağı al ve görünmez yap
    mp.players.local.position = new mp.Vector3(CAM_POS.x, CAM_POS.y, CAM_POS.z - 5.0);
    mp.players.local.setVisible(false, false);
    // Fiziksel hareketi kapat, aşağı düşmesini vs engelle
    mp.players.local.freezePosition(true);
    // CEF browser'ı ÖNCE aç — kamera hatası UI'ı engellemesin
    loginBrowser = mp.browsers.new(UI_URL);
    // HUD ve chat'i gizle
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);
    mp.gui.chat.activate(false);
    // Kamerayı oluştur — başarısız olsa bile browser açık kalır
    try {
        // Kamera yaratılırken doğru yönü baştan ver (pointAtCoord'dan önce 1 frame yanlış çizilmesini önler)
        // CAM_POS → CAM_LOOK: güneye (Z=-180) ve hafif aşağıya (X=-14) bakış
        exports.loginCamera = mp.cameras.new('default', CAM_POS, new mp.Vector3(0, 0, 0), 55.0);
        exports.loginCamera.pointAtCoord(CAM_LOOK.x, CAM_LOOK.y, CAM_LOOK.z);
        exports.loginCamera.setActive(true);
        mp.game.cam.renderScriptCams(true, false, 0, true, false);
    }
    catch (e) {
        console.error('[AUTH-CLIENT] Kamera oluşturulamadı, atlanıyor:', e);
        exports.loginCamera = null;
    }
}
function hideLoginUI() {
    // Beden dondurmasını kaldır ve görünürlüğü aç
    mp.players.local.freezePosition(false);
    mp.players.local.setVisible(true, false);
    // Browser KASITLI olarak korunuyor — App.svelte view='playing' → HUD.svelte render edilir.
    // loginBrowser destroy edilmez; oyun HUD'u olarak kullanılmaya devam eder.
    mp.game.cam.renderScriptCams(false, true, 500, true, false);
    if (exports.loginCamera) {
        exports.loginCamera.setActive(false);
        exports.loginCamera.destroy();
        exports.loginCamera = null;
    }
    mp.game.ui.displayHud(false); // GTA native HUD gizli — özel HUD var
    mp.game.ui.displayRadar(true); // Minimap aktif
    mp.gui.chat.activate(false); // Native chat kapalı — özel chat kullanılıyor
    mp.gui.chat.show(false);
    mp.gui.cursor.show(false, false);
}
/** Oyun HUD browser'ına referans döndürür (hud.ts tarafından kullanılır). */
function getGameBrowser() {
    return loginBrowser;
}
const shared_constants_1 = require("./shared-constants");
function registerClientAuthEvents() {
    mp.events.add('client:showLogin', () => {
        showLoginUI();
    });
    mp.events.add('client:loginSuccess', (username, adminLevel, charsJson) => {
        if (loginBrowser) {
            loginBrowser.execute(`window.onLoginSuccess && window.onLoginSuccess(${JSON.stringify(username)}, ${charsJson})`);
        }
    });
    mp.events.add('client:loginError', (message) => {
        if (loginBrowser) {
            loginBrowser.execute(`window.onLoginError && window.onLoginError(${JSON.stringify(message)})`);
        }
    });
    mp.events.add('browserDomReady', (browser) => {
        if (browser === loginBrowser) {
            setTimeout(() => {
                mp.gui.cursor.show(true, true);
                mp.gui.cursor.visible = true;
            }, 200);
        }
    });
}
// --- CEF to Client to Server Event Proxies ---
mp.events.add('server:tryLogin', (username, pass) => {
    mp.events.callRemote('server:tryLogin', username, pass);
});
mp.events.add('client:previewCharacter', (modelName, charDataJson) => {
    const p = mp.players.local;
    if (exports.loginCamera) {
        exports.loginCamera.setCoord(shared_constants_1.PREVIEW_CAM.x, shared_constants_1.PREVIEW_CAM.y, shared_constants_1.PREVIEW_CAM.z);
        exports.loginCamera.pointAtCoord(shared_constants_1.PREVIEW_POS.x, shared_constants_1.PREVIEW_POS.y, shared_constants_1.PREVIEW_POS.z + 0.25);
    }
    if (charDataJson) {
        // Görünüm kaydedilmiş → localPlayer'a tam appearance uygula
        // (dummyPed, setHeadBlendData / setFaceFeature API'larını desteklemez)
        p.freezePosition(false);
        p.position = new mp.Vector3(shared_constants_1.PREVIEW_POS.x, shared_constants_1.PREVIEW_POS.y, shared_constants_1.PREVIEW_POS.z);
        p.setHeading(shared_constants_1.PREVIEW_HEADING);
        // Sunucudan gelen modelName ile gender'i düzelterek charData'yı güncelle
        // (eski kayıtlarda charData.gender yanlış olabilir)
        try {
            const d = JSON.parse(charDataJson);
            d.gender = modelName === 'mp_f_freemode_01' ? 1 : 0;
            mp.events.call('client:updateCreatorAppearance', JSON.stringify(d));
        }
        catch {
            mp.events.call('client:updateCreatorAppearance', charDataJson);
        }
        p.setVisible(true, false);
        p.freezePosition(true);
        // Karakter yaratıcı animasyonunu uygula
        const ANIM_DICT = 'nm@test_character_creator';
        const ANIM_CLIP = 'test_idle_ad';
        mp.game.streaming.requestAnimDict(ANIM_DICT);
        const t = setInterval(() => {
            if (mp.game.streaming.hasAnimDictLoaded(ANIM_DICT)) {
                clearInterval(t);
                mp.game.task.playAnim(p.handle, ANIM_DICT, ANIM_CLIP, 8.0, -8.0, -1, 1, 0, false, false, false);
            }
        }, 50);
    }
    else {
        // Boş slot / yaratılmamış karakter → localPlayer'ın modelini değiştir
        const modelHash = mp.game.joaat(modelName);
        mp.game.streaming.requestModel(modelHash);
        const waitModel = setInterval(() => {
            if (mp.game.streaming.hasModelLoaded(modelHash)) {
                clearInterval(waitModel);
                p.freezePosition(false);
                p.model = modelHash;
                p.position = new mp.Vector3(shared_constants_1.PREVIEW_POS.x, shared_constants_1.PREVIEW_POS.y, shared_constants_1.PREVIEW_POS.z);
                p.setHeading(shared_constants_1.PREVIEW_HEADING);
                p.setVisible(true, false);
                p.freezePosition(true);
                const ANIM_DICT = 'nm@test_character_creator';
                const ANIM_CLIP = 'test_idle_ad';
                mp.game.streaming.requestAnimDict(ANIM_DICT);
                const waitAnim = setInterval(() => {
                    if (mp.game.streaming.hasAnimDictLoaded(ANIM_DICT)) {
                        clearInterval(waitAnim);
                        mp.game.task.playAnim(p.handle, ANIM_DICT, ANIM_CLIP, 8.0, -8.0, -1, 1, 0, false, false, false);
                    }
                }, 50);
            }
        }, 50);
    }
});
// creator.ts tarafından çağrılır.
// loginCamera'yı HEMEN yok etme — creator.ts setActiveWithInterp için kullanacak
// interp bitince client:cleanupLoginCamera ile temizlenecek
mp.events.add('client:creatorReady', () => {
});
// İnterp bittikten sonra loginCamera'yı güvenli şekilde temizle
mp.events.add('client:cleanupLoginCamera', () => {
    if (exports.loginCamera) {
        exports.loginCamera.setActive(false);
        exports.loginCamera.destroy();
        exports.loginCamera = null;
    }
});
mp.events.add('client:playCharacter', (charId) => {
    mp.events.callRemote('server:playCharacter', charId);
});
// Karakter yaratma iptal edildi → karakter seçim kamerasına geri dön (animasyonsuz)
mp.events.add('client:restoreSelectCamera', () => {
    // localPlayer'ı gizle
    mp.players.local.freezePosition(true);
    mp.players.local.setVisible(false, false);
    if (exports.loginCamera) {
        exports.loginCamera.destroy();
        exports.loginCamera = null;
    }
    mp.players.local.position = new mp.Vector3(shared_constants_1.PREVIEW_CAM.x, shared_constants_1.PREVIEW_CAM.y, shared_constants_1.PREVIEW_CAM.z);
    exports.loginCamera = mp.cameras.new('default', shared_constants_1.PREVIEW_CAM, new mp.Vector3(0, 0, 0), 55.0);
    exports.loginCamera.pointAtCoord(shared_constants_1.PREVIEW_POS.x, shared_constants_1.PREVIEW_POS.y, shared_constants_1.PREVIEW_POS.z + 0.25);
    exports.loginCamera.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);
    mp.gui.cursor.show(true, true);
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);
});
// Sadece karakter seçim kamerasını oluştur (interp geçişi için, hemen aktif etme)
mp.events.add('client:createSelectCamera', () => {
    if (exports.loginCamera) {
        exports.loginCamera.destroy();
        exports.loginCamera = null;
    }
    mp.players.local.position = new mp.Vector3(shared_constants_1.PREVIEW_CAM.x, shared_constants_1.PREVIEW_CAM.y, shared_constants_1.PREVIEW_CAM.z);
    exports.loginCamera = mp.cameras.new('default', shared_constants_1.PREVIEW_CAM, new mp.Vector3(0, 0, 0), 55.0);
    exports.loginCamera.pointAtCoord(shared_constants_1.PREVIEW_POS.x, shared_constants_1.PREVIEW_POS.y, shared_constants_1.PREVIEW_POS.z + 0.25);
    mp.gui.cursor.show(true, true);
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);
});
mp.events.add('client:hideLogin', () => {
    hideLoginUI();
});
//# sourceMappingURL=auth.js.map