// routes/bots.js
const express = require("express");
const router = express.Router();
const { iniciarBots, pararBots, botsAtivos } = require("../botManager");

let currentBotConfig = process.env.NUMBER_BOTS || "2";

// Proteção opcional por token (BOTS_ADMIN_TOKEN no .env)
router.use((req, res, next) => {
    const auth = req.headers.authorization;
    const expected = `Bearer ${process.env.BOTS_ADMIN_TOKEN}`;
    if (auth !== expected) {
        return res.status(403).json({ msg: "Acesso negado" });
    }
    next();
});

router.post("/ativar", (req, res) => {
    if (!botsAtivos()) {
        iniciarBots();
        return res.json({ msg: "Bots ativados com sucesso." });
    }
    res.status(400).json({ msg: "Bots já estão em execução." });
});

router.post("/desativar", (req, res) => {
    if (botsAtivos()) {
        pararBots();
        return res.json({ msg: "Bots encerrados com sucesso." });
    }
    res.status(400).json({ msg: "Bots já estão desativados." });
});

router.get("/status", (req, res) => {
    res.json({ ativo: botsAtivos(), configuracaoAtual: currentBotConfig });
});

router.post("/configurar", (req, res) => {
    const novaConfig = req.body.valores;
    if (!novaConfig || typeof novaConfig !== "string" || !/^\d+(,\d+)*$/.test(novaConfig)) {
        return res.status(400).json({ msg: "Formato inválido. Use algo como '2,3,4'" });
    }
    currentBotConfig = novaConfig;
    process.env.NUMBER_BOTS = novaConfig; // Atualiza para o processo atual
    res.json({ msg: "NUMBER_BOTS atualizado", valores: novaConfig });
});

module.exports = router;

// Retorna o intervalo atual dos bots (dinamicamente)
router.get("/intervalo", (req, res) => {
    const range = process.env.BOTS_INTERVAL_RANGE || "20000,30000";
    const [minStr, maxStr] = range.split(",");
    const min = parseInt(minStr.trim()) || 20000;
    const max = parseInt(maxStr.trim()) || 30000;

    res.json({
        intervalo: `${min},${max}`,
        msg: "Intervalo atual dos bots recuperado com sucesso."
    });
});