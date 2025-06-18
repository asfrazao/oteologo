// routes/bots.js
const express = require("express");
const router = express.Router();
const { iniciarBots, pararBots, botsAtivos } = require("../botManager");

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
    res.json({ ativo: botsAtivos() });
});

module.exports = router;
