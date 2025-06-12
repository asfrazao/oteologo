const socket = io();

const params = new URLSearchParams(window.location.search);
const sala = params.get("sala") || "Geral";
const usuario = params.get("usuario") || "Anônimo";

document.getElementById("sala-titulo").textContent = `Sala: ${sala}`;
socket.emit("entrar", { sala, usuario });

let usuariosOnline = [];

socket.on("usuariosNaSala", (lista) => {
  usuariosOnline = lista;
});

socket.on("historico", (historico) => {
  for (const data of historico) {
    exibirMensagem(data);
  }
});

document.getElementById("form-msg").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("msg");
  const mensagem = input.value.trim();
  if (mensagem.length > 0 && mensagem.length <= 256) {
    socket.emit("mensagem", { sala, usuario, mensagem });
    input.value = "";
    esconderSugestoes();
  }
});

socket.on("mensagem", (data) => {
  exibirMensagem(data);
});

function destacarMencoes(texto) {
  return texto.replace(/\b(\w+)\b/g, (match) => {
    if (usuariosOnline.includes(match)) {
      return `<span class="mention">${match}</span>`;
    }
    return match;
  });
}

function exibirMensagem(data) {
  const div = document.createElement("div");
  const mensagemFormatada = destacarMencoes(data.mensagem);

  if (data.usuario === "Teologando" && /saiu da sala/.test(data.mensagem)) {
    div.innerHTML = `<em style="color:#a11;"><b>${mensagemFormatada}</b></em>`;
  } else if (data.usuario === "Teologando" && /entrou na sala/.test(data.mensagem)) {
    div.innerHTML = `<em style="color:#157;"><b>${mensagemFormatada}</b></em>`;
  } else {
    div.innerHTML = `<strong>${data.usuario} disse:</strong> ${mensagemFormatada}`;
  }

  document.getElementById("chat-box").appendChild(div);
  document.getElementById("chat-box").scrollTop = document.getElementById("chat-box").scrollHeight;
}

socket.on("salaCheia", () => {
  alert("Sala cheia! Escolha outra.");
  window.location.href = "/salas";
});

// 🧠 AUTOCOMPLETE @MENÇÕES

const inputMsg = document.getElementById("msg");
const sugestaoBox = document.createElement("div");
sugestaoBox.id = "sugestoes";
sugestaoBox.className = "sugestoes";
document.body.appendChild(sugestaoBox);

inputMsg.addEventListener("input", () => {
  const pos = inputMsg.selectionStart;
  const texto = inputMsg.value.substring(0, pos);
  const match = texto.match(/@(\w*)$/);
  if (match) {
    const termo = match[1].toLowerCase();
    const resultados = usuariosOnline.filter(u => u.toLowerCase().startsWith(termo));
    if (resultados.length > 0) {
      sugestaoBox.innerHTML = "";
      resultados.forEach(user => {
        const item = document.createElement("div");
        item.textContent = user;
        item.className = "sugestao-item";
        item.onclick = () => {
          inputMsg.value = texto.replace(/@(\w*)$/, user + " ") + inputMsg.value.substring(pos);
          esconderSugestoes();
          inputMsg.focus();
        };
        sugestaoBox.appendChild(item);
      });
      const rect = inputMsg.getBoundingClientRect();
      sugestaoBox.style.top = `${rect.bottom + window.scrollY}px`;
      sugestaoBox.style.left = `${rect.left + window.scrollX}px`;
      sugestaoBox.style.display = "block";
    } else {
      esconderSugestoes();
    }
  } else {
    esconderSugestoes();
  }
});

function esconderSugestoes() {
  sugestaoBox.style.display = "none";
}
