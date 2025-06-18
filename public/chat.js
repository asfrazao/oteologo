const socket = io();

const params = new URLSearchParams(window.location.search);
const sala = params.get("sala") || "Geral";
const usuario = params.get("usuario") || "Anônimo";

localStorage.setItem("apelido", usuario);
document.getElementById("sala-titulo").textContent = `Sala: ${sala}`;
socket.emit("entrar", { sala, usuario });

let usuariosOnline = [];

socket.on("usuariosNaSala", (lista) => {
  usuariosOnline = Array.isArray(lista) ? lista : Object.values(lista);
});

socket.on("historico", (historico) => {
  for (const data of historico) {
    exibirMensagem(data);
  }
});

socket.on("mensagem", (data) => {
  exibirMensagem(data);
});

document.getElementById("form-msg").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("msg");
  const mensagem = input.value.trim();
  if (mensagem.length > 0 && mensagem.length <= 256) {
    socket.emit("mensagem", { sala, usuario, mensagem });
    input.value = "";
    ocultarSugestoes();
  }
});

function exibirMensagem(data) {
  const chat = document.getElementById("chat-box");
  if (!chat) return;

  const div = document.createElement("div");
  div.className = "mensagem";

  const partes = data.mensagem.split(/(\s+)/).map(part => {
    if (part.startsWith('@')) {
      const nome = part.slice(1);
      return `<span class="mention">${nome}</span>`;
    }
    return part;
  });

  div.innerHTML = `<strong>${data.usuario}:</strong> ${partes.join('')}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// 🧠 MENÇÕES COM @
const inputMensagem = document.getElementById("msg");
const sugestoesBox = document.getElementById("sugestoes");

inputMensagem.addEventListener("input", () => {
  const valor = inputMensagem.value;
  const indexArroba = valor.lastIndexOf("@");

  if (indexArroba !== -1) {
    const termo = valor.slice(indexArroba + 1).toLowerCase();
    if (termo.length >= 2) {
      mostrarSugestoes(termo);
    } else {
      ocultarSugestoes();
    }
  } else {
    ocultarSugestoes();
  }
});

function mostrarSugestoes(termo) {
  sugestoesBox.innerHTML = "";

  const resultados = usuariosOnline
      .filter(u => u.toLowerCase().startsWith(termo))
      .slice(0, 5); // Limita sugestões

  if (resultados.length === 0) {
    ocultarSugestoes();
    return;
  }

  resultados.forEach(nome => {
    const item = document.createElement("div");
    item.className = "sugestao";
    item.textContent = nome;
    item.style.cursor = "pointer";
    item.style.padding = "4px 8px";
    item.onclick = () => inserirApelido(nome);
    sugestoesBox.appendChild(item);
  });

  const coords = inputMensagem.getBoundingClientRect();
  sugestoesBox.style.left = coords.left + "px";
  sugestoesBox.style.top = coords.top - 170 + "px";
  sugestoesBox.style.display = "block";
}

function ocultarSugestoes() {
  sugestoesBox.style.display = "none";
}

function inserirApelido(apelido) {
  const valorAtual = inputMensagem.value;
  const indexArroba = valorAtual.lastIndexOf("@");
  inputMensagem.value = valorAtual.slice(0, indexArroba) + apelido + " ";
  inputMensagem.focus();
  ocultarSugestoes();
}

// Sair da sala
document.getElementById("btn-sair").addEventListener("click", () => {
  localStorage.removeItem("apelido");
  localStorage.removeItem("token");
  localStorage.removeItem("sala");
  window.location.href = "/auth.html";
});
