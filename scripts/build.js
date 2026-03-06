const { build } = require("esbuild");
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function run() {
    console.log("[BUILD] Server TypeScript derleniyor...");
    cp.execSync("npx tsc --project tsconfig.server.json", { stdio: "inherit" });
    console.log("[OK] Server derlendi → dist/server/");

    console.log("[BUILD] Client TypeScript derleniyor...");
    await build({
        entryPoints: ["src/client/index.ts"],
        bundle: true,
        outfile: "dist/client/index.js",
        target: "es2020",
        format: "esm",
    });
    console.log("[OK] Client derlendi → dist/client/index.js");

    console.log("[BUILD] UI Svelte Vite ile derleniyor...");
    cp.execSync("cd src/ui && npm run build", { stdio: "inherit" });

    // RAGE:MP dosyalarını taşı
    if (fs.existsSync("dist/server")) copyDir("dist/server", "ragemp-srv/packages/santosrp");
    if (fs.existsSync("dist/client")) copyDir("dist/client", "ragemp-srv/client_packages/santosrp");
    
    // index.js dosyası oluştur
    fs.writeFileSync("ragemp-srv/client_packages/index.js", "require('./santosrp/index.js');");
    
    const uiDist = "src/ui/dist";
    const cefTarget = "ragemp-srv/client_packages/santosrp/ui";
    if (fs.existsSync(uiDist)) copyDir(uiDist, cefTarget);

    console.log("[OK] Tüm build bitti. ragemp-srv/ içine kopyalandı!");
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
