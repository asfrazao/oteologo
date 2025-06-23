const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ROTAS DE AUTENTICAÇÃO
router.post('/cadastrar', authController.cadastrar);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// ROTAS MOCK (opcional – pode remover se não usa mais)
router.get('/participantes-por-sala', authController.getParticipantesPorSala);
router.post('/entrar-na-sala', authController.entrarNaSala);
router.post('/sair-da-sala', authController.sairDaSala);

module.exports = router;
