require("dotenv").config();
const io = require("socket.io-client");

const SALAS_FIXAS = [
    'Escatologia','Trindade','Livre Arbítrio','Soteriologia','Bibliologia',
    'Cristologia','Ateus','Católicos','Pentecostais','Adventistas',
    'Presbiterianos','Batistas','Testemunhas da Jeova','Mórmons'
];

// Novo formato: NUMBER_BOTS=1,2,3
const POSSIVEIS_NUM_BOTS = (process.env.NUMBER_BOTS || "0")
    .split(",")
    .map(n => parseInt(n.trim()))
    .filter(n => !isNaN(n) && n >= 0);

if (POSSIVEIS_NUM_BOTS.length === 0) {
    console.log("[BOTS] Nenhum valor válido encontrado em NUMBER_BOTS");
    process.exit(0);
}

const NOMES_BOTS = [
    "Gabriel", "Ana", "Rafael", "Sara", "João", "Débora", "Miguel", "Ester", "Lucas", "Priscila",
    "André", "Lídia", "Tiago", "Rebeca", "Natanael", "Marta", "Felipe", "Talita", "Tomé", "Abigail"
];

const FRASES_TEMAS = [
    "Graça e paz, irmãos!",
    "Alguém sabe um bom versículo sobre esse tema?",
    "O que vocês acham dessa doutrina?",
    "Jesus é o centro de tudo!",
    "Muito interessante esse ponto de vista!",
    "Glória a Deus por esse espaço de debate.",
    "O Espírito Santo nos guia em toda verdade.",
    "A Palavra é viva e eficaz!",
    "Evangelizar é um chamado de todos nós.",
    "Cristo em vós, a esperança da glória."
];

function gerarNomeUnico(base, indice, sala) {
    return `🤖 ${base} - ${sala}`;
}

function enviarMensagens(socket, sala, nomeBot) {
    setInterval(() => {
        const frase = FRASES_TEMAS[Math.floor(Math.random() * FRASES_TEMAS.length)];
        socket.emit("mensagem", {
            sala,
            usuario: nomeBot,
            mensagem: frase
        });
    }, 20000 + Math.floor(Math.random() * 10000)); // entre 20 e 30s
}

function iniciarBot(nomeBot, sala) {
    const socket = io("http://localhost:3000", {
        transports: ["websocket"],
        reconnectionAttempts: 5,
        timeout: 5000,
    });

    socket.on("connect", () => {
        console.log(`[🤖 BOT] Conectado como ${nomeBot} na sala ${sala}`);
        socket.emit("entrar", { sala, usuario: nomeBot });
        enviarMensagens(socket, sala, nomeBot);
    });

    socket.on("connect_error", (err) => {
        console.error(`[BOT ERRO] Falha ao conectar ${nomeBot} na sala ${sala}:`, err.message);
    });

    socket.on("disconnect", () => {
        console.log(`[🤖 BOT] ${nomeBot} desconectado da sala ${sala}`);
    });
}

// Cria bots aleatórios por sala com base nos valores possíveis
for (const sala of SALAS_FIXAS) {
    const qtdBots = POSSIVEIS_NUM_BOTS[Math.floor(Math.random() * POSSIVEIS_NUM_BOTS.length)];
    for (let i = 0; i < qtdBots; i++) {
        const baseNome = NOMES_BOTS[(i + sala.length) % NOMES_BOTS.length];
        const nomeBot = gerarNomeUnico(baseNome, i, sala);
        iniciarBot(nomeBot, sala);
    }
}
