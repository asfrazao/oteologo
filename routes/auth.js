const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Importa o controller de autenticação
const authMiddleware = require('../middleware/auth'); // Se você tiver um middleware de autenticação, importa aqui

// =========== Rotas de Autenticação ===========

// Rota de Cadastro de Novo Usuário
// Esta rota vai chamar a função `cadastrar` do `authController.js`
router.post('/cadastrar', authController.cadastrar);

// Rota de Login de Usuário
// Esta rota vai chamar a função `login` do `authController.js`
router.post('/login', authController.login);

// Rota para Refresh de Token
// Esta rota vai chamar a função `refresh` do `authController.js`
router.post('/refresh', authController.refresh);

// Rota para Logout de Usuário
// Esta rota vai chamar a função `logout` do `authController.js`
router.post('/logout', authController.logout);


// =========== Rotas Mock (se ainda usar) ===========
// Mantenha essas rotas mockadas aqui ou mova para outro arquivo de rotas se forem reais
// Exemplo: se as rotas de sala forem para outro arquivo de rotas, mova os exports.
router.get('/participantes-por-sala', authController.getParticipantesPorSala);
router.post('/entrar-na-sala', authController.entrarNaSala);
router.post('/sair-da-sala', authController.sairDaSala);


module.exports = router;