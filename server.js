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
  // 🔄 Emite o mapa de usuários por sala imediatamente ao conectar
  socket.emit("usuariosNaSala", gerarMapaDeSalas());

  socket.on('entrar', ({ sala, usuario }) => {
    socket.join(sala);
    usuarioPorSocket[socket.id] = { usuario, sala };

    const historico = historicoPorSala[sala] || [];
    if (historico.length > 0) {
      socket.emit('historico', historico.slice(-5));
    }

    const msgEntrada = { usuario: 'Teologando', mensagem: `${usuario} entrou na sala.` };
    registrarMensagem(sala, msgEntrada);
    io.to(sala).emit('mensagem', msgEntrada);

    console.log(`👤 ${usuario} entrou na sala ${sala}`);
    emitirTodosUsuariosPorSala();
  });

  socket.on('mensagem', (data) => {
    const { sala, usuario, mensagem } = data;
    if (sala && usuario && mensagem) {
      if (checkMessageFrequency(sala, usuario, mensagem)) {
        socket.emit('mensagem', {
          usuario: 'O Teólogo',
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
      const msgObj = { usuario, mensagem: texto };
      registrarMensagem(sala, msgObj);
      io.to(sala).emit('mensagem', msgObj);
      console.log(`💬 ${usuario} em ${sala}: "${texto}"`);
    }
  });

  socket.on('disconnecting', () => {
    const infos = usuarioPorSocket[socket.id];
    if (infos) {
      const { usuario, sala } = infos;
      const msgSaida = { usuario: 'Teologando', mensagem: `${usuario} saiu da sala.` };
      registrarMensagem(sala, msgSaida);
      socket.to(sala).emit('mensagem', msgSaida);
      console.log(`🚪 ${usuario} saiu da sala ${sala}`);
    }
  });

  socket.on('disconnect', () => {
    delete usuarioPorSocket[socket.id];
    emitirTodosUsuariosPorSala();
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
