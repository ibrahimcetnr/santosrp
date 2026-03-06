/**
 * SantosRP - Global Type Definitions
 * Window interface augmentation for RAGE:MP CEF browser
 */

interface RageMP {
  trigger(eventName: string, ...args: any[]): void;
}

interface MinimapAnchor {
  bottom: number;
  left: number;
  width: number;
}

interface HudInitData {
  charName: string;
  playerId: number;
  money: string;
}

interface HudLocationData {
  location: string;
  direction: string;
}

interface HudTimeData {
  time: string;
  date: string;
}

interface HudMoneyData {
  money: string;
}

interface HudMessageData {
  type: string;
  text: string;
}

interface SyncTimeData {
  timestamp: number;
}

interface CommandData {
  name: string;
  syntax: string;
  minLevel: number;
  category: 'player' | 'staff' | 'faction';
  description?: string;
}

declare global {
  interface Window {
    mp?: RageMP;
    
    // HUD Functions
    syncMinimapData?: (bottom: number, left: number, width: number) => void;
    hudInit?: (data: HudInitData) => void;
    hudUpdateLocation?: (data: HudLocationData) => void;
    hudUpdateTime?: (data: HudTimeData) => void;
    hudUpdateMoney?: (data: HudMoneyData) => void;
    hudUpdateMapPosition?: (data: { bottom: number; left: number }) => void;
    openChat?: () => void;
    hudMessage?: (data: HudMessageData) => void;
    
    // Auth Functions
    onLoginSuccess?: (username: string, adminLevel: number, charsJson: string) => void;
    onLoginError?: (message: string) => void;
    
    // Command System
    updateCommandList?: (commands: CommandData[]) => void;
  }
}

export {};
