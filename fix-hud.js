const fs = require('fs');

let content = fs.readFileSync('src/ui/src/components/HUD/HUD.svelte', 'utf8');

// chatAPI objesini global'e ekleyelim
const chatApiObj = `
    window.chatAPI = {
      push: (text) => {
        window.hudMessage({ type: 'system', text: text });
      },
      clear: () => {},
      activate: (toggle) => {},
      show: (toggle) => {}
    };`;

if (!content.includes('window.chatAPI')) {
    content = content.replace("window.hudMessage = (data: { type: string; text: string }) => {", chatApiObj + "\n\n    window.hudMessage = (data: { type: string; text: string }) => {");
    
    // cleanup block
    content = content.replace("delete window.hudMessage;", "delete window.hudMessage;\n      delete window.chatAPI;");

    // Also inject into mp.events if they use it locally:
    const mpEventsObj = `
    const api = {
      "chat:push": window.chatAPI.push,
      "chat:clear": window.chatAPI.clear,
      "chat:activate": window.chatAPI.activate,
      "chat:show": window.chatAPI.show
    };
    for(let fn in api) {
      if (window.mp && window.mp.events) {
        window.mp.events.add(fn, api[fn]);
      }
    }
`;
    // We add this right after chatAPI definition
    content = content.replace("window.chatAPI = {", "window.chatAPI = {"); // marker
}

fs.writeFileSync('src/ui/src/components/HUD/HUD.svelte', content);
console.log("Patched HUD.svelte");
