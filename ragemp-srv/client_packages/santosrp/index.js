var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/client/shared-constants.ts
var PREVIEW_POS = new mp.Vector3(402.92, -996.78, -99);
var PREVIEW_CAM = new mp.Vector3(402.92, -998.5, -98.5);
var PREVIEW_HEADING = 178;

// src/client/auth.ts
var loginBrowser = null;
var loginCamera = null;
var UI_URL = "package://santosrp/ui/index.html";
var CAM_POS = new mp.Vector3(716.81, 1198.8, 359.52);
var CAM_LOOK = new mp.Vector3(350, -200, 40);
function showLoginUI() {
  mp.players.local.position = new mp.Vector3(CAM_POS.x, CAM_POS.y, CAM_POS.z - 5);
  mp.players.local.setVisible(false, false);
  mp.players.local.freezePosition(true);
  loginBrowser = mp.browsers.new(UI_URL);
  loginBrowser.markAsChat();
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
  mp.gui.chat.activate(false);
  try {
    loginCamera = mp.cameras.new(
      "default",
      CAM_POS,
      new mp.Vector3(0, 0, 0),
      55
    );
    loginCamera.pointAtCoord(CAM_LOOK.x, CAM_LOOK.y, CAM_LOOK.z);
    loginCamera.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);
  } catch (e) {
    console.error("[AUTH-CLIENT] Kamera olu\u015Fturulamad\u0131, atlan\u0131yor:", e);
    loginCamera = null;
  }
}
function hideLoginUI() {
  mp.players.local.freezePosition(false);
  mp.players.local.setVisible(true, false);
  mp.game.cam.renderScriptCams(false, true, 500, true, false);
  if (loginCamera) {
    loginCamera.setActive(false);
    loginCamera.destroy();
    loginCamera = null;
  }
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(true);
  mp.gui.chat.activate(false);
  mp.gui.chat.show(false);
  mp.gui.cursor.show(false, false);
}
function getGameBrowser() {
  return loginBrowser;
}
function registerClientAuthEvents() {
  mp.events.add("client:showLogin", () => {
    showLoginUI();
  });
  mp.events.add("client:loginSuccess", (username, adminLevel, charsJson) => {
    if (loginBrowser) {
      loginBrowser.execute(
        `window.onLoginSuccess && window.onLoginSuccess(${JSON.stringify(username)}, ${adminLevel}, ${charsJson})`
      );
    }
  });
  mp.events.add("client:updateCommandList", (commandsJson) => {
    if (loginBrowser) {
      loginBrowser.execute(
        `window.updateCommandList && window.updateCommandList(${commandsJson})`
      );
    }
  });
  mp.events.add("client:loginError", (message) => {
    if (loginBrowser) {
      loginBrowser.execute(
        `window.onLoginError && window.onLoginError(${JSON.stringify(message)})`
      );
    }
  });
  mp.events.add("browserDomReady", (browser) => {
    if (browser === loginBrowser) {
      setTimeout(() => {
        mp.gui.cursor.show(true, true);
        mp.gui.cursor.visible = true;
      }, 200);
    }
  });
}
mp.events.add("server:tryLogin", (username, pass) => {
  mp.events.callRemote("server:tryLogin", username, pass);
});
mp.events.add("client:previewCharacter", (modelName, charDataJson) => {
  const p = mp.players.local;
  if (loginCamera) {
    loginCamera.setCoord(PREVIEW_CAM.x, PREVIEW_CAM.y, PREVIEW_CAM.z);
    loginCamera.pointAtCoord(PREVIEW_POS.x, PREVIEW_POS.y, PREVIEW_POS.z + 0.25);
  }
  if (charDataJson) {
    p.freezePosition(false);
    p.position = new mp.Vector3(PREVIEW_POS.x, PREVIEW_POS.y, PREVIEW_POS.z);
    p.setHeading(PREVIEW_HEADING);
    try {
      const d = JSON.parse(charDataJson);
      d.gender = modelName === "mp_f_freemode_01" ? 1 : 0;
      mp.events.call("client:updateCreatorAppearance", JSON.stringify(d));
    } catch {
      mp.events.call("client:updateCreatorAppearance", charDataJson);
    }
    p.setVisible(true, false);
    p.freezePosition(true);
    const ANIM_DICT = "nm@test_character_creator";
    const ANIM_CLIP = "test_idle_ad";
    mp.game.streaming.requestAnimDict(ANIM_DICT);
    const t = setInterval(() => {
      if (mp.game.streaming.hasAnimDictLoaded(ANIM_DICT)) {
        clearInterval(t);
        mp.game.task.playAnim(p.handle, ANIM_DICT, ANIM_CLIP, 8, -8, -1, 1, 0, false, false, false);
      }
    }, 50);
  } else {
    const modelHash = mp.game.joaat(modelName);
    mp.game.streaming.requestModel(modelHash);
    const waitModel = setInterval(() => {
      if (mp.game.streaming.hasModelLoaded(modelHash)) {
        clearInterval(waitModel);
        p.freezePosition(false);
        p.model = modelHash;
        p.position = new mp.Vector3(PREVIEW_POS.x, PREVIEW_POS.y, PREVIEW_POS.z);
        p.setHeading(PREVIEW_HEADING);
        p.setVisible(true, false);
        p.freezePosition(true);
        const ANIM_DICT = "nm@test_character_creator";
        const ANIM_CLIP = "test_idle_ad";
        mp.game.streaming.requestAnimDict(ANIM_DICT);
        const waitAnim = setInterval(() => {
          if (mp.game.streaming.hasAnimDictLoaded(ANIM_DICT)) {
            clearInterval(waitAnim);
            mp.game.task.playAnim(p.handle, ANIM_DICT, ANIM_CLIP, 8, -8, -1, 1, 0, false, false, false);
          }
        }, 50);
      }
    }, 50);
  }
});
mp.events.add("client:creatorReady", () => {
});
mp.events.add("client:cleanupLoginCamera", () => {
  if (loginCamera) {
    loginCamera.setActive(false);
    loginCamera.destroy();
    loginCamera = null;
  }
});
mp.events.add("client:playCharacter", (charId) => {
  mp.events.callRemote("server:playCharacter", charId);
});
mp.events.add("client:restoreSelectCamera", () => {
  mp.players.local.freezePosition(true);
  mp.players.local.setVisible(false, false);
  if (loginCamera) {
    loginCamera.destroy();
    loginCamera = null;
  }
  mp.players.local.position = new mp.Vector3(PREVIEW_CAM.x, PREVIEW_CAM.y, PREVIEW_CAM.z);
  loginCamera = mp.cameras.new("default", PREVIEW_CAM, new mp.Vector3(0, 0, 0), 55);
  loginCamera.pointAtCoord(PREVIEW_POS.x, PREVIEW_POS.y, PREVIEW_POS.z + 0.25);
  loginCamera.setActive(true);
  mp.game.cam.renderScriptCams(true, false, 0, true, false);
  mp.gui.cursor.show(true, true);
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
});
mp.events.add("client:createSelectCamera", () => {
  if (loginCamera) {
    loginCamera.destroy();
    loginCamera = null;
  }
  mp.players.local.position = new mp.Vector3(PREVIEW_CAM.x, PREVIEW_CAM.y, PREVIEW_CAM.z);
  loginCamera = mp.cameras.new("default", PREVIEW_CAM, new mp.Vector3(0, 0, 0), 55);
  loginCamera.pointAtCoord(PREVIEW_POS.x, PREVIEW_POS.y, PREVIEW_POS.z + 0.25);
  mp.gui.cursor.show(true, true);
  mp.game.ui.displayHud(false);
  mp.game.ui.displayRadar(false);
});
mp.events.add("client:hideLogin", () => {
  hideLoginUI();
});

