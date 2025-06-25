const socket = io();

const params = new URLSearchParams(window.location.search);
const sala = params.get("sala") || "Geral";
const usuario = params.get("usuario") || "Anônimo";

const apelidoSimplificado = usuario
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

localStorage.setItem("apelido", usuario);
localStorage.setItem("apelidoSimplificado", apelidoSimplificado);

document.getElementById("sala-titulo").textContent = `Sala: ${sala}`;
socket.emit("entrar", { sala, usuario, avatar: localStorage.getItem("avatar") || "" });

let usuariosOnline = [];

socket.on("usuariosNaSala", (lista) => {
  if (Array.isArray(lista)) {
    usuariosOnline = lista;
  } else if (typeof lista === 'object') {
    usuariosOnline = lista[sala] || [];
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

socket.on("mensagemEditada", (data) => {
  const div = document.getElementById(`msg-${data.id}`);
  if (div) {
    const span = div.querySelector(".texto");
    if (span) {
      const partes = data.mensagem.split(/(\s+)/).map(part => {
        if (part.startsWith('@')) {
          const nome = part.slice(1);
          return `<span class="mention">${nome}</span>`;
        }
        return part;
      });
      span.innerHTML = `${partes.join('')} <em>(editada)</em>`;
    }
  }
});

socket.on("mensagemApagada", (data) => {
  const div = document.getElementById(`msg-${data.id}`);
  if (div) div.remove();
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
  if (!chat || !data.id) return;

  const div = document.createElement("div");
  div.classList.add("mensagem");
  div.id = `msg-${data.id}`;

  const apelidoAtual = localStorage.getItem("apelidoSimplificado");
  const destinatario = data.destinatario?.toLowerCase().trim();
  const isDestinatario = destinatario && apelidoAtual && destinatario === apelidoAtual;

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
  const avatar = data.avatar || '';
  const nome = data.usuario;
  const nomeHTML = avatar
      ? `<img src="${avatar}" class="avatar"> <span>${nome}</span>`
      : nome;

  div.innerHTML = `<strong>${icone}${nomeHTML}:</strong> <span class="texto">${partes.join('')}</span>`;

  if (data.usuario === localStorage.getItem("apelido")) {
    const editarBtn = document.createElement("button");
    editarBtn.textContent = "✏️";
    editarBtn.className = "editar-btn";
    editarBtn.title = "Editar";
    editarBtn.onclick = () => {
      const novaMensagem = prompt("Editar mensagem:", data.mensagem);
      if (novaMensagem) {
        socket.emit("editarMensagem", { sala, id: data.id, novaMensagem });
      }
    };
    div.appendChild(editarBtn);

    const apagarBtn = document.createElement("button");
    apagarBtn.textContent = "🗑️";
    apagarBtn.className = "apagar-btn";
    apagarBtn.title = "Apagar";
    apagarBtn.onclick = () => {
      if (confirm("Deseja apagar esta mensagem?")) {
        socket.emit("apagarMensagem", { sala, id: data.id });
      }
    };
    div.appendChild(apagarBtn);
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// Autocompletar menções
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
      .map(nome =>
          nome.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, "_")
      )
      .filter(nome => nome.startsWith(termo))
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

// Integração com o emoji-picker
const emojiToggle = document.getElementById('emoji-toggle');
const emojiPicker = document.getElementById('emoji-picker');

if (emojiToggle && emojiPicker) {
  emojiToggle.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === "block" ? "none" : "block";
  });

  emojiPicker.addEventListener('emoji-click', (event) => {
    const emoji = event.detail.unicode;
    inputMensagem.value += emoji;
    emojiPicker.style.display = "none";
    inputMensagem.focus();
  });

  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiToggle) {
      emojiPicker.style.display = "none";
    }
  });
}

// Sair da sala com confirmação
const btnSair = document.getElementById("btn-sair");

btnSair.addEventListener("click", () => {
  const confirmar = confirm("Deseja realmente sair da sala?");
  if (confirmar) {
    socket.emit("mensagem", {
      sala,
      usuario: "O Teólogo",
      mensagem: `<i style='color:red;'>${usuario} saiu da sala.</i>`
    });
    socket.emit("sair", { sala, usuario });
    window.location.href = "/";
  }
});
