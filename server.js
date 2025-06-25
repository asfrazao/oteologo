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
const salas = {}; // ✅ Adicionando isso corrige o erro!
const usuariosPorSala = {}; // ✅ Também necessário, pois você usa isso no socket.on('entrar')


console.log('[SERVER] Iniciando aplicação...');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado com sucesso'))
    .catch((err) => {
      console.error('❌ Erro ao conectar ao MongoDB:', err.message);
      process.exit(1);
    });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/salas', require('./routes/salas'));
app.use('/api/google-login', require('./routes/googleLogin'));
//app.use('/api/auth', require('./routes/authLogin'));


// Rotas HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/cadastro', (req, res) => res.sendFile(path.join(__dirname, 'public/cadastro.html')));
app.get('/logout', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/salas', (req, res) => res.sendFile(path.join(__dirname, 'public/salas.html')));
app.get('/criar', (req, res) => res.sendFile(path.join(__dirname, 'public/criar.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public/chat.html')));

// Socket.IO
io.on('connection', (socket) => {
  socket.emit("usuariosNaSala", gerarMapaDeSalas());

  socket.on('entrar', ({ sala, usuario, avatar }) => {
    socket.join(sala);
    usuarioPorSocket[socket.id] = { usuario, sala, avatar };

    if (!salas[sala]) salas[sala] = [];

    const msgEntrada = {
      usuario: 'O Teólogo disse',
      mensagem: `${usuario} entrou na sala.`,
      avatar: ''
    };
    registrarMensagem(sala, msgEntrada);
    io.to(sala).emit('mensagem', msgEntrada);

    if (!usuariosPorSala[sala]) usuariosPorSala[sala] = [];

    if (!usuariosPorSala[sala].includes(usuario)) {
      usuariosPorSala[sala].push(usuario);
    }

    // Histórico da sala
    socket.emit('historico', salas[sala]);

    // Atualiza lista da sala local
    io.to(sala).emit('usuariosNaSala', usuariosPorSala[sala]);

    // ✅ Atualiza a tela principal (salas fixas)
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
      const avatar = usuarioPorSocket[socket.id]?.avatar || '';

      const msgObj = { usuario, mensagem: texto, avatar };
      if (destinatario) msgObj.destinatario = destinatario;

      registrarMensagem(sala, msgObj);
      io.to(sala).emit('mensagem', msgObj);
      console.log(`💬 ${usuario} em ${sala}: "${texto}"`);
    }
  });

  socket.on('disconnecting', () => {
    const infos = usuarioPorSocket[socket.id];
    if (infos) {
      const { usuario, sala } = infos;
      console.log(`🚪 ${usuario} saiu da sala ${sala}`);

      // ✅ Atualiza mapa geral ao desconectar
      emitirTodosUsuariosPorSala();
    }
  });

  socket.on('disconnect', () => {
    delete usuarioPorSocket[socket.id];
    console.log('🔴 Usuário desconectado');
  });

});

function registrarMensagem(sala, msgObj) {
  if (!historicoPorSala[sala]) historicoPorSala[sala] = [];
  historicoPorSala[sala].push(msgObj);
  if (historicoPorSala[sala].length > 5) {
    historicoPorSala[sala] = historicoPorSala[sala].slice(-5);
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

// Bots (se habilitado no .env)
if (process.env.ENABLE_BOTS === "true") {
  const { spawn } = require("child_process");
  const botPath = path.join(__dirname, "bots", "bots.js");
  const botProcess = spawn(`node "${botPath}"`, { stdio: "inherit", shell: true });
}
app.use("/api/bots", require("./routes/bots"));

// Rota de configuração dos bots
const botsConfig = {
  intervalMin: parseInt(process.env.BOTS_INTERVAL_RANGE?.split(",")[0]) || 20000,
  intervalMax: parseInt(process.env.BOTS_INTERVAL_RANGE?.split(",")[1]) || 30000,
};

app.get('/api/bots/intervalo', (req, res) => {
  res.json({
    intervalo: `${botsConfig.intervalMin},${botsConfig.intervalMax}`
  });
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