// src/client/minimap.ts
function getMinimapAnchor() {
  let resolution = mp.game.graphics.getScreenActiveResolution(0, 0);
  const screenX = resolution.x;
  const screenY = resolution.y;
  let aspectRatio = mp.game.graphics.getScreenAspectRatio(false);
  if (aspectRatio > 2 || aspectRatio < 1.5) {
    aspectRatio = screenX / screenY;
  }
  const safezone = mp.game.graphics.getSafeZoneSize();
  const safezoneX = Math.round(screenX * (1 - safezone) * 0.5);
  const safezoneY = Math.round(screenY * (1 - safezone) * 0.5);
  const xUnit = 1 / screenX;
  const yUnit = 1 / screenY;
  const minimapWidthInPixels = Math.round(screenX * (xUnit * (screenX / (4 * aspectRatio))));
  const minimapBottomPadding = Math.round(screenY * (yUnit * (screenY / 5.674)));
  const mapHeightPixels = Math.round(screenY / 5.674);
  const left = safezoneX + Math.round(screenX * (1 / 20));
  const bottomPaddingPixels = safezoneY + Math.round(screenY * 0.045);
  const bottom = bottomPaddingPixels + mapHeightPixels;
  return {
    bottom: bottom + 4,
    // Biraz mesafe payı
    left,
    width: minimapWidthInPixels
  };
}

