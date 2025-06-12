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

const historicoPorSala = {}; // { sala: [ { usuario, mensagem }, ... ] }
const usuarioPorSocket = {}; // { socket.id: { usuario, sala } }

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

// 🌐 Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/salas', require('./routes/salas'));

// 📄 Rotas HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/cadastro', (req, res) => res.sendFile(path.join(__dirname, 'public/cadastro.html')));
app.get('/logout', (req, res) => res.sendFile(path.join(__dirname, 'public/auth.html')));
app.get('/salas', (req, res) => res.sendFile(path.join(__dirname, 'public/salas.html')));
app.get('/criar', (req, res) => res.sendFile(path.join(__dirname, 'public/criar.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public/chat.html')));

// 💬 Socket.IO
io.on('connection', (socket) => {
  console.log('🟢 [SOCKET] Novo usuário conectado');

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

    console.log(`👤 [SOCKET] ${usuario} entrou na sala ${sala}`);

    // ✅ Emitir lista atualizada de usuários na sala
    const usuariosNaSala = Object.values(usuarioPorSocket)
        .filter(u => u.sala === sala)
        .map(u => u.usuario);
    io.to(sala).emit('usuariosNaSala', usuariosNaSala);
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

      let processedMessage = mensagem;

      if (isHighlyOffensive(mensagem)) {
        console.warn(`🚨 [MODERAÇÃO] Mensagem ofensiva de ${usuario}: "${mensagem}"`);
        io.to(sala).emit('mensagem', {
          usuario: 'Sistema',
          mensagem: `A mensagem de ${usuario} foi considerada ofensiva e não será exibida.`
        });
        return;
      }

      processedMessage = filterContent(mensagem);
      const textoFinal = processedMessage.slice(0, 256);
      const msgObj = { usuario, mensagem: textoFinal };

      registrarMensagem(sala, msgObj);
      io.to(sala).emit('mensagem', msgObj);
      console.log(`💬 [CHAT] ${usuario} em ${sala}: "${msgObj.mensagem}"`);
    } else {
      console.warn(`⚠️ [CHAT] Dados incompletos. Sala: ${sala}, Usuário: ${usuario}, Mensagem: ${mensagem}`);
    }
  });

  socket.on('disconnecting', () => {
    const infos = usuarioPorSocket[socket.id];
    if (infos) {
      const { usuario, sala } = infos;

      const msgSaida = { usuario: 'Teologando', mensagem: `${usuario} saiu da sala.` };
      registrarMensagem(sala, msgSaida);
      socket.to(sala).emit('mensagem', msgSaida);
      console.log(`🚪 [SOCKET] ${usuario} saiu da sala ${sala}`);

      // ✅ Emitir lista atualizada após saída
      const usuariosRestantes = Object.values(usuarioPorSocket)
          .filter(u => u.sala === sala && u.usuario !== usuario)
          .map(u => u.usuario);
      io.to(sala).emit("usuariosNaSala", usuariosRestantes);
    } else {
      const salas = [...socket.rooms].slice(1);
      salas.forEach(sala => {
        socket.to(sala).emit('mensagem', { usuario: 'Teologando', mensagem: 'Um usuário saiu da sala.' });
      });
      console.log('🚪 [SOCKET] Um usuário desconectou (sem identificação).');
    }
  });

  socket.on('disconnect', () => {
    delete usuarioPorSocket[socket.id];
    console.log('🔴 [SOCKET] Usuário desconectado');
  });
});

function registrarMensagem(sala, msgObj) {
  if (!historicoPorSala[sala]) historicoPorSala[sala] = [];
  historicoPorSala[sala].push(msgObj);
  if (historicoPorSala[sala].length > 5) {
    historicoPorSala[sala] = historicoPorSala[sala].slice(-5);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.error('❌ [UNCAUGHT EXCEPTION] Erro inesperado:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❗ [UNHANDLED REJECTION] Promessa rejeitada:', reason);
});
