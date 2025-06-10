
// utils/salaManager.js
const salas = {};

function criarSala(nome, personalizada = false) {
  const id = nome.toLowerCase().replace(/\s+/g, '-');
  if (!salas[id]) {
    salas[id] = {
      nome,
      personalizada,
      criacao: Date.now(),
      usuarios: []
    };
  }
  return id;
}

function podeEntrar(sala) {
  const id = sala.toLowerCase().replace(/\s+/g, '-');
  return !salas[id] || salas[id].usuarios.length < 20;
}

function adicionarUsuario(sala, socketId, nome) {
  const id = sala.toLowerCase().replace(/\s+/g, '-');
  if (!salas[id]) {
    criarSala(id, true);
  }
  salas[id].usuarios.push({ id: socketId, nome });
}

function removerUsuario(socketId) {
  for (const sala in salas) {
    salas[sala].usuarios = salas[sala].usuarios.filter(u => u.id !== socketId);
  }
}

function removerSalasExpiradas(io) {
  const agora = Date.now();
  for (const sala in salas) {
    if (salas[sala].personalizada && agora - salas[sala].criacao > 3600000) {
      salas[sala].usuarios.forEach(u => {
        io.to(sala).emit('mensagem', `⏳ Sala expirou. ${u.nome} foi desconectado.`);
        io.sockets.sockets.get(u.id)?.leave(sala);
      });
      delete salas[sala];
    }
  }
}

module.exports = {
  criarSala,
  podeEntrar,
  adicionarUsuario,
  removerUsuario,
  removerSalasExpiradas,
  salas
};
