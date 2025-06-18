// botManager.js
const { spawn } = require("child_process");
let botProcess = null;

function iniciarBots() {
    if (botProcess) return;
    const path = require("path");
    const botPath = path.join(__dirname, "bots", "bots.js");
    botProcess = spawn("node", [botPath], { stdio: "inherit" });
    console.log("[BOT MANAGER] Bots iniciados.");
}

function pararBots() {
    if (botProcess) {
        botProcess.kill();
        botProcess = null;
        console.log("[BOT MANAGER] Bots encerrados.");
    }
}

function botsAtivos() {
    return !!botProcess;
}

module.exports = { iniciarBots, pararBots, botsAtivos };
