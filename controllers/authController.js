const Usuario = require('../models/Usuario');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRES = '2h';
const REFRESH_TOKEN_EXPIRES_DAYS = 7;

function gerarAccessToken(usuario) {
  return jwt.sign(
      { id: usuario._id, login: usuario.login, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

function gerarRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function calcularIdade(dataNascimento) {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

exports.cadastrar = async (req, res) => {
  try {
    const { nome, sobrenome, nascimento, email, celular, login, senha } = req.body;

    if (!nome || !sobrenome || !nascimento || !email || !celular || !login || !senha)
      return res.status(400).json({ msg: 'Todos os campos são obrigatórios.' });

    if (calcularIdade(nascimento) < 15)
      return res.status(400).json({ msg: 'É necessário ter pelo menos 15 anos para se cadastrar.' });

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_REGEX.test(email))
      return res.status(400).json({ msg: 'Formato de e-mail inválido.' });

    const celularLimpo = celular.replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(celularLimpo))
      return res.status(400).json({ msg: 'Número de celular inválido.' });

    const existeLogin = await Usuario.findOne({ login: login.toLowerCase() });
    if (existeLogin)
      return res.status(400).json({ msg: 'Esse apelido já está em uso.' });

    const existeEmail = await Usuario.findOne({ email: email.toLowerCase() });
    if (existeEmail)
      return res.status(400).json({ msg: 'Esse e-mail já está em uso.' });

    const hash = await bcrypt.hash(senha, 10);

    const novoUsuario = new Usuario({
      nome,
      sobrenome,
      nascimento,
      email: email.toLowerCase(),
      celular: celularLimpo,
      login: login.toLowerCase(),
      senha: hash,
      perfil: 'usuario',
      refreshTokens: []
    });

    await novoUsuario.save();
    res.status(201).json({ msg: 'Usuário cadastrado com sucesso!' });

  } catch (err) {
    if (err.code === 11000) {
      const campo = Object.keys(err.keyValue)[0];
      const msg = campo === 'email' ? 'E-mail já em uso.' : 'Apelido já em uso.';
      return res.status(400).json({ msg });
    }
    console.error('Erro ao cadastrar usuário:', err);
    res.status(500).json({ msg: 'Erro interno no servidor.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { login, senha } = req.body;
    const usuario = await Usuario.findOne({ login: login.toLowerCase() });
    if (!usuario)
      return res.status(400).json({ msg: 'Usuário não encontrado.' });

    const senhaConfere = await bcrypt.compare(senha, usuario.senha);
    if (!senhaConfere)
      return res.status(400).json({ msg: 'Senha inválida.' });

    const accessToken = gerarAccessToken(usuario);
    const refreshToken = gerarRefreshToken();

    // ✅ Correção aqui: refreshTokens sempre é array
    usuario.refreshTokens = Array.isArray(usuario.refreshTokens) ? usuario.refreshTokens : [];

    usuario.refreshTokens = usuario.refreshTokens.filter(rt => new Date(rt.expira) > new Date());
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
        nome: usuario.nome,
        perfil: usuario.perfil
      }
    });
  } catch (err) {
    console.error('Erro ao logar:', err);
    res.status(500).json({ msg: 'Erro ao logar. Tente novamente mais tarde.' });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ msg: 'Refresh token não fornecido.' });

    const usuario = await Usuario.findOne({
      'refreshTokens.token': refreshToken,
      'refreshTokens.expira': { $gt: new Date() }
    });

    if (!usuario)
      return res.status(401).json({ msg: 'Token inválido ou expirado.' });

    const newAccessToken = gerarAccessToken(usuario);
    res.status(200).json({ accessToken: newAccessToken });

  } catch (err) {
    console.error('Erro ao renovar token:', err);
    res.status(500).json({ msg: 'Erro interno. Tente novamente.' });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ msg: 'Token não enviado.' });

    const usuario = await Usuario.findOne({ 'refreshTokens.token': refreshToken });
    if (usuario) {
      usuario.refreshTokens = usuario.refreshTokens.filter(rt => rt.token !== refreshToken);
      await usuario.save();
    }
    res.status(200).json({ msg: 'Logout realizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao fazer logout:', err);
    res.status(500).json({ msg: 'Erro ao sair. Tente novamente.' });
  }
};

// Mock para rotas de salas
exports.getParticipantesPorSala = async (req, res) => {
  res.status(200).json({ participantes: [] });
};

exports.entrarNaSala = async (req, res) => {
  res.status(200).json({ msg: 'Entrou na sala (mock)' });
};

exports.sairDaSala = async (req, res) => {
  res.status(200).json({ msg: 'Saiu da sala (mock)' });
};
