require("dotenv").config();
const io = require("socket.io-client");

const SALAS_FIXAS = [
    'Escatologia','Trindade','Livre Arbítrio','Soteriologia','Bibliologia',
    'Cristologia','Ateus','Católicos','Pentecostais','Adventistas',
    'Presbiterianos','Batistas','Testemunhas da Jeova','Mórmons'
];

const POSSIVEIS_NUM_BOTS = (process.env.NUMBER_BOTS || "0")
    .split(",")
    .map(n => parseInt(n.trim()))
    .filter(n => !isNaN(n) && n >= 0);

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
    "Cristo em vós, a esperança da glória.",
    "Quem sabe argumentar, somente com a bíblia?",
    "Estou gostando de debater esses assuntos",
    "Vi que na sessão de estudos teológicos do site tem muito material legal, também!!",
    "Ajudei a iniciativa com R$ 10,00 e ganhei um livro da hora!!",
    "Gostei demais da iniciativa, ajudei com R$ 5,00, nem pesa no bolso",
    "Já mandei umas sugestões de melhoria no fale conosco deles",
    "O importante é glorificar a Deus com entendimento.",
    "Essa é uma das doutrinas mais debatidas, né?",
    "Cada versículo revela um pouco mais da verdade.",
    "A Bíblia é nossa única regra de fé e prática.",
    "Deus abençoe todos os irmãos dessa sala!",
    "Já oraram hoje? Oração move o coração de Deus.",
    "Muitos são chamados, poucos escolhidos!",
    "Que possamos crescer em graça e conhecimento.",
    "Jesus está voltando! Estamos preparados?",
    "Estou anotando várias referências aqui!",
    "Glória a Deus por esse projeto maravilhoso!",
    "Esse tema me fez refletir muito.",
    "O debate é saudável quando há respeito.",
    "Edificação mútua é o objetivo dessa sala.",
    "Compartilhar conhecimento fortalece nossa fé.",
    "Cada doutrina deve ser testada à luz da Palavra.",
    "A humildade é essencial em qualquer debate.",
    "Deus nos dá sabedoria para entender sua vontade.",
    "Aprender juntos nos aproxima do propósito divino.",
    "Discernir é um dom que devemos cultivar com oração.",
    "A verdade liberta, mas também une.",
    "Debater com amor edifica a todos.",
    "A comunhão entre irmãos é uma benção preciosa.",
    "Respeitar opiniões diferentes é sinal de maturidade cristã.",
    "A Palavra de Deus é fonte inesgotável de aprendizado.",
    "Quando dois ou três se reúnem em Seu nome, Ele está presente.",
    "Dúvidas são portas para o crescimento espiritual.",
    "Mais importante que vencer o debate é viver a verdade.",
    "A Bíblia deve ser nosso guia em toda discussão.",
    "Cristãos maduros sabem ouvir antes de falar.",
    "O Espírito Santo nos ensina mesmo através de outros irmãos.",
    "A sabedoria do alto é pacífica e cheia de misericórdia.",
    "Quem busca a verdade encontra a paz.",
    "Não existe edificação sem amor ao próximo.",
    "A luz da Escritura revela os caminhos do Senhor.",
    "O evangelho é simples, mas profundo.",
    "Unidade não significa uniformidade.",
    "A diversidade de dons enriquece o Corpo de Cristo.",
    "A verdade sempre prevalece no tempo certo.",
    "Cada encontro é uma oportunidade divina de crescimento.",
    "Debater com mansidão atrai mais corações.",
    "Toda palavra deve ser temperada com graça.",
    "A glória é de Deus, mesmo nos nossos argumentos.",
    "Jesus é o caminho, e toda discussão deve levar a Ele."
];

function gerarNomeUnico(base) {
    return `* ${base} `;
}

function lerIntervaloDinamicamente() {
    const intervaloStr = process.env.BOTS_INTERVAL_RANGE || "20000,30000";
    const [minStr, maxStr] = intervaloStr.split(",").map(n => parseInt(n.trim()));
    const min = !isNaN(minStr) ? minStr : 20000;
    const max = !isNaN(maxStr) ? maxStr : 30000;
    return Math.floor(Math.random() * (max - min)) + min;
}

function enviarMensagens(socket, sala, nomeBot) {
    function enviar() {
        const intervalo = lerIntervaloDinamicamente();
        setTimeout(() => {
            const frase = FRASES_TEMAS[Math.floor(Math.random() * FRASES_TEMAS.length)];
            socket.emit("mensagem", {
                sala,
                usuario: nomeBot,
                mensagem: frase
            });
            enviar();
        }, intervalo);
    }
    enviar();
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

// Inicializa os bots em cada sala fixa
for (const sala of SALAS_FIXAS) {
    const qtdBots = POSSIVEIS_NUM_BOTS[Math.floor(Math.random() * POSSIVEIS_NUM_BOTS.length)];
    for (let i = 0; i < qtdBots; i++) {
        const baseNome = NOMES_BOTS[(i + sala.length) % NOMES_BOTS.length];
        const nomeBot = gerarNomeUnico(baseNome);
        iniciarBot(nomeBot, sala);
    }
}
