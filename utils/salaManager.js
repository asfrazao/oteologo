// utils/salaManager.js
const salas = {};
const inatividadePorSala = {};

/**
 * Gera o ID interno de sala com nome normalizado
 */
function gerarIdSala(nome) {
  return nome.toLowerCase().replace(/\s+/g, '-');
}

function criarSala(nome, personalizada = false) {
  const id = gerarIdSala(nome);
  if (!salas[id]) {
    salas[id] = {
      nome,
      personalizada,
      criacao: Date.now(),
      usuarios: [],
      ultimoAtivo: Date.now(),      // 👈 Adicionado
      avisoEnviado: false           // 👈 Adicionado
    };
  }
  return id;
}

function podeEntrar(sala) {
  const id = gerarIdSala(sala);
  return !salas[id] || salas[id].usuarios.length < 20;
}

function adicionarUsuario(sala, socketId, nome) {
  const id = gerarIdSala(sala);
  if (!salas[id]) criarSala(id, true);

  salas[id].usuarios.push({ id: socketId, nome });
  salas[id].ultimoAtivo = Date.now();       // 👈 Atualiza último ativo
  salas[id].avisoEnviado = false;           // 👈 Permite novo aviso se ficar inativa depois

  monitorarInatividadePorSala.cancelar(id); // Cancela exclusão agendada se voltou alguém
}

function removerUsuario(socketId) {
  for (const salaId in salas) {
    const salaAtual = salas[salaId];
    salaAtual.usuarios = salaAtual.usuarios.filter(u => u.id !== socketId);

    if (salaAtual.personalizada && salaAtual.usuarios.length === 0) {
      monitorarInatividadePorSala.iniciar(salaId); // agora com ID correto
    }
  }
}

function removerSalasExpiradas(io) {
  const agora = Date.now();

  for (const [nomeSala, sala] of Object.entries(salas)) {
    if (!sala.personalizada) continue;

    const tempoInativo = agora - sala.ultimoAtivo;

    if (tempoInativo > 2 * 60 * 60 * 1000) { // +2h sem atividade
      sala.usuarios.forEach(u => {
        io.to(nomeSala).emit('mensagem', `🕒 O Teólogo disse: <i>${u.nome}</i> foi desconectado por inatividade.`);
        io.sockets.sockets.get(u.id)?.leave(nomeSala);
      });

      delete salas[nomeSala];
      console.log(`[SALA] Sala '${nomeSala}' foi removida após 2h de inatividade.`);
    }
    else if (tempoInativo > 60 * 60 * 1000 && !sala.avisoEnviado) { // +1h sem atividade
      io.to(nomeSala).emit('mensagem', `🕒 <i>O Teólogo disse: Tem alguém aí?</i>`);
      sala.avisoEnviado = true;
      console.log(`[SALA] Enviado aviso de inatividade na sala '${nomeSala}'`);
    }
  }
}


const monitorarInatividadePorSala = {
  iniciar(salaId) {
    if (inatividadePorSala[salaId]) {
      clearTimeout(inatividadePorSala[salaId].tempoAlerta);
      clearTimeout(inatividadePorSala[salaId].tempoFinal);
    }

    const io = require("../server").getIO?.();
    if (!io) return; // garante que não quebre o projeto

    inatividadePorSala[salaId] = {
      tempoAlerta: setTimeout(() => {
        io.to(salaId).emit("mensagem", {
          usuario: "O Teólogo",
          mensagem: "O Teólogo diz: Tem alguém aí?"
        });

        inatividadePorSala[salaId].tempoFinal = setTimeout(() => {
          const sala = salas[salaId];
          if (sala && sala.usuarios.length === 0) {
            io.to(salaId).emit("mensagem", {
              usuario: "O Teólogo",
              mensagem: `Sala '${salaId}' foi encerrada por inatividade.`
            });
            delete salas[salaId];
            delete inatividadePorSala[salaId];
          }
        }, 30 * 60 * 1000); // 30 minutos
      }, 60 * 60 * 1000) // 1 hora
    };
  },

  cancelar(salaId) {
    if (inatividadePorSala[salaId]) {
      clearTimeout(inatividadePorSala[salaId].tempoAlerta);
      clearTimeout(inatividadePorSala[salaId].tempoFinal);
      delete inatividadePorSala[salaId];
    }
  }
};

module.exports = {
  criarSala,
  podeEntrar,
  adicionarUsuario,
  removerUsuario,
  removerSalasExpiradas,
  monitorarInatividadePorSala,
  salas,
  gerarIdSala // importante exportar para uso no server.js
};
