// utils/contentFilter.js
const Filter = require('bad-words');

// Configuração do logger (substitua por sua implementação de logger se houver uma mais robusta)
const log = {
    info: (message) => console.log(`[INFO] ${message}`),
    warn: (message) => console.warn(`[WARN] ${message}`),
    error: (message) => console.error(`[ERROR] ${message}`)
};

// Função para normalizar o texto (remover acentos e caracteres especiais comuns em burlas)
// Esta função será usada para PRÉ-PROCESSAR as listas de palavras (customWords, whitelistWords, highlyOffensiveTerms)
// para que elas estejam em um formato consistente para comparação.
// Não será usada para pré-processar o input de 'filterContent' diretamente antes de filter.clean().
function normalizeTextForComparison(text) {
    if (typeof text !== 'string') {
        return '';
    }
    return text
        .toLowerCase()
        .normalize("NFD") // Normaliza para decompor caracteres acentuados
        .replace(/[\u0300-\u036f]/g, "") // Remove os diacríticos (acentos)
        .replace(/[^a-z0-9\s]/g, '') // Remove apenas caracteres que NÃO são letras, números ou espaços.
        // Isso é para ser menos agressivo e permitir que bad-words lide com @, $, etc.
        .replace(/\s+/g, ' ') // Substitui múltiplos espaços por um único
        .trim(); // Remove espaços extras no início/fim
}

// Palavras personalizadas para a blacklist em português.
// As palavras aqui DEVEM estar em minúsculas e NORMALIZADAS (sem acentos).
// NÃO coloque variações com @ ou outros caracteres aqui, a menos que você as queira LITERALMENTE.
// O `bad-words` lida melhor com isso se a palavra original for passada para ele.
const rawCustomWords = [
    'arrombado', 'buceta', 'cacete', 'caralho', 'cu', 'desgraca', 'foda', 'filhodaputa', 'filho_da_puta',
    'merda', 'porra', 'puta', 'putaquepariu', 'puto', 'viado', 'vadia', 'rapariga', 'put@',
    // Termos religiosos que podem ser usados ofensivamente
     // Termos teológicos que podem ser ofensivos
    'escroto', 'putaria', 'arrombada', 'cuzao', 'foder', 'bosta', 'pqp', 'vtmnc',
    'retardado',  // Insultos mais gerais
    // Adicione mais palavras aqui, já pensando nelas normalizadas (sem acentos)
];

// Palavras para a whitelist: termos que foram bloqueados incorretamente e devem ser liberados.
// Certifique-se de que estão em minúsculas e NORMALIZADAS.
const rawWhitelistWords = [
    'ola', // Se 'ola' foi bloqueada, adicione aqui (normalizado)
    'liberdade', 'assegurar', 'sexta', 'analise', 'sexo', // Exemplos de falsos positivos ou palavras a liberar que `bad-words` pode confundir
    // Adicione aqui qualquer outra palavra que você precise "desbloquear" após testes
];

// Termos que indicam alta ofensividade (sempre normalizados para comparação com texto normalizado)
const rawHighlyOffensiveTerms = [
    'ameaca de morte',
    'incitacao ao odio',
    'ataque pessoal grave',
    'perseguicao',
    'ameaca terrorista',
    'pedofilia', 'sexo infantil', 'abuso sexual', // Exemplos de termos de alta gravidade
    'racismo', 'nazismo', 'holocausto', // Termos sensíveis e de alta gravidade
    // Adicione outros termos de alta gravidade aqui, já normalizados
];

// Inicializa o filtro Bad-Words.
// O construtor sem argumentos faz com que ele use sua lista padrão de palavras em inglês.
const filter = new Filter();

// Processa e adiciona/remove palavras
const processedCustomWords = rawCustomWords.map(word => normalizeTextForComparison(word));
filter.addWords(...processedCustomWords);

const processedWhitelistWords = rawWhitelistWords.map(word => normalizeTextForComparison(word));
if (processedWhitelistWords.length > 0) {
    filter.removeWords(...processedWhitelistWords);
    log.info(`[FILTRO] Palavras removidas da blacklist (whitelist): ${processedWhitelistWords.join(', ')}`);
}

/**
 * Filtra o conteúdo de uma mensagem, substituindo palavras ofensivas por asteriscos.
 * Esta função recebe o TEXTO ORIGINAL e o passa diretamente para `filter.clean()`.
 * O `bad-words` tem sua própria lógica interna de normalização e detecção de padrões.
 * @param {string} text A mensagem original a ser filtrada.
 * @returns {string} A mensagem com o conteúdo ofensivo substituído.
 */
function filterContent(text) {
    if (!text || typeof text !== 'string') {
        log.warn('Tentativa de filtrar conteúdo não textual ou vazio.');
        return '';
    }

    log.info(`[FILTRO] Recebendo texto original para filtrar: "${text}"`);

    let cleanedText = text;
    try {
        if (!/\w/.test(text)) {
            log.info('[FILTRO] Texto sem palavras detectado, ignorando filtro.');
            return text;
        }

        cleanedText = filter.clean(text);
    } catch (e) {
        log.error(`[FILTRO] Erro ao aplicar filtro de conteúdo para "${text}": ${e.message}`);
        return text;
    }

    // Se o texto foi realmente alterado pelo filtro
    if (cleanedText !== text) {
        log.info(`[FILTRO] Conteúdo mascarado: Original: "${text}" | Filtrado: "${cleanedText}"`);
    } else {
        log.info(`[FILTRO] Conteúdo não mascarado: "${text}"`);
    }

    return cleanedText; // Retorna a versão filtrada
}

/**
 * Verifica se uma mensagem é considerada altamente ofensiva, podendo justificar uma ação mais drástica.
 * Esta função utiliza a versão NORMALIZADA do texto para suas comparações.
 * @param {string} text A mensagem a ser avaliada.
 * @returns {boolean} True se a mensagem for altamente ofensiva, false caso contrário.
 */
function isHighlyOffensive(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    // Normaliza o texto para verificar termos altamente ofensivos.
    const lowerCaseNormalizedText = normalizeTextForComparison(text);

    // Adicione termos altamente ofensivos aqui, já normalizados (sem acentos, minúsculas).
    const highlyOffensiveTerms = rawHighlyOffensiveTerms.map(term => normalizeTextForComparison(term));

    const foundHighlyOffensive = highlyOffensiveTerms.some(term => lowerCaseNormalizedText.includes(term));

    if (foundHighlyOffensive) {
        log.warn(`🚨 [MODERACAO] Mensagem altamente ofensiva detectada: "${text}" (Normalizado para verificação: "${lowerCaseNormalizedText}")`);
    }

    return foundHighlyOffensive;
}

module.exports = {
    filterContent,
    isHighlyOffensive,
    filter // Expõe o objeto filter para permitir adição/remoção de palavras em tempo de execução, se necessário
};