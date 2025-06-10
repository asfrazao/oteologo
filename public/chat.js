const socket = io();

// Recuperar sala e apelido da URL
const params = new URLSearchParams(window.location.search);
const sala = params.get("sala") || "Geral";
const usuario = params.get("usuario") || "Anônimo";

// Exibir o nome da sala
document.getElementById("sala-titulo").textContent = `Sala: ${sala}`;

// Emitir evento de entrada na sala
socket.emit("entrar", { sala, usuario });

// Receber histórico das últimas 5 mensagens e exibir ao entrar
socket.on("historico", (historico) => {
  for (const data of historico) {
    exibirMensagem(data);
  }
});

// Evento de envio de mensagem
document.getElementById("form-msg").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("msg");
  const mensagem = input.value.trim();
  if (mensagem.length > 0 && mensagem.length <= 256) {
    socket.emit("mensagem", { sala, usuario, mensagem });
    input.value = "";
  }
});

// Receber mensagens e exibir no chat
socket.on("mensagem", (data) => {
  exibirMensagem(data);
});

function exibirMensagem(data) {
  const div = document.createElement("div");
  if (data.usuario === "Teologando" && /saiu da sala/.test(data.mensagem)) {
    div.innerHTML = `<em style="color:#a11;"><b>${data.mensagem}</b></em>`;
  } else if (data.usuario === "Teologando" && /entrou na sala/.test(data.mensagem)) {
    div.innerHTML = `<em style="color:#157;"><b>${data.mensagem}</b></em>`;
  } else {
    div.innerHTML = `<strong>${data.usuario} disse:</strong> ${data.mensagem}`;
  }
  document.getElementById("chat-box").appendChild(div);
  document.getElementById("chat-box").scrollTop = document.getElementById("chat-box").scrollHeight;
}

// Sala cheia
socket.on("salaCheia", () => {
  alert("Sala cheia! Escolha outra.");
  window.location.href = "/salas";
});