// src/client/hud.ts
var hudActive = false;
function formatMoney(amount) {
  return String(Math.floor(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "$";
}
function headingToDirection(h) {
  const dirs = ["K", "KB", "B", "GB", "G", "GD", "D", "KD"];
  return dirs[Math.round((h % 360 + 360) % 360 / 45) % 8];
}
function sendToHUD(fn, data) {
  const browser = getGameBrowser();
  if (!browser) return;
  try {
    browser.execute(`window.${fn} && window.${fn}(${JSON.stringify(data)})`);
  } catch {
  }
}
function getZoneName() {
  try {
    const raw = mp.players.local.zone;
    if (raw && typeof raw === "string" && raw.length > 0) {
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/_/g, " ");
    }
  } catch {
  }
  return "";
}
var pollInterval = null;
var lastZone = "";
var lastDirection = "";
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    if (!getGameBrowser()) return;
    try {
      const location = getZoneName();
      const direction = headingToDirection(mp.players.local.heading);
      if (location !== lastZone || direction !== lastDirection) {
        lastZone = location;
        lastDirection = direction;
        if (location) sendToHUD("hudUpdateLocation", { location, direction });
      }
    } catch {
    }
  }, 2e3);
}
function initHUD() {
  mp.events.add("client:startHUD", (charName, playerId, money) => {
    hudActive = true;
    setTimeout(() => {
      sendToHUD("hudInit", { charName, playerId, money: formatMoney(money) });
      const anchor = getMinimapAnchor();
      sendToHUD("syncMinimap", anchor);
    }, 800);
    startPolling();
  });
  mp.events.add("client:hudTime", (timeStr, dateStr) => {
    sendToHUD("hudUpdateTime", { time: timeStr, date: dateStr });
  });
  mp.events.add("client:hudMoney", (amount) => {
    sendToHUD("hudUpdateMoney", { money: formatMoney(amount) });
  });
  mp.events.add("client:hudMessage", (msgType, text) => {
    sendToHUD("hudMessage", { type: msgType, text });
  });
  mp.events.add("chat:push", (text) => {
    const browser = getGameBrowser();
    if (!browser) return;
    try {
      browser.execute(`window.addChatMessage && window.addChatMessage(${JSON.stringify(text)})`);
    } catch (err) {
      mp.console.logError(`[CHAT-FAIL] Svelte'e mesaj g\xF6nderilemedi: ${err?.message ?? err}`);
    }
  });
  mp.events.add("render", () => {
    if (!hudActive) return;
    try {
      mp.game.controls.disableControlAction(255, 245, true);
    } catch {
    }
  });
  setInterval(() => {
    if (!hudActive) return;
    try {
      const player = mp.players.local;
      const vehicle = player.vehicle;
      if (!vehicle) {
        sendToHUD("hudVehicle", { inVehicle: false });
        return;
      }
      const speed = Math.round(vehicle.getSpeed() * 3.6);
      sendToHUD("hudVehicle", {
        inVehicle: true,
        speed,
        fuel: vehicle.getVariable("fuel") ?? 100,
        engineOn: !!vehicle.getVariable("engineStatus"),
        isLocked: !!vehicle.getVariable("lockedStatus"),
        seatbelt: !!player.getVariable("seatbelt")
      });
    } catch {
    }
  }, 100);
}

// src/client/nametags.ts
var MAX_DIST_SQ = 400;
var HEAD_BONE_ID = 31086;
var PlayerData = class {
  constructor() {
    __publicField(this, "visible", false);
    __publicField(this, "lastCheck", 0);
    __publicField(this, "charName", "Bilinmeyen");
    __publicField(this, "isTyping", false);
  }
};
var playerCache = /* @__PURE__ */ new Map();
var streamedPlayers = /* @__PURE__ */ new Set();
var streamedArray = [];
var slicingIndex = 0;
var frameCount = 0;
var sharedScreenPos = [0, 0];
var sharedTextOpts = {
  font: 4,
  color: [255, 255, 255, 215],
  scale: [0.3, 0.3],
  outline: true,
  centre: true
};
var sharedTypingOpts = {
  font: 4,
  color: [180, 100, 230, 220],
  scale: [0.25, 0.25],
  outline: true,
  centre: true
};
function initNametags() {
  mp.nametags.enabled = false;
  console.log("[NAMETAG] Zero-Allocation sistemi aktif. RAM y\xFCk\xFC: 0");
  mp.events.addDataHandler("characterName", (entity, value) => {
    if (entity.type === "player") {
      const data = getOrCreateData(entity.remoteId);
      data.charName = value;
    }
  });
  mp.events.addDataHandler("isTyping", (entity, value) => {
    if (entity.type === "player") {
      const data = getOrCreateData(entity.remoteId);
      data.isTyping = value;
    }
  });
}
function getOrCreateData(id) {
  let data = playerCache.get(id);
  if (!data) {
    data = new PlayerData();
    playerCache.set(id, data);
  }
  return data;
}
mp.events.add("entityStreamIn", (entity) => {
  if (entity.type === "player") {
    streamedPlayers.add(entity);
    streamedArray = Array.from(streamedPlayers);
  }
});
mp.events.add("entityStreamOut", (entity) => {
  if (entity.type === "player") {
    streamedPlayers.delete(entity);
    streamedArray = Array.from(streamedPlayers);
    playerCache.delete(entity.remoteId);
  }
});
mp.events.add("render", () => {
  const len = streamedArray.length;
  if (len === 0) return;
  const local = mp.players.local;
  const localPos = local.position;
  const now = Date.now();
  frameCount++;
  slicingIndex = (slicingIndex + 1) % len;
  const target = streamedArray[slicingIndex];
  if (target && target.handle && target !== local && target.alpha !== 0) {
    const tPos = target.position;
    const dx = tPos.x - localPos.x;
    const dy = tPos.y - localPos.y;
    if (dx * dx + dy * dy <= MAX_DIST_SQ) {
      const targetHead = target.getBoneCoords(HEAD_BONE_ID, 0, 0, 0);
      const localHead = local.getBoneCoords(HEAD_BONE_ID, 0, 0, 0);
      const screenTest = mp.game.graphics.world3dToScreen2d(targetHead.x, targetHead.y, targetHead.z);
      const cacheData = getOrCreateData(target.remoteId);
      cacheData.lastCheck = now;
      if (screenTest) {
        cacheData.visible = !mp.raycasting.testPointToPoint(localHead, targetHead, [local.handle, target.handle], 19);
      } else {
        cacheData.visible = false;
      }
    }
  }
  for (let i = 0; i < len; i++) {
    const player = streamedArray[i];
    if (player === local || !player.handle || player.alpha === 0) continue;
    const pId = player.remoteId;
    const cache = playerCache.get(pId);
    if (!cache) {
      const newData = getOrCreateData(pId);
      newData.charName = player.getVariable("characterName") || player.name;
      newData.isTyping = player.getVariable("isTyping") || false;
      continue;
    }
    if (!cache.visible) continue;
    const pPos = player.position;
    const dx = pPos.x - localPos.x;
    const dy = pPos.y - localPos.y;
    const dz = pPos.z - localPos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > MAX_DIST_SQ) continue;
    let drawX = pPos.x;
    let drawY = pPos.y;
    let drawZ = pPos.z + 1.2;
    try {
      const boneCoords = player.getBoneCoords(HEAD_BONE_ID, 0, 0, 0);
      if (boneCoords && boneCoords.z !== 0) {
        drawX = boneCoords.x;
        drawY = boneCoords.y;
        drawZ = boneCoords.z + 0.5;
      }
    } catch (e) {
    }
    const screen = mp.game.graphics.world3dToScreen2d(drawX, drawY, drawZ);
    if (!screen) continue;
    const scale = 0.42 - distSq / MAX_DIST_SQ * 0.2;
    sharedScreenPos[0] = screen.x;
    sharedScreenPos[1] = screen.y;
    sharedTextOpts.scale[0] = scale;
    sharedTextOpts.scale[1] = scale;
    mp.game.graphics.drawText(`${cache.charName} (${pId})`, sharedScreenPos, sharedTextOpts);
    if (cache.isTyping) {
      sharedScreenPos[1] -= 0.035;
      sharedTypingOpts.scale[0] = scale * 0.8;
      sharedTypingOpts.scale[1] = scale * 0.8;
      mp.game.graphics.drawText("* Yaz\u0131yor...", sharedScreenPos, sharedTypingOpts);
    }
  }
});

