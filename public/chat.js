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
  usuariosOnline = typeof lista === 'object' ? (lista[sala] || []) : (Array.isArray(lista) ? lista : []);
});

socket.on("historico", (historico) => {
  for (const data of historico) {
    exibirMensagem(data);
  }
});

socket.on("mensagem", (data) => {
  // 🛠️ Remove a antiga, se já existir com mesmo ID
  const existente = document.getElementById(`msg-${data.id}`);
  if (existente) existente.remove();

  // ✨ Exibe a nova (ou editada) mensagem
  exibirMensagem(data);
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
    socket.emit("mensagem", { sala, usuario, mensagem, avatar: localStorage.getItem("avatar") || "" });
    input.value = "";
    ocultarSugestoes();
  }
});

function exibirMensagem(data) {
  const container = document.getElementById("chat-box") || document.getElementById("mensagens");
  if (!container || !data.mensagem) return;

  const div = document.createElement("div");
  div.classList.add("mensagem");
  if (data.id) div.id = `msg-${data.id}`;

  const isSistema = data.usuario === "O Teólogo disse" || data.usuario === "Sistema";
  const msgTexto = data.mensagem.toLowerCase();

  if (isSistema) {
    if (msgTexto.includes("entrou na sala")) {
      div.classList.add("entrada");
    } else if (msgTexto.includes("saiu da sala")) {
      div.classList.add("saida");
    } else {
      div.classList.add("sistema");
    }

    div.innerHTML = `<em>${data.usuario}: ${data.mensagem}</em>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return;
  }

  // Avatar e nome formatado
  const avatar = data.avatar ? `<img src="${data.avatar}" class="avatar">` : "";
  const nomeHTML = avatar ? `${avatar} <span>${data.usuario}</span>` : data.usuario;

  // Menção destacada
  const partes = data.mensagem.split(/(\s+)/).map(part =>
      part.startsWith('@') ? `<span class="mention">${part.slice(1)}</span>` : part
  );

  // Apelido e destinatário
  const apelidoAtual = localStorage.getItem("apelidoSimplificado");
  const apelidoMensagem = data.usuario?.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");

  const isDestinatario = data.destinatario?.toLowerCase().trim() === apelidoAtual;
  if (isDestinatario) div.classList.add("mensagem-destacada");

  const icone = isDestinatario ? "🔔 " : "";
  div.innerHTML = `<strong>${icone}${nomeHTML}:</strong> <span class="texto">${partes.join('')}</span>`;

  // Mostrar botões apenas se o usuário atual é o autor
  if (apelidoMensagem === apelidoAtual && data.id) {
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

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

const btnSair = document.getElementById("btn-sair");

btnSair.addEventListener("click", () => {
  const confirmar = confirm("Deseja realmente sair da sala?");
  if (confirmar) {
    socket.emit("sair", { sala, usuario });
    window.location.href = "/";
  }
});
// Emoji Picker - Mostrar/Esconder e Inserir no campo de texto
const emojiToggle = document.getElementById("emoji-toggle");
const emojiPicker = document.getElementById("emoji-picker");
const inputMensagem = document.getElementById("msg");

emojiToggle.addEventListener("click", () => {
  emojiPicker.style.display = emojiPicker.style.display === "block" ? "none" : "block";
});

emojiPicker.addEventListener("emoji-click", event => {
  const emoji = event.detail.unicode;
  inputMensagem.value += emoji;
  inputMensagem.focus();
  emojiPicker.style.display = "none"; // Fecha automaticamente
});
