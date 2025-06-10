// utils/messageFrequency.js

// Configuração do logger (reaproveitando o padrão do contentFilter.js)
const log = {
    info: (message) => console.log(`[INFO] ${message}`),
    warn: (message) => console.warn(`[WARN] ${message}`),
    error: (message) => console.error(`[ERROR] ${message}`)
};

// Estrutura para armazenar as últimas mensagens de cada usuário em cada sala.
// Exemplo: {
//   'sala1': {
//     'usuarioA': [{ messageHash: 'hash1', timestamp: 12345 }, { messageHash: 'hash2', timestamp: 12346 }],
//     'usuarioB': [{ messageHash: 'hash3', timestamp: 12347 }]
//   },
//   'sala2': { ... }
// }
const userMessageHistory = {};

// Configurações
const MAX_REPETITIONS = 3; // Limite de vezes que a mesma mensagem pode ser enviada
const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutos (janela de tempo para considerar repetição)

/**
 * Gera um hash simples da mensagem para comparação.
 * Uma função de hash mais robusta (ex: SHA256) seria melhor para evitar colisões,
 * mas para simplicidade e performance em memória, um método simples de normalização já ajuda.
 * @param {string} message O texto da mensagem.
 * @returns {string} Uma versão normalizada da mensagem para comparação.
 */
function generateMessageHash(message) {
    if (typeof message !== 'string') {
        return '';
    }
    // Remove espaços extras, converte para minúsculas e remove pontuação básica
    return message.trim().toLowerCase().replace(/[.,!?;'"\s]/g, '');
}

/**
 * Verifica se um usuário excedeu o limite de mensagens repetidas em uma sala.
 * Limpa histórico antigo para manter a performance.
 * @param {string} sala O ID ou nome da sala.
 * @param {string} usuario O nome ou ID do usuário.
 * @param {string} message A mensagem que o usuário está tentando enviar.
 * @returns {boolean} True se o usuário excedeu o limite, false caso contrário.
 */
function checkMessageFrequency(sala, usuario, message) {
    const now = Date.now();
    const messageHash = generateMessageHash(message);

    if (!userMessageHistory[sala]) {
        userMessageHistory[sala] = {};
    }
    if (!userMessageHistory[sala][usuario]) {
        userMessageHistory[sala][usuario] = [];
    }

    const messages = userMessageHistory[sala][usuario];

    // Limpa mensagens antigas fora da janela de tempo
    let relevantMessages = messages.filter(entry => now - entry.timestamp < TIME_WINDOW_MS);

    // Conta repetições da mensagem atual
    const repetitions = relevantMessages.filter(entry => entry.messageHash === messageHash).length;

    // Adiciona a nova mensagem (após contagem)
    relevantMessages.push({ messageHash, timestamp: now });

    // Mantém o histórico relevante (poderia ter um limite de mensagens total também)
    userMessageHistory[sala][usuario] = relevantMessages;

    if (repetitions >= MAX_REPETITIONS) {
        log.warn(`🚫 [FLOOD] Usuário "${usuario}" na sala "${sala}" tentou enviar mensagem repetida "${message}". Repetições: ${repetitions + 1}. Bloqueado.`);
        return true; // Excedeu o limite
    }

    log.info(`[FLOOD] Usuário "${usuario}" na sala "${sala}" enviou mensagem "${message}". Repetições desta mensagem na janela: ${repetitions + 1}.`);
    return false; // Não excedeu o limite
}

/**
 * Limpa o histórico de um usuário ao desconectar ou sair da sala.
 * @param {string} socketId O ID do socket.
 * @param {string} sala O ID ou nome da sala (opcional, para limpar por sala).
 */
function clearUserHistory(socketId, sala = null) {
    // Isso é mais complexo pois você está usando `usuarioPorSocket` no server.js
    // Idealmente, a chave principal para o histórico deveria ser (sala, usuarioId) e não (socketId).
    // Por simplicidade, vamos limpar apenas o que está diretamente associado ao socketId.
    // Se o `usuarioPorSocket` armazenar 'usuario' e 'sala', podemos usar isso para limpar.

    const userInfo = usuarioPorSocket[socketId]; // Assumindo acesso ao usuarioPorSocket do server.js

    if (userInfo) {
        const { usuario, sala: userSala } = userInfo;
        if (userMessageHistory[userSala] && userMessageHistory[userSala][usuario]) {
            delete userMessageHistory[userSala][usuario];
            log.info(`[FLOOD] Histórico de mensagens de "${usuario}" na sala "${userSala}" limpo.`);
        }
    }
}

// Expõe a estrutura de histórico para fins de depuração (NÃO USE EM PROD PARA ACESSAR DIRETAMENTE)
// module.exports = {
//   checkMessageFrequency,
//   clearUserHistory,
//   _userMessageHistory: userMessageHistory // Apenas para depuração ou teste unitário
// };

module.exports = {
    checkMessageFrequency,
    clearUserHistory,
};