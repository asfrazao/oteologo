const Usuario = require('../models/Usuario');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Tempo do access token: 15 minutos (ou ajuste para 30min se quiser)
const ACCESS_TOKEN_EXPIRES = '15m';
// Tempo do refresh token: 7 dias (no frontend, pode manter por 7 dias)
const REFRESH_TOKEN_EXPIRES_DAYS = 7;

// Utilidade: cria access token JWT
function gerarAccessToken(usuario) {
  return jwt.sign(
      { id: usuario._id, login: usuario.login },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

// Utilidade: cria refresh token string aleatória
function gerarRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

exports.cadastrar = async (req, res) => {
  console.log("REQ BODY:", req.body);

  try {
    const { login, senha, nome } = req.body;
    if (!login || !senha || !nome) {
      return res.status(400).json({ msg: 'Login, senha e nome são obrigatórios.' });
    }
    const existe = await Usuario.findOne({ login });
    if (existe) {
      return res.status(400).json({ msg: 'Já existe um usuário cadastrado com esse apelido.' });
    }
    const hash = await bcrypt.hash(senha, 10);
    const novoUsuario = new Usuario({ ...req.body, senha: hash, refreshTokens: [] });
    await novoUsuario.save();
    res.status(201).json({ msg: 'Usuário cadastrado com sucesso!' });
  } catch (err) {
    if (err.code === 11000) {
      const campoDuplicado = Object.keys(err.keyValue)[0];
      let campoMensagem = campoDuplicado;
      if (campoDuplicado === "login") campoMensagem = "apelido";
      if (campoDuplicado === "cpf") campoMensagem = "CPF";
      if (campoDuplicado === "rg") campoMensagem = "RG";
      return res.status(400).json({
        msg: `Já existe um usuário cadastrado com esse(a) ${campoMensagem}.`,
        campo: campoDuplicado
      });
    }
    console.error('[Cadastro usuário erro]', err);
    res.status(500).json({ msg: 'Erro no cadastro', erro: err.message });
  }
};

// LOGIN — retorna access e refresh tokens
exports.login = async (req, res) => {
  try {
    const { login, senha } = req.body;
    const usuario = await Usuario.findOne({ login });
    if (!usuario) {
      return res.status(400).json({ msg: 'Usuário não encontrado.' });
    }
    const senhaConfere = await bcrypt.compare(senha, usuario.senha);
    if (!senhaConfere) {
      return res.status(400).json({ msg: 'Senha inválida.' });
    }

    // Gera tokens
    const accessToken = gerarAccessToken(usuario);
    const refreshToken = gerarRefreshToken();

    // Salva o refresh token (com data de expiração no futuro)
    usuario.refreshTokens.push({
      token: refreshToken,
      expira: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
    });
    await usuario.save();

    res.status(200).json({
      accessToken,
      refreshToken,
      usuario: {
        id: usuario._id,
        login: usuario.login,
        nome: usuario.nome
      }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao logar.', erro: err.message });
  }
};

// REFRESH TOKEN — renova access token caso refresh válido
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ msg: 'Refresh token não fornecido.' });
    }
    // Busca o usuário pelo refresh token válido e não expirado
    const usuario = await Usuario.findOne({
      'refreshTokens.token': refreshToken,
      'refreshTokens.expira': { $gt: new Date() }
    });
    if (!usuario) {
      return res.status(401).json({ msg: 'Refresh token inválido ou expirado. Faça login novamente.' });
    }
    const accessToken = gerarAccessToken(usuario);
    res.status(200).json({ accessToken });
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao renovar token.', erro: err.message });
  }
};

// LOGOUT — remove o refresh token do usuário
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ msg: 'Refresh token não fornecido.' });
    }
    const usuario = await Usuario.findOne({ 'refreshTokens.token': refreshToken });
    if (usuario) {
      usuario.refreshTokens = usuario.refreshTokens.filter(rt => rt.token !== refreshToken);
      await usuario.save();
    }
    res.status(200).json({ msg: 'Logout realizado com sucesso.' });
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao fazer logout.', erro: err.message });
  }
};

// MOCKS para salas
exports.getParticipantesPorSala = async (req, res) => {
  res.status(200).json({ participantes: [] });
};
exports.entrarNaSala = async (req, res) => {
  res.status(200).json({ msg: 'Entrou na sala (mock)' });
};
exports.sairDaSala = async (req, res) => {
  res.status(200).json({ msg: 'Saiu da sala (mock)' });
};
