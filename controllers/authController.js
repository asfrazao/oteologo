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
      { id: usuario._id, login: usuario.login, role: usuario.role }, // Adiciona role ao payload do token
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

// Utilidade: cria refresh token string aleatória
function gerarRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

// Função auxiliar para validação de idade (reutilizável)
function calcularIdade(dataNascimento) {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

exports.cadastrar = async (req, res) => {
  console.log("📝 [AUTH] Recebida requisição de cadastro. Payload:", {
    nome: req.body.nome,
    sobrenome: req.body.sobrenome,
    nascimento: req.body.nascimento,
    email: req.body.email,
    celular: req.body.celular,
    login: req.body.login,
    // Senha não logada por segurança
  });

  try {
    const { nome, sobrenome, nascimento, email, celular, login, senha } = req.body;

    // --- Validações de Backend ---
    const MIN_AGE = 15;
    const EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    const CELULAR_DIGITS_REGEX = /^[0-9]{10,11}$/; // Exemplo: 11 dígitos para SP 9xxxx-xxxx, ou 10 para outros DDDs sem o 9 extra.

    // 1. Campos obrigatórios
    if (!nome || !sobrenome || !nascimento || !email || !celular || !login || !senha) {
      console.warn('⚠️ [AUTH] Erro de validação: Campo obrigatório faltando.');
      return res.status(400).json({ msg: 'Todos os campos são obrigatórios: Nome, Sobrenome, Data de Nascimento, E-mail, Celular, Apelido e Senha.' });
    }

    // 2. Validação de idade
    const idadeUsuario = calcularIdade(nascimento);
    if (isNaN(idadeUsuario) || idadeUsuario < MIN_AGE) {
      console.warn(`⚠️ [AUTH] Erro de validação: Usuário menor de ${MIN_AGE} anos ou data de nascimento inválida.`);
      return res.status(400).json({ msg: `É necessário ter pelo menos ${MIN_AGE} anos para se cadastrar.` });
    }

    // 3. Validação de e-mail
    if (!EMAIL_REGEX.test(email)) {
      console.warn('⚠️ [AUTH] Erro de validação: Formato de e-mail inválido.');
      return res.status(400).json({ msg: 'O formato do e-mail é inválido.' });
    }

    // 4. Validação de celular (apenas dígitos)
    const celularApenasDigitos = celular.replace(/\D/g, ''); // Remove caracteres não numéricos
    if (!CELULAR_DIGITS_REGEX.test(celularApenasDigitos)) {
      console.warn('⚠️ [AUTH] Erro de validação: Formato de celular inválido.');
      return res.status(400).json({ msg: 'O formato do celular é inválido. Use apenas números, incluindo o DDD.' });
    }

    // 5. Verificar duplicidade de apelido e e-mail
    const existeApelido = await Usuario.findOne({ login: login.toLowerCase() }); // Busca por apelido em minúsculas
    if (existeApelido) {
      console.warn('⚠️ [AUTH] Erro de validação: Apelido já em uso.');
      return res.status(400).json({ msg: 'Já existe um usuário cadastrado com esse apelido. Por favor, escolha outro.' });
    }
    const existeEmail = await Usuario.findOne({ email: email.toLowerCase() }); // Busca por e-mail em minúsculas
    if (existeEmail) {
      console.warn('⚠️ [AUTH] Erro de validação: E-mail já em uso.');
      return res.status(400).json({ msg: 'Este e-mail já está em uso por outro usuário.' });
    }
    // FIM das Validações de Backend

    // Hash da senha
    const hash = await bcrypt.hash(senha, 10);
    console.log('🔒 [AUTH] Senha hasheada com sucesso.');

    // Cria novo usuário (garante que login e email sejam salvos em minúsculas)
    const novoUsuario = new Usuario({
      nome,
      sobrenome,
      nascimento,
      email: email.toLowerCase(), // Salva email em minúsculas
      celular: celularApenasDigitos, // Salva celular apenas com dígitos
      login: login.toLowerCase(), // Salva apelido em minúsculas
      senha: hash,
      refreshTokens: [],
      role: 'user' // Define role padrão para novos cadastros
    });

    await novoUsuario.save();
    console.log('✅ [AUTH] Usuário cadastrado com sucesso:', novoUsuario.login);
    res.status(201).json({ msg: 'Usuário cadastrado com sucesso! Você já pode fazer login.' });
  } catch (err) {
    // Tratamento de erro de duplicidade (índice único no MongoDB)
    if (err.code === 11000) {
      const campoDuplicado = Object.keys(err.keyValue)[0];
      let campoMensagem = campoDuplicado;
      if (campoDuplicado === "login") campoMensagem = "apelido";
      if (campoDuplicado === "email") campoMensagem = "e-mail"; // Adiciona tratamento para email
      console.warn(`⚠️ [AUTH] Erro de duplicidade no cadastro: ${campoMensagem} já em uso.`, err.message);
      return res.status(400).json({
        msg: `Já existe um usuário cadastrado com esse(a) ${campoMensagem}.`,
        campo: campoDuplicado
      });
    }
    console.error('❌ [AUTH] Erro interno no cadastro de usuário:', err);
    res.status(500).json({ msg: 'Erro no cadastro. Por favor, tente novamente mais tarde.', erro: err.message });
  }
};

// LOGIN — retorna access e refresh tokens
exports.login = async (req, res) => {
  console.log("🔑 [AUTH] Requisição de login:", req.body);
  try {
    const { login, senha } = req.body;
    if (!login || !senha) {
      return res.status(400).json({ msg: 'Login e senha são obrigatórios.' });
    }

    const usuario = await Usuario.findOne({ login: login.toLowerCase() });
    if (!usuario) {
      return res.status(400).json({ msg: 'Usuário não encontrado.' });
    }

    if (!usuario.senha) {
      console.warn("❌ Usuário encontrado mas senha não definida no banco.");
      return res.status(400).json({ msg: 'Senha não cadastrada para este usuário.' });
    }

    const senhaConfere = await bcrypt.compare(senha, usuario.senha);
    if (!senhaConfere) {
      return res.status(400).json({ msg: 'Senha inválida.' });
    }

    const accessToken = gerarAccessToken(usuario);
    const refreshToken = gerarRefreshToken();

    usuario.refreshTokens = usuario.refreshTokens.filter(rt => new Date(rt.expira) > new Date());
    usuario.refreshTokens.push({
      token: refreshToken,
      expira: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
    });
    await usuario.save();

    return res.status(200).json({
      accessToken,
      refreshToken,
      usuario: {
        id: usuario._id,
        login: usuario.login,
        nome: usuario.nome,
        role: usuario.role
      }
    });
  } catch (err) {
    console.error('❌ [AUTH] Erro ao logar:', err);
    return res.status(500).json({ msg: 'Erro interno ao tentar logar.', erro: err.message });
  }
};


// REFRESH TOKEN — renova access token caso refresh válido
exports.refresh = async (req, res) => {
  console.log("🔄 [AUTH] Recebida requisição de refresh token.");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      console.warn('⚠️ [AUTH] Refresh token não fornecido na requisição de refresh.');
      return res.status(400).json({ msg: 'Refresh token não fornecido.' });
    }
    // Busca o usuário pelo refresh token válido e não expirado
    const usuario = await Usuario.findOne({
      'refreshTokens.token': refreshToken,
      'refreshTokens.expira': { $gt: new Date() }
    });
    if (!usuario.senha) {
      console.warn('⚠️ [AUTH] Usuário sem senha cadastrada:', usuario.login);
      return res.status(400).json({ msg: 'Este usuário foi criado sem senha. Use login social ou redefina sua senha.' });
    }
    const accessToken = gerarAccessToken(usuario);
    console.log('✅ [AUTH] Novo access token gerado via refresh para:', usuario.login);
    res.status(200).json({ accessToken });
  } catch (err) {
    console.error('❌ [AUTH] Erro interno ao renovar token:', err);
    res.status(500).json({ msg: 'Erro ao renovar token. Por favor, tente novamente mais tarde.', erro: err.message });
  }
};