// src/client/creator.ts
var CREATOR_ANIM_DICT = "nm@test_character_creator";
var CREATOR_ANIM_CLIP = "test_idle_ad";
function requestAnimDictSafe(dictName, callback, timeoutMs = 5e3) {
  mp.game.streaming.requestAnimDict(dictName);
  let timeoutId;
  let intervalId;
  const cleanup = () => {
    clearTimeout(timeoutId);
    clearInterval(intervalId);
  };
  timeoutId = setTimeout(() => {
    cleanup();
    mp.console.logError(`[Creator] Animasyon y\xFCkleme zaman a\u015F\u0131m\u0131: ${dictName} (${timeoutMs}ms)`);
  }, timeoutMs);
  intervalId = setInterval(() => {
    if (mp.game.streaming.hasAnimDictLoaded(dictName)) {
      cleanup();
      callback();
    }
  }, 50);
}
function applyCreatorAnim(p) {
  requestAnimDictSafe(CREATOR_ANIM_DICT, () => {
    mp.game.task.playAnim(
      p.handle,
      CREATOR_ANIM_DICT,
      CREATOR_ANIM_CLIP,
      8,
      -8,
      -1,
      1,
      0,
      false,
      false,
      false
    );
  });
}
function applyNakedDefaults(p) {
  p.setComponentVariation(3, 15, 0, 2);
  p.setComponentVariation(4, 21, 0, 2);
  p.setComponentVariation(6, 34, 0, 2);
  p.setComponentVariation(7, 0, 0, 2);
  p.setComponentVariation(8, 15, 0, 2);
  p.setComponentVariation(9, 0, 0, 2);
  p.setComponentVariation(10, 0, 0, 2);
  p.setComponentVariation(11, 15, 0, 2);
}
function initCreator() {
  let creatorCamera = null;
  let camDist = 1.8;
  let camZOffset = 0.45;
  let camHeading = 0;
  function updateCam() {
    if (!creatorCamera) return;
    const p = mp.players.local;
    const pos = p.position;
    const rad = camHeading * (Math.PI / 180);
    const cx = pos.x + Math.sin(rad) * camDist;
    const cy = pos.y - Math.cos(rad) * camDist;
    const cz = pos.z + camZOffset;
    creatorCamera.setCoord(cx, cy, cz);
    creatorCamera.pointAtCoord(pos.x, pos.y, pos.z + camZOffset);
  }
  mp.events.add("client:creatorControl", (action, value) => {
    const p = mp.players.local;
    if (action === "rotate") {
      let h = p.getHeading() - value;
      if (h < 0) h += 360;
      if (h >= 360) h -= 360;
      p.setHeading(h);
    } else if (action === "height") {
      camZOffset = Math.max(-0.9, Math.min(0.9, camZOffset + value));
      updateCam();
    } else if (action === "zoom") {
      camDist = Math.max(0.6, Math.min(2.2, camDist + value));
      updateCam();
    }
  });
  mp.events.add("client:startCharacterCreator", (charId, gender, charDataJson) => {
    if (creatorCamera) {
      creatorCamera.destroy();
      creatorCamera = null;
    }
    mp.events.call("client:creatorReady");
    const p = mp.players.local;
    p.freezePosition(false);
    p.setVisible(true, false);
    p.position = new mp.Vector3(PREVIEW_POS.x, PREVIEW_POS.y, PREVIEW_POS.z);
    p.setHeading(PREVIEW_HEADING);
    p.clearTasksImmediately();
    p.freezePosition(true);
    const modelHash = mp.game.joaat(gender === 1 ? "mp_f_freemode_01" : "mp_m_freemode_01");
    if (p.model !== modelHash) {
      p.model = modelHash;
      p.freezePosition(true);
    }
    applyNakedDefaults(p);
    camDist = 1.8;
    camZOffset = 0.45;
    camHeading = 0;
    const pos = p.position;
    const rad = camHeading * (Math.PI / 180);
    const targetX = pos.x + Math.sin(rad) * camDist;
    const targetY = pos.y - Math.cos(rad) * camDist;
    const targetZ = pos.z + camZOffset;
    creatorCamera = mp.cameras.new(
      "default",
      new mp.Vector3(targetX, targetY, targetZ),
      new mp.Vector3(0, 0, 0),
      50
    );
    creatorCamera.pointAtCoord(pos.x, pos.y, pos.z + camZOffset);
    if (loginCamera) {
      creatorCamera.setActiveWithInterp(
        loginCamera.handle,
        1500,
        // süre (ms)
        1,
        // easePosition
        1
        // easeRotation
      );
      setTimeout(() => {
        mp.events.call("client:cleanupLoginCamera");
      }, 1600);
    } else {
      creatorCamera.setActive(true);
    }
    mp.game.cam.renderScriptCams(true, false, 0, true, false);
    mp.gui.cursor.show(true, true);
    setTimeout(() => {
      if (charDataJson) {
        mp.events.call("client:updateCreatorAppearance", charDataJson);
      } else {
        p.setHeadBlendData(0, 0, 0, 0, 0, 0, 0.5, 0.5, 0, false);
      }
      applyCreatorAnim(p);
    }, 300);
  });
  mp.events.add("client:updateCreatorAppearance", (appearanceJson) => {
    try {
      const d = JSON.parse(appearanceJson);
      const p = mp.players.local;
      const targetModel = d.gender === 1 ? mp.game.joaat("mp_f_freemode_01") : mp.game.joaat("mp_m_freemode_01");
      if (p.model !== targetModel) {
        const curH = p.getHeading();
        p.model = targetModel;
        p.setHeading(curH);
        p.clearTasksImmediately();
        applyNakedDefaults(p);
        applyCreatorAnim(p);
        p.freezePosition(true);
      }
      p.setHeadBlendData(
        d.mother,
        // shapeFirstID  (anne yüz şekli)
        d.father,
        // shapeSecondID (baba yüz şekli)
        0,
        // shapeThirdID
        d.mother,
        // skinFirstID   (anne cilt)
        d.father,
        // skinSecondID  (baba cilt)
        0,
        // skinThirdID
        d.shapeMix,
        // 0.0–1.0: 0=tam anne, 1=tam baba
        d.skinMix,
        // 0.0–1.0: 0=tam anne teni, 1=tam baba teni
        0,
        // thirdMix = 0
        false
      );
      const features = d.features || [];
      for (let i = 0; i < 20; i++) {
        p.setFaceFeature(i, features[i] !== void 0 ? features[i] : 0);
      }
      p.setEyeColor(d.eyeColor ?? 0);
      p.setComponentVariation(2, d.hairStyle ?? 0, 0, 2);
      p.setHairColor(d.hairColor ?? 0, d.hairHighlight ?? 0);
      if (d.facialHairStyle === 255) {
        p.setHeadOverlay(1, 255, 1, 0, 0);
      } else {
        p.setHeadOverlay(1, d.facialHairStyle, d.facialHairOpacity ?? 1, 0, 0);
        p.setHeadOverlayColor(1, 1, d.facialHairColor ?? 0, d.facialHairColor ?? 0);
      }
      if (d.eyebrowStyle === 255) {
        p.setHeadOverlay(2, 255, 1, 0, 0);
      } else {
        p.setHeadOverlay(2, d.eyebrowStyle, d.eyebrowOpacity ?? 1, 0, 0);
        p.setHeadOverlayColor(2, 1, d.eyebrowColor ?? 0, d.eyebrowColor ?? 0);
      }
      if (d.ageingStyle !== void 0 && d.ageingStyle !== 255) {
        p.setHeadOverlay(3, d.ageingStyle, d.ageingOpacity ?? 0.5, 0, 0);
      } else {
        p.setHeadOverlay(3, 255, 1, 0, 0);
      }
      if (d.makeupStyle === 255) {
        p.setHeadOverlay(4, 255, 1, 0, 0);
      } else {
        p.setHeadOverlay(4, d.makeupStyle, d.makeupOpacity ?? 1, 0, 0);
        const mcType = d.makeupColorType ?? 2;
        if (mcType > 0) {
          p.setHeadOverlayColor(4, mcType, d.makeupColor ?? 0, d.makeupColor ?? 0);
        }
      }
      if (d.blemishStyle !== void 0 && d.blemishStyle !== 255) {
        p.setHeadOverlay(0, d.blemishStyle, d.blemishOpacity ?? 1, 0, 0);
      } else {
        p.setHeadOverlay(0, 255, 1, 0, 0);
      }
      if (d.blushStyle !== void 0 && d.blushStyle !== 255) {
        p.setHeadOverlay(5, d.blushStyle, d.blushOpacity ?? 0.6, 0, 0);
        p.setHeadOverlayColor(5, 2, d.blushColor ?? 0, d.blushColor ?? 0);
      } else {
        p.setHeadOverlay(5, 255, 1, 0, 0);
      }
      if (d.complexionStyle !== void 0 && d.complexionStyle !== 255) {
        p.setHeadOverlay(6, d.complexionStyle, d.complexionOpacity ?? 1, 0, 0);
      } else {
        p.setHeadOverlay(6, 255, 1, 0, 0);
      }
      if (d.sunDamageStyle !== void 0 && d.sunDamageStyle !== 255) {
        p.setHeadOverlay(7, d.sunDamageStyle, d.sunDamageOpacity ?? 1, 0, 0);
      } else {
        p.setHeadOverlay(7, 255, 1, 0, 0);
      }
      if (d.lipstickStyle !== void 0 && d.lipstickStyle !== 255) {
        p.setHeadOverlay(8, d.lipstickStyle, d.lipstickOpacity ?? 1, 0, 0);
        p.setHeadOverlayColor(8, 2, d.lipstickColor ?? 0, d.lipstickColor ?? 0);
      } else {
        p.setHeadOverlay(8, 255, 1, 0, 0);
      }
      if (d.molesStyle !== void 0 && d.molesStyle !== 255) {
        p.setHeadOverlay(9, d.molesStyle, d.molesOpacity ?? 1, 0, 0);
      } else {
        p.setHeadOverlay(9, 255, 1, 0, 0);
      }
      if (d.chestHairStyle !== void 0 && d.chestHairStyle !== 255) {
        p.setHeadOverlay(10, d.chestHairStyle, d.chestHairOpacity ?? 1, 0, 0);
        p.setHeadOverlayColor(10, 1, d.chestHairColor ?? 0, d.chestHairColor ?? 0);
      } else {
        p.setHeadOverlay(10, 255, 1, 0, 0);
      }
    } catch (e) {
      mp.console.logError("[Creator] G\xF6r\xFCn\xFCm g\xFCncellenemedi: " + e);
    }
  });
  mp.events.add("client:loadFaceCode", (appearanceJson) => {
    mp.events.call("client:updateCreatorAppearance", appearanceJson);
  });
  mp.events.add("client:finishCharacterCreator", (charId, appearanceJson) => {
    if (creatorCamera) {
      creatorCamera.destroy();
      creatorCamera = null;
    }
    mp.game.cam.renderScriptCams(false, false, 0, true, false);
    mp.gui.cursor.show(false, false);
    mp.events.callRemote("server:saveCharacterAppearance", charId, appearanceJson);
  });
  mp.events.add("client:cancelCreator", () => {
    mp.players.local.freezePosition(false);
    mp.events.call("client:cleanupLoginCamera");
    mp.events.call("client:createSelectCamera");
    if (creatorCamera) {
      if (loginCamera) {
        loginCamera.setActiveWithInterp(
          creatorCamera.handle,
          1200,
          1,
          1
        );
        mp.game.cam.renderScriptCams(true, false, 0, true, false);
      }
      setTimeout(() => {
        if (creatorCamera) {
          creatorCamera.destroy();
          creatorCamera = null;
        }
        mp.players.local.setVisible(false, false);
        mp.players.local.freezePosition(true);
      }, 1300);
    } else {
      mp.events.call("client:restoreSelectCamera");
    }
  });
  mp.events.add("client:applyAppearance", (appearanceJson) => {
    mp.events.call("client:updateCreatorAppearance", appearanceJson);
  });
}

