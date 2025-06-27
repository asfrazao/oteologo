require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const { filterContent, isHighlyOffensive } = require('./utils/contentFilter');
const { checkMessageFrequency } = require('./utils/messageFrequency');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const historicoPorSala = {};
const usuarioPorSocket = {};

const {
  monitorarInatividadePorSala,
  adicionarUsuario,
  removerUsuario,
  criarSala,
  salas,
  gerarIdSala
} = require('./utils/salaManager');

console.log('[SERVER] Iniciando aplicação...');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado com sucesso'))
    .catch((err) => {
      console.error('❌ Erro ao conectar ao MongoDB:', err.message);
      process.exit(1);
    });

app.use((req, res, next) => {
  const ua = req.get('User-Agent') || '';
  if (ua.includes('facebookexternalhit')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/salas', require('./routes/salas'));
app.use('/api/google-login', require('./routes/googleLogin'));

// Rotas HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/cadastro', (req, res) => res.sendFile(path.join(__dirname, 'public/cadastro.html')));
app.get('/logout', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/salas', (req, res) => res.sendFile(path.join(__dirname, 'public/salas.html')));
app.get('/criar', (req, res) => res.sendFile(path.join(__dirname, 'public/criar.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public/chat.html')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public/img/favicon.png')));


// Socket.IO
io.on('connection', (socket) => {
  socket.emit("usuariosNaSala", gerarMapaDeSalas());

  socket.on('entrar', ({ sala, usuario, avatar }) => {
    socket.join(sala);
    usuarioPorSocket[socket.id] = { usuario, sala, avatar };

    const msgEntrada = { usuario: 'O Teólogo disse', mensagem: `${usuario} entrou na sala.` };
    registrarMensagem(sala, msgEntrada);

    adicionarUsuario(sala, socket.id, usuario);
    monitorarInatividadePorSala.iniciar(gerarIdSala(sala));

    const historico = historicoPorSala[sala] || [];
    const historicoFiltrado = historico.filter(m => !m.mensagem.includes(`${usuario} entrou na sala.`));
    socket.emit('historico', historicoFiltrado);

    io.to(sala).emit('mensagem', msgEntrada);
    console.log(`👤 ${usuario} entrou na sala ${sala}`);
    emitirTodosUsuariosPorSala();
  });

  socket.on('mensagem', (data) => {
    const { sala, usuario, mensagem } = data;
    if (sala && usuario && mensagem) {
      if (checkMessageFrequency(sala, usuario, mensagem)) {
        socket.emit('mensagem', {
          usuario: 'O Teólogo disse ao ' + usuario,
          mensagem: 'Você está enviando mensagens muito repetidas. Por favor, aguarde.'
        });
        console.warn(`🚫 [FLOOD] "${usuario}" na sala "${sala}" bloqueado por repetição.`);
        return;
      }

      let texto = filterContent(mensagem);
      if (isHighlyOffensive(texto)) {
        io.to(sala).emit('mensagem', {
          usuario: 'Sistema',
          mensagem: `A mensagem de ${usuario} foi considerada ofensiva e não será exibida.`
        });
        return;
      }

      texto = texto.slice(0, 256);
      const match = texto.match(/@(\w{2,})/);
      const destinatario = match ? match[1] : null;

      const msgObj = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        usuario,
        mensagem: texto,
        avatar: usuarioPorSocket[socket.id]?.avatar || ""
      };
      if (destinatario) msgObj.destinatario = destinatario;

      registrarMensagem(sala, msgObj);
      io.to(sala).emit('mensagem', msgObj);
      monitorarInatividadePorSala.iniciar(gerarIdSala(sala));
      console.log(`💬 ${usuario} em ${sala}: "${texto}"`);
    }
  });

  socket.on("editarMensagem", ({ sala, id, novaMensagem }) => {
    const mensagens = historicoPorSala[sala];
    if (!mensagens) return;
    const msg = mensagens.find(m => m.id === id);
    if (msg && msg.usuario === usuarioPorSocket[socket.id]?.usuario) {
      msg.mensagem = novaMensagem;
      io.to(sala).emit("mensagem", msg);
    }
  });

  socket.on("apagarMensagem", ({ sala, id }) => {
    const mensagens = historicoPorSala[sala];
    if (!mensagens) return;
    const index = mensagens.findIndex(m => m.id === id);
    if (index !== -1 && mensagens[index].usuario === usuarioPorSocket[socket.id]?.usuario) {
      mensagens.splice(index, 1);
      io.to(sala).emit("mensagemApagada", { id });
    }
  });

  socket.on('disconnecting', () => {
    const infos = usuarioPorSocket[socket.id];
    if (infos) {
      const { usuario, sala } = infos;

      const msgSaida = { usuario: 'O Teólogo disse', mensagem: `${usuario} saiu da sala.` };
      registrarMensagem(sala, msgSaida);
      io.to(sala).emit('mensagem', msgSaida);

      console.log(`🚪 ${usuario} saiu da sala ${sala}`);
      emitirTodosUsuariosPorSala();
    }
  });

  socket.on('disconnect', () => {
    delete usuarioPorSocket[socket.id];
    removerUsuario(socket.id);
    console.log('🔴 Usuário desconectado');
  });
});

// Funções auxiliares
function registrarMensagem(sala, msgObj) {
  if (!historicoPorSala[sala]) historicoPorSala[sala] = [];

  if (!msgObj.id) {
    msgObj.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  historicoPorSala[sala].push(msgObj);
  if (historicoPorSala[sala].length > 50) {
    historicoPorSala[sala] = historicoPorSala[sala].slice(-50);
  }
}

function emitirTodosUsuariosPorSala() {
  io.emit("usuariosNaSala", gerarMapaDeSalas());
}

function gerarMapaDeSalas() {
  const mapa = {};
  for (const { usuario, sala } of Object.values(usuarioPorSocket)) {
    if (!mapa[sala]) mapa[sala] = [];
    mapa[sala].push(usuario);
  }
  return mapa;
}

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

// Tratamento de erros
process.on('uncaughtException', (err) => {
  console.error('❌ Erro não tratado:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('❗ Promessa rejeitada:', reason);
});

// Expor o io para uso externo (como em salaManager.js)
module.exports.getIO = () => io;

// Bots
if (process.env.ENABLE_BOTS === "true") {
  const { spawn } = require("child_process");
  const botPath = path.join(__dirname, "bots", "bots.js");
  spawn(`node "${botPath}"`, { stdio: "inherit", shell: true });
}
app.use("/api/bots", require("./routes/bots"));

const botsConfig = {
  intervalMin: parseInt(process.env.BOTS_INTERVAL_RANGE?.split(",")[0]) || 20000,
  intervalMax: parseInt(process.env.BOTS_INTERVAL_RANGE?.split(",")[1]) || 30000,
};

app.get('/api/bots/intervalo', (req, res) => {
  res.json({ intervalo: `${botsConfig.intervalMin},${botsConfig.intervalMax}` });
});

app.post('/api/bots/intervalo', (req, res) => {
  const auth = req.headers.authorization || "";
  if (!auth.includes("supertoken123")) {
    return res.status(401).json({ msg: "Não autorizado" });
  }

  const { intervalo } = req.body;
  const [minStr, maxStr] = intervalo?.split(",") || [];
  const min = parseInt(minStr);
  const max = parseInt(maxStr);
  if (isNaN(min) || isNaN(max) || min < 5000 || max < min) {
    return res.status(400).json({ msg: "Intervalo inválido" });
  }

  botsConfig.intervalMin = min;
  botsConfig.intervalMax = max;
  res.json({ msg: "Intervalo atualizado com sucesso", intervalo: `${min},${max}` });
});
