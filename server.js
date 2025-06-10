require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Mapa para histórico de mensagens por sala (em memória)
const historicoPorSala = {}; // { sala: [ { usuario, mensagem }, ... ] }
const usuarioPorSocket = {}; // { socket.id: { usuario, sala } }

console.log('[SERVER] Iniciando aplicação...');

// 🔗 Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch((err) => { console.error('[MONGO] Erro:', err); process.exit(1); });

// 🔧 Middlewares
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

// 💬 Socket.IO - comunicação em tempo real
io.on('connection', (socket) => {
  console.log('🟢 [SOCKET] Novo usuário conectado');

  socket.on('entrar', ({ sala, usuario }) => {
    socket.join(sala);
    usuarioPorSocket[socket.id] = { usuario, sala };

    // Envia as últimas 5 mensagens para o usuário que entrou
    const historico = historicoPorSala[sala] || [];
    if (historico.length > 0) {
      socket.emit('historico', historico.slice(-5));
    }

    // Mensagem de entrada na sala
    const msgEntrada = { usuario: 'Teologando', mensagem: `${usuario} entrou na sala.` };
    registrarMensagem(sala, msgEntrada);
    io.to(sala).emit('mensagem', msgEntrada);

    console.log(`👤 [SOCKET] ${usuario} entrou na sala ${sala}`);
  });

  socket.on('mensagem', (data) => {
    const { sala, usuario, mensagem } = data;
    if (sala && usuario && mensagem) {
      const textoFinal = mensagem.slice(0, 256);
      const msgObj = { usuario, mensagem: textoFinal };
      registrarMensagem(sala, msgObj);
      io.to(sala).emit('mensagem', msgObj);
    }
  });

  socket.on('disconnecting', () => {
    const infos = usuarioPorSocket[socket.id];
    if (infos) {
      const { usuario, sala } = infos;
      // Mensagem de saída do usuário
      const msgSaida = { usuario: 'Teologando', mensagem: `${usuario} saiu da sala.` };
      registrarMensagem(sala, msgSaida);
      socket.to(sala).emit('mensagem', msgSaida);
    } else {
      // Mantém fallback anterior
      const salas = [...socket.rooms].slice(1);
      salas.forEach(sala => {
        socket.to(sala).emit('mensagem', { usuario: 'Teologando', mensagem: 'Um usuário saiu da sala.' });
      });
    }
  });

  socket.on('disconnect', () => {
    delete usuarioPorSocket[socket.id];
  });
});

// Função para registrar mensagens no histórico (mantém as últimas 5)
function registrarMensagem(sala, msgObj) {
  if (!historicoPorSala[sala]) historicoPorSala[sala] = [];
  historicoPorSala[sala].push(msgObj);
  if (historicoPorSala[sala].length > 5) historicoPorSala[sala] = historicoPorSala[sala].slice(-5);
}

// 🚀 Inicialização do servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

// Logs de exceção global
process.on('uncaughtException', (err) => {
  console.error('=== [UNCAUGHT EXCEPTION] ===', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('=== [UNHANDLED REJECTION] ===', reason);
});
