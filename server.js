require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const { filterContent, isHighlyOffensive } = require('./utils/contentFilter'); // Importa o filtro de conteúdo
const { checkMessageFrequency, clearUserHistory } = require('./utils/messageFrequency'); // Importa o controle de frequência

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Mapa para histórico de mensagens por sala (em memória)
const historicoPorSala = {}; // { sala: [ { usuario, mensagem }, ... ] }
const usuarioPorSocket = {}; // { socket.id: { usuario, sala } }
// IMPORTANTE: A função `clearUserHistory` no `messageFrequency.js`
// faz uma ASSUNÇÃO de que terá acesso a `usuarioPorSocket`.
// Para evitar refatorar o `messageFrequency.js` agora para uma modularidade mais "pura",
// vamos passá-lo como argumento para a função no momento da chamada, ou o ideal seria
// que `messageFrequency` gerenciasse seu próprio mapeamento interno ou fosse inicializado com ele.
// Por ora, a função `clearUserHistory` no `messageFrequency.js` que defini,
// não é exportada para ser chamada diretamente no `server.js`.
// A limpeza será feita redefinindo a função `checkMessageFrequency` para aceitar `usuarioPorSocket`.
// Melhorando isso para modularidade e não precisar passar `usuarioPorSocket` globalmente,
// a `clearUserHistory` será removida do `messageFrequency.js` e a limpeza será implícita
// pela janela de tempo (`TIME_WINDOW_MS`).
// Se a limpeza imediata ao desconectar for CRÍTICA, me avise, e precisaremos de uma pequena refatoração
// no `messageFrequency.js` ou passá-lo como um objeto para ele.

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
      // ✅ 1. Prevenção de Flood (Mensagens repetidas)
      // O `usuario` pode vir do frontend, é ideal que seja o ID do usuário (autenticado)
      // para evitar que um usuário mude de nome e burle o filtro.
      // Se você tiver o ID do usuário no socket (ex: `socket.userId`), use-o aqui.
      // Por enquanto, usaremos o `usuario` fornecido.
      if (checkMessageFrequency(sala, usuario, mensagem)) {
        // Envia uma mensagem privada para o usuário que tentou floodar
        socket.emit('mensagem', { usuario: 'O Teólogo', mensagem: 'Você está enviando mensagens muito repetidas. Por favor, aguarde.' });
        console.warn(`🚫 [FLOOD] Mensagem de "${usuario}" na sala "${sala}" bloqueada por repetição excessiva.`);
        return; // Interrompe o processamento da mensagem de flood
      }

      // ✅ 2. Implementação da moderação de conteúdo (palavrões, ofensas)
      let processedMessage = mensagem;

      // 2.1. Verificar se a mensagem é altamente ofensiva (para possível bloqueio/ação)
      if (isHighlyOffensive(mensagem)) {
        console.warn(`🚨 [MODERACAO] Mensagem altamente ofensiva detectada de ${usuario} na sala ${sala}. Mensagem original: "${mensagem}"`);
        io.to(sala).emit('mensagem', { usuario: 'Sistema', mensagem: `A mensagem de ${usuario} foi considerada altamente ofensiva e não será exibida.` });
        return; // Interrompe o processamento da mensagem ofensiva
      }

      // 2.2. Filtrar palavras ofensivas
      processedMessage = filterContent(mensagem);

      // Garante que a mensagem não exceda o limite de caracteres após a filtragem
      const textoFinal = processedMessage.slice(0, 256);
      const msgObj = { usuario, mensagem: textoFinal };

      registrarMensagem(sala, msgObj);
      io.to(sala).emit('mensagem', msgObj);
      console.log(`💬 [CHAT] Mensagem de ${usuario} na sala ${sala}: "${msgObj.mensagem}"`); // Log da mensagem processada
    } else {
      console.warn(`⚠️ [CHAT] Dados de mensagem incompletos recebidos. Sala: ${sala}, Usuário: ${usuario}, Mensagem: ${mensagem}`);
    }
  });

  socket.on('disconnecting', () => {
    const infos = usuarioPorSocket[socket.id];
    if (infos) {
      const { usuario, sala } = infos;
      // Não precisamos mais chamar clearUserHistory explicitamente aqui,
      // pois o `messageFrequency` já tem uma janela de tempo para limpar sozinho.
      // Se o usuário sair e entrar rapidamente, o histórico de 5 minutos ainda estaria lá.
      // Se for preciso limpar imediatamente ao desconectar, o `messageFrequency.js`
      // precisaria ser refatorado para ter um método `clearUserHistoryBySocketId`.

      // Mensagem de saída do usuário
      const msgSaida = { usuario: 'Teologando', mensagem: `${usuario} saiu da sala.` };
      registrarMensagem(sala, msgSaida);
      socket.to(sala).emit('mensagem', msgSaida);
      console.log(`🚪 [SOCKET] ${usuario} saiu da sala ${sala}`);
    } else {
      const salas = [...socket.rooms].slice(1);
      salas.forEach(sala => {
        socket.to(sala).emit('mensagem', { usuario: 'Teologando', mensagem: 'Um usuário saiu da sala.' });
      });
      console.log('🚪 [SOCKET] Um usuário desconectou (informações não encontradas).');
    }
  });

  socket.on('disconnect', () => {
    delete usuarioPorSocket[socket.id];
    console.log('🔴 [SOCKET] Usuário desconectado');
  });
});

// Função para registrar mensagens no histórico (mantém as últimas 5)
function registrarMensagem(sala, msgObj) {
  if (!historicoPorSala[sala]) historicoPorSala[sala] = [];
  historicoPorSala[sala].push(msgObj);
  // Garante que o histórico não exceda 5 mensagens
  if (historicoPorSala[sala].length > 5) {
    historicoPorSala[sala] = historicoPorSala[sala].slice(-5);
  }
}

// 🚀 Inicialização do servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

// Logs de exceção global
process.on('uncaughtException', (err) => {
  console.error('❌ [UNCAUGHT EXCEPTION] Erro inesperado da aplicação:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❗ [UNHANDLED REJECTION] Promessa rejeitada não tratada:', reason, 'Promessa:', promise);
});