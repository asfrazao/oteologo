const socket = io();

const params = new URLSearchParams(window.location.search);
const sala = params.get("sala") || "Geral";
const usuario = params.get("usuario") || "Anônimo";

localStorage.setItem("apelido", usuario);
document.getElementById("sala-titulo").textContent = `Sala: ${sala}`;
socket.emit("entrar", { sala, usuario });

let usuariosOnline = [];

socket.on("usuariosNaSala", (lista) => {
  if (Array.isArray(lista)) {
    usuariosOnline = lista;
  } else if (typeof lista === 'object') {
    const salaAtual = sala;
    usuariosOnline = lista[salaAtual] || [];
  } else {
    usuariosOnline = [];
  }
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

  const apelidoAtual = localStorage.getItem("apelido");
  const isDestinatario = data.destinatario === apelidoAtual;

  if (isDestinatario) {
    div.classList.add("mensagem-destacada");
  }

  const partes = data.mensagem.split(/(\s+)/).map(part => {
    if (part.startsWith('@')) {
      const nome = part.slice(1);
      return `<span class="mention">${nome}</span>`;
    }
    return part;
  });

  const icone = isDestinatario ? "🔔 " : "";
  const avatar = localStorage.getItem("avatar");
  const nome = data.usuario;
  const nomeHTML = avatar
      ? `<img src="${avatar}" class="avatar"> <span>${nome}</span>`
      : nome;

  div.innerHTML = `<strong>${icone}${nomeHTML}:</strong> ${partes.join('')}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}




// 🧠 MENÇÕES COM @
const inputMensagem = document.getElementById("msg");
const sugestoesBox = document.getElementById("sugestoes");

let sugestaoIndex = -1;
let sugestoesAtuais = [];

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

inputMensagem.addEventListener("keydown", (e) => {
  if (sugestoesBox.style.display === "block" && sugestoesAtuais.length > 0) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      sugestaoIndex = (sugestaoIndex + 1) % sugestoesAtuais.length;
      atualizarSelecaoSugestao();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      sugestaoIndex = (sugestaoIndex - 1 + sugestoesAtuais.length) % sugestoesAtuais.length;
      atualizarSelecaoSugestao();
    } else if (e.key === "Enter") {
      if (sugestaoIndex >= 0) {
        e.preventDefault();
        inserirApelido(sugestoesAtuais[sugestaoIndex]);
      }
    } else if (e.key === "Escape") {
      ocultarSugestoes();
    }
  }
});

function mostrarSugestoes(termo) {
  sugestoesBox.innerHTML = "";
  sugestaoIndex = -1;

  sugestoesAtuais = usuariosOnline
      .map(u => (typeof u === 'string' ? u : u.usuario || u.nome || ''))
      .filter(nome => nome.toLowerCase().startsWith(termo))
      .slice(0, 5);



  if (sugestoesAtuais.length === 0) {
    ocultarSugestoes();
    return;
  }

  sugestoesAtuais.forEach((nome, i) => {
    const item = document.createElement("div");
    item.className = "sugestao-item";
    item.textContent = nome;
    item.onclick = () => inserirApelido(nome);
    sugestoesBox.appendChild(item);
  });

  const coords = inputMensagem.getBoundingClientRect();
  sugestoesBox.style.left = `${coords.left}px`;
  sugestoesBox.style.top = `${coords.bottom + window.scrollY}px`;
  sugestoesBox.style.display = "block";
}

function atualizarSelecaoSugestao() {
  const itens = sugestoesBox.querySelectorAll(".sugestao-item");
  itens.forEach((item, index) => {
    item.style.backgroundColor = index === sugestaoIndex ? "#f0f8ff" : "white";
    item.style.color = index === sugestaoIndex ? "#003366" : "#000";
  });
}

function ocultarSugestoes() {
  sugestoesBox.style.display = "none";
  sugestaoIndex = -1;
  sugestoesAtuais = [];
}

function inserirApelido(apelido) {
  const valorAtual = inputMensagem.value;
  const indexArroba = valorAtual.lastIndexOf("@");
  inputMensagem.value = valorAtual.slice(0, indexArroba + 1) + apelido + " ";
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
