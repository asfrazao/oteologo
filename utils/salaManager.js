// utils/salaManager.js
const salas = {};
const inatividadePorSala = {};

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
  for (const salaId in salas) {
    const sala = salas[salaId];
    if (sala.personalizada && sala.usuarios.length === 0) {
      delete salas[salaId];
      delete inatividadePorSala[salaId];
    }
  }
}

function monitorarInatividadePorSala(io, salaId) {
  if (inatividadePorSala[salaId]) {
    clearTimeout(inatividadePorSala[salaId].tempoAlerta);
    clearTimeout(inatividadePorSala[salaId].tempoFinal);
  }

  // Após 1 hora de inatividade, envia alerta
  inatividadePorSala[salaId] = {
    tempoAlerta: setTimeout(() => {
      io.to(salaId).emit('mensagem', {
        usuario: 'O Teólogo',
        mensagem: 'O Teólogo diz: Tem alguém aí?'
      });

      // Após mais 30 minutos sem resposta, remove sala e usuários
      inatividadePorSala[salaId].tempoFinal = setTimeout(() => {
        const sala = salas[salaId];
        if (sala && sala.usuarios.length > 0) {
          sala.usuarios.forEach(u => {
            io.to(salaId).emit('mensagem', {
              usuario: 'O Teólogo',
              mensagem: `${u.nome} foi removido por inatividade.`
            });
            io.sockets.sockets.get(u.id)?.leave(salaId);
          });
        }
        delete salas[salaId];
        delete inatividadePorSala[salaId];
      }, 30 * 60 * 1000); // 30 minutos

    }, 60 * 60 * 1000) // 1 hora
  };
}

module.exports = {
  criarSala,
  podeEntrar,
  adicionarUsuario,
  removerUsuario,
  removerSalasExpiradas,
  monitorarInatividadePorSala,
  salas
};