// LOGOUT — remove o refresh token do usuário
exports.logout = async (req, res) => {
  console.log("🚪 [AUTH] Recebida requisição de logout.");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      console.warn('⚠️ [AUTH] Refresh token não fornecido na requisição de logout.');
      return res.status(400).json({ msg: 'Refresh token não fornecido.' });
    }
    const usuario = await Usuario.findOne({ 'refreshTokens.token': refreshToken });
    if (usuario) {
      usuario.refreshTokens = usuario.refreshTokens.filter(rt => rt.token !== refreshToken);
      await usuario.save();
      console.log('✅ [AUTH] Logout realizado com sucesso para usuário:', usuario.login);
    } else {
      console.warn('⚠️ [AUTH] Logout: Refresh token não encontrado para remover.');
    }
    res.status(200).json({ msg: 'Logout realizado com sucesso.' });
  } catch (err) {
    console.error('❌ [AUTH] Erro interno ao fazer logout:', err);
    res.status(500).json({ msg: 'Erro ao fazer logout. Por favor, tente novamente mais tarde.', erro: err.message });
  }
};

// MOCKS para salas
exports.getParticipantesPorSala = async (req, res) => {
  console.log('👥 [MOCK] getParticipantesPorSala (mock)');
  res.status(200).json({ participantes: [] });
};
exports.entrarNaSala = async (req, res) => {
  console.log('➡️ [MOCK] entrarNaSala (mock)');
  res.status(200).json({ msg: 'Entrou na sala (mock)' });
};
exports.sairDaSala = async (req, res) => {
  console.log('⬅️ [MOCK] sairDaSala (mock)');
  res.status(200).json({ msg: 'Saiu da sala (mock)' });
};