// src/client/index.ts
mp.gui.chat.activate(false);
mp.gui.chat.show(false);
mp.game.ui.displayHud(false);
mp.game.ui.displayRadar(false);
mp.game.audio.startAudioScene("CHARACTER_CHANGE_IN_SKY_SCENE");
setInterval(() => mp.game.invoke("0xF4F2C0D4EE209E20"), 29500);
mp.game.gameplay.setFadeOutAfterDeath(false);
mp.game.player.setHealthRechargeMultiplier(0);
mp.game.controls.setControlNormal(27, 86, 1);
mp.game.vehicle.defaultEngineBehaviour = false;
mp.players.local.setConfigFlag(429, true);
registerClientAuthEvents();
initHUD();
initNametags();
mp.events.add("browserCreated", (browser) => {
  console.log("[CLIENT] Browser olu\u015Fturuldu.");
});
console.log("[CLIENT] SantosRP client-side ba\u015Flat\u0131ld\u0131!");
initCreator();
function isUIOpen() {
  return mp.gui.cursor.visible || mp.game.ui.isPauseMenuActive();
}
mp.keys.bind(77, true, () => {
  if (isUIOpen()) return;
  mp.events.callRemote("runCommand", "/motor");
});
mp.keys.bind(76, true, () => {
  if (isUIOpen()) return;
  mp.events.callRemote("runCommand", "/kilit");
});
mp.keys.bind(75, true, () => {
  if (isUIOpen()) return;
  if (!mp.players.local.vehicle) return;
  mp.events.callRemote("runCommand", "/kemer");
});
mp.events.add("entityStreamIn", (entity) => {
  if (entity.type !== "vehicle") return;
  const vehicle = entity;
  try {
    mp.game.vehicle.setVehicleEngineOn(vehicle.handle, false, true, true);
    mp.game.vehicle.setVehicleUndriveable(vehicle.handle, true);
  } catch {
  }
});
mp.events.add("playerEnterVehicle", (vehicle, _seat) => {
  if (!vehicle) return;
  try {
    const engineOn = !!vehicle.getVariable("engineStatus");
    mp.game.vehicle.setVehicleEngineOn(vehicle.handle, engineOn, true, true);
    mp.game.vehicle.setVehicleUndriveable(vehicle.handle, !engineOn);
  } catch {
  }
});
mp.events.add("render", () => {
  const player = mp.players.local;
  if (mp.game.invoke("0x475768A975D5AD17", player.handle, 6)) {
    mp.game.controls.disableControlAction(0, 140, true);
    mp.game.controls.disableControlAction(0, 141, true);
    mp.game.controls.disableControlAction(0, 142, true);
  }
  if (player.isTypingInTextChat) {
    mp.game.controls.disableControlAction(0, 199, true);
    mp.game.controls.disableControlAction(0, 200, true);
  }
  player.setStealthMovement(false, "0");
  if (player.vehicle) {
    mp.game.audio.setRadioToStationName("OFF");
    mp.game.audio.setUserRadioControlEnabled(false);
    const hasSeatbelt = !!player.getVariable("seatbelt");
    player.setConfigFlag(32, !hasSeatbelt);
    if (parkingBrakeOn) {
      try {
        mp.game.invoke("0x684785568EF26A22", player.vehicle.handle, true);
      } catch {
      }
    } else {
      try {
        mp.game.invoke("0x684785568EF26A22", player.vehicle.handle, false);
      } catch {
      }
    }
    if (cruiseActive) {
      if (!player.vehicle.engine) {
        cruiseActive = false;
      } else if (mp.game.controls.isControlPressed(0, 72)) {
        cruiseActive = false;
        mp.events.call("chat:push", "!{#94a3b8}[HIZ SAB\u0130TLEY\u0130C\u0130] Fren alg\u0131land\u0131 \u2014 devre d\u0131\u015F\u0131.");
      } else {
        try {
          mp.game.controls.disableControlAction(0, 71, true);
          const vel = player.vehicle.velocity;
          const cur = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
          const diff = cruiseTargetSpeed - cur;
          if (diff > 0.3) {
            mp.game.controls.setControlNormal(0, 71, Math.min(diff * 0.6, 1));
          }
        } catch {
        }
      }
    }
    try {
      const indLeft = !!player.vehicle.getVariable("indLeft");
      const indRight = !!player.vehicle.getVariable("indRight");
      mp.game.vehicle.setVehicleIndicatorLights(player.vehicle.handle, 0, indLeft);
      mp.game.vehicle.setVehicleIndicatorLights(player.vehicle.handle, 1, indRight);
    } catch {
    }
  }
});
mp.events.add("playerEnteringVehicle", (vehicle, seat) => {
  const player = mp.players.local;
  player.setConfigFlag(429, true);
});
mp.events.add("client:vehicle:door", (vehicleId, doorId, open) => {
  const vehicle = mp.vehicles.at(vehicleId);
  if (!vehicle) return;
  try {
    if (open) {
      mp.game.vehicle.setVehicleDoorOpen(vehicle.handle, doorId, false, false);
    } else {
      mp.game.vehicle.setVehicleDoorShut(vehicle.handle, doorId, false);
    }
  } catch {
  }
});
mp.events.add("client:vehicle:window", (vehicleId, winId, down) => {
  const vehicle = mp.vehicles.at(vehicleId);
  if (!vehicle) return;
  try {
    if (down) {
      mp.game.vehicle.rollDownWindow(vehicle.handle, winId);
    } else {
      mp.game.vehicle.rollUpWindow(vehicle.handle, winId);
    }
  } catch {
  }
});
mp.events.add("client:vehicle:blip", (x, y, z, plate) => {
  try {
    const blip = mp.blips.new(66, new mp.Vector3(x, y, z), {
      name: `Ara\xE7: ${plate}`,
      color: 3,
      scale: 1,
      shortRange: false
    });
    let removed = false;
    const removeBlip = () => {
      if (removed) return;
      removed = true;
      try {
        blip.destroy();
      } catch {
      }
      clearInterval(proximityCheck);
    };
    const proximityCheck = setInterval(() => {
      if (!blip) {
        removeBlip();
        return;
      }
      try {
        const pPos = mp.players.local.position;
        const dist = Math.sqrt(
          Math.pow(pPos.x - x, 2) + Math.pow(pPos.y - y, 2) + Math.pow(pPos.z - z, 2)
        );
        if (dist < 30) removeBlip();
      } catch {
        removeBlip();
      }
    }, 2e3);
    setTimeout(removeBlip, 6e4);
  } catch {
  }
});
var parkingBrakeOn = false;
var cruiseActive = false;
var cruiseTargetSpeed = 0;
mp.events.add("playerExitVehicle", (_vehicle, _seat) => {
  parkingBrakeOn = false;
  if (cruiseActive) {
    cruiseActive = false;
    mp.events.call("chat:push", "!{#94a3b8}[HIZ SAB\u0130TLEY\u0130C\u0130] Ara\xE7tan \xE7\u0131k\u0131ld\u0131 \u2014 devre d\u0131\u015F\u0131.");
  }
});
mp.keys.bind(88, true, () => {
  if (isUIOpen() || !mp.players.local.vehicle) return;
  parkingBrakeOn = !parkingBrakeOn;
  mp.events.call("chat:push", parkingBrakeOn ? "!{#ef4444}[EL FREN\u0130] \xC7ekildi." : "!{#94a3b8}[EL FREN\u0130] B\u0131rak\u0131ld\u0131.");
});
mp.keys.bind(190, true, () => {
  if (isUIOpen()) return;
  const veh = mp.players.local.vehicle;
  if (!veh || !veh.engine) return;
  if (!cruiseActive) {
    const vel = veh.velocity;
    const spd = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    if (spd < 3) {
      mp.events.call("chat:push", "!{#fbbf24}[HIZ SAB\u0130TLEY\u0130C\u0130] En az 10 km/h h\u0131zda olun.");
      return;
    }
    cruiseActive = true;
    cruiseTargetSpeed = spd;
    mp.events.call("chat:push", `!{#3b82f6}[HIZ SAB\u0130TLEY\u0130C\u0130] ${Math.round(spd * 3.6)} km/h h\u0131z\u0131nda sabitlendi.`);
  } else {
    cruiseActive = false;
    mp.events.call("chat:push", "!{#94a3b8}[HIZ SAB\u0130TLEY\u0130C\u0130] Devre d\u0131\u015F\u0131.");
  }
});
mp.keys.bind(219, true, () => {
  if (isUIOpen() || !mp.players.local.vehicle) return;
  mp.events.callRemote("vehicle:indicator", "left");
});
mp.keys.bind(221, true, () => {
  if (isUIOpen() || !mp.players.local.vehicle) return;
  mp.events.callRemote("vehicle:indicator", "right");
});
mp.keys.bind(80, true, () => {
  if (isUIOpen() || !mp.players.local.vehicle) return;
  mp.events.callRemote("vehicle:indicator", "hazard");
});
mp.keys.bind(81, true, () => {
  if (isUIOpen() || !mp.players.local.vehicle) return;
  const veh = mp.players.local.vehicle;
  try {
    mp.game.invoke("0x1FD09E7390A74D54", veh.handle, true);
    setTimeout(() => {
      try {
        mp.game.invoke("0x1FD09E7390A74D54", veh.handle, false);
      } catch {
      }
    }, 400);
  } catch {
  }
});
var indicatorTimers = /* @__PURE__ */ new Map();
mp.events.add("entityStreamIn", (entity) => {
  if (entity.type !== "vehicle") return;
  const veh = entity;
  const key = veh.id;
  if (indicatorTimers.has(key)) return;
  const timer = setInterval(() => {
    if (!mp.vehicles.exists(veh)) {
      clearInterval(timer);
      indicatorTimers.delete(key);
      return;
    }
    try {
      const left = !!veh.getVariable("indLeft");
      const right = !!veh.getVariable("indRight");
      mp.game.vehicle.setVehicleIndicatorLights(veh.handle, 0, left);
      mp.game.vehicle.setVehicleIndicatorLights(veh.handle, 1, right);
    } catch {
    }
  }, 150);
  indicatorTimers.set(key, timer);
});
mp.events.add("entityStreamOut", (entity) => {
  if (entity.type !== "vehicle") return;
  const key = entity.id;
  const timer = indicatorTimers.get(key);
  if (timer) {
    clearInterval(timer);
    indicatorTimers.delete(key);
  }
});
