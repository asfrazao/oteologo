const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

// Simulação de blacklist em memória (use Redis/Mongo em produção)
const refreshBlacklist = new Set();

// Funções para token
function generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET || 'segredo123', { expiresIn: '15m' });
}
function generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refreshsegredo456', { expiresIn: '7d' });
}

// =========== NOVO: Cadastro ===========
router.post('/cadastrar', async (req, res) => {
    console.log('[AUTH] POST /cadastrar | Payload:', { login: req.body.login, nome: req.body.nome });
    try {
        // Validação básica dos campos obrigatórios
        const obrigatorios = ['nome', 'sobrenome', 'nascimento', 'rg', 'cpf', 'celular', 'cep', 'rua', 'numero', 'cidade', 'estado', 'pais', 'login', 'senha'];
        for (const campo of obrigatorios) {
            if (!req.body[campo]) {
                console.warn('[AUTH] Cadastro faltando campo:', campo);
                return res.status(400).json({ msg: `Campo obrigatório faltando: ${campo}` });
            }
        }

        // Verifica se já existe usuário com o mesmo login, RG ou CPF
        const jaExiste = await Usuario.findOne({
            $or: [
                { login: req.body.login },
                { rg: req.body.rg },
                { cpf: req.body.cpf }
            ]
        });
        if (jaExiste) {
            console.warn('[AUTH] Cadastro já existente:', req.body.login);
            return res.status(400).json({ msg: 'Usuário, RG ou CPF já cadastrado.' });
        }

        // Cria usuário no banco
        const novoUsuario = new Usuario({
            ...req.body,
            senha: await bcrypt.hash(req.body.senha, 10)
        });
        await novoUsuario.save();

        console.log('[AUTH] Usuário cadastrado:', novoUsuario.login);
        res.status(201).json({ msg: 'Cadastro realizado com sucesso! Faça login.' });
    } catch (err) {
        console.error('[AUTH] ERRO cadastro:', err);
        res.status(500).json({ msg: 'Erro ao cadastrar usuário.' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    console.log('[AUTH] POST /login | Payload:', { login: req.body.login });
    try {
        // Busca usuário real
        const usuario = await Usuario.findOne({ login: req.body.login });
        if (!usuario || !await bcrypt.compare(req.body.senha, usuario.senha)) {
            console.warn('[AUTH] Login falhou:', req.body.login);
            return res.status(401).json({ msg: 'Credenciais inválidas.' });
        }
        const userPayload = { id: usuario._id, apelido: usuario.login };
        const accessToken = generateAccessToken(userPayload);
        const refreshToken = generateRefreshToken(userPayload);
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false, // true em produção HTTPS
            sameSite: 'strict'
        });
        console.log('[AUTH] Login OK:', req.body.login, '| AccessToken (fim):', accessToken.slice(-10));
        res.json({ accessToken, apelido: usuario.login });
    } catch (err) {
        console.error('[AUTH] ERRO login:', err);
        res.status(500).json({ msg: 'Erro ao logar.' });
    }
});

// REFRESH
router.post('/refresh', (req, res) => {
    const refreshTokenShort = (req.cookies.refreshToken || '').substring(0,12) + '...';
    console.log('[AUTH] POST /refresh | Cookie refreshToken:', refreshTokenShort);
    if (!req.cookies.refreshToken) return res.status(401).json({ msg: 'Refresh token ausente.' });
    if (refreshBlacklist.has(req.cookies.refreshToken)) {
        console.warn('[AUTH] Refresh token na blacklist');
        return res.status(401).json({ msg: 'Refresh token revogado.' });
    }
    try {
        const payload = jwt.verify(req.cookies.refreshToken, process.env.JWT_REFRESH_SECRET || 'refreshsegredo456');
        const newAccessToken = generateAccessToken({ id: payload.id, apelido: payload.apelido });
        console.log('[AUTH] Novo access token gerado via refresh para:', payload.apelido);
        res.json({ accessToken: newAccessToken });
    } catch (err) {
        console.error('[AUTH] Erro ao renovar refresh:', err);
        return res.status(401).json({ msg: 'Refresh token inválido ou expirado.' });
    }
});

// LOGOUT
router.post('/logout', (req, res) => {
    const refreshTokenShort = (req.cookies.refreshToken || '').substring(0,12) + '...';
    if (req.cookies.refreshToken) refreshBlacklist.add(req.cookies.refreshToken);
    res.clearCookie('refreshToken');
    console.log('[AUTH] Logout efetuado | refreshToken:', refreshTokenShort);
    res.json({ msg: 'Logout efetuado.' });
});

module.exports = router;
