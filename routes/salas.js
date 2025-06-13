
// Função para destacar @apelido nas mensagens
function destacarMencoes(texto) {
  return texto.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}


const express = require('express');
const router = express.Router();
const SalaUsuario = require('../models/SalaUsuario');
const Usuario = require('../models/Usuario');
const auth = require('../middleware/auth');

// LISTAR salas criadas por usuários
router.get('/usuario', async (req, res) => {
    try {
        const limiteInatividade = new Date(Date.now() - 10 * 60 * 1000);
        await SalaUsuario.deleteMany({ lastActive: { $lt: limiteInatividade } });

        // Popula 'criador' com login e apelido!
        const salas = await SalaUsuario.find().populate('criador', 'login apelido').lean();
        const lista = salas.map(sala => ({
            nome: sala.nome,
            criador: sala.criador.login || sala.criador.apelido || sala.criador._id,
            total: sala.participantes.length
        }));
        console.log('[SALAS] Listando salas de usuário:', lista.length);
        res.json(lista);
    } catch (err) {
        console.error('[SALAS] ERRO ao listar salas:', err);
        res.status(500).json({ msg: 'Erro ao listar salas de usuários.' });
    }
});

// CRIAR nova sala por usuário
router.post('/usuario', auth, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        if (!usuarioId) {
            console.warn('[SALAS] POST /usuario | Usuário não autenticado.');
            return res.status(401).json({ msg: 'Usuário não autenticado.' });
        }

        const jaTemSala = await SalaUsuario.findOne({ criador: usuarioId });
        if (jaTemSala) return res.status(400).json({ msg: 'Você já criou uma sala.' });

        const totalSalas = await SalaUsuario.countDocuments();
        if (totalSalas >= 15) return res.status(400).json({ msg: 'Limite máximo de salas atingido.' });

        const { nome } = req.body;
        if (!nome || nome.length < 3) return res.status(400).json({ msg: 'Nome de sala inválido.' });

        const existeNome = await SalaUsuario.findOne({ nome });
        if (existeNome) return res.status(400).json({ msg: 'Já existe uma sala com esse nome.' });

        const sala = await SalaUsuario.create({
            nome,
            criador: usuarioId,
            participantes: [usuarioId],
            lastActive: new Date()
        });
        console.log('[SALAS] Sala criada:', sala.nome, '| por:', usuarioId);
        res.json({ msg: 'Sala criada com sucesso.', salaNome: sala.nome });
    } catch (err) {
        console.error('[SALAS] ERRO ao criar sala:', err);
        res.status(500).json({ msg: 'Erro ao criar sala.' });
    }
});

// ENTRAR em sala de usuário
router.post('/usuario/:nome/entrar', auth, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const nomeSala = req.params.nome;

        const sala = await SalaUsuario.findOne({ nome: nomeSala });
        if (!sala) return res.status(404).json({ msg: 'Sala não encontrada.' });

        if (!sala.participantes.includes(usuarioId)) {
            sala.participantes.push(usuarioId);
        }
        sala.lastActive = new Date();
        await sala.save();

        console.log('[SALAS] Usuário entrou na sala:', nomeSala, '| usuario:', usuarioId);
        res.json({ msg: 'Entrou na sala com sucesso.' });
    } catch (err) {
        console.error('[SALAS] ERRO ao entrar na sala:', err);
        res.status(500).json({ msg: 'Erro ao entrar na sala.' });
    }
});

// SAIR da sala de usuário
router.post('/usuario/:nome/sair', auth, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const nomeSala = req.params.nome;

        const sala = await SalaUsuario.findOne({ nome: nomeSala });
        if (!sala) return res.status(404).json({ msg: 'Sala não encontrada.' });

        // Remove usuário dos participantes
        sala.participantes = sala.participantes.filter(u => u.toString() !== usuarioId);
        sala.lastActive = new Date();

        // Remove a sala imediatamente se não restar nenhum participante
        if (sala.participantes.length === 0) {
            await sala.deleteOne();
            console.log('[SALAS] Sala removida IMEDIATAMENTE pois ficou vazia:', nomeSala);
            return res.json({ msg: 'Saiu da sala. Sala removida pois ficou vazia.' });
        } else {
            await sala.save();
            console.log('[SALAS] Usuário saiu da sala:', nomeSala, '| usuario:', usuarioId);
            return res.json({ msg: 'Saiu da sala com sucesso.' });
        }
    } catch (err) {
        console.error('[SALAS] ERRO ao sair da sala:', err);
        res.status(500).json({ msg: 'Erro ao sair da sala.' });
    }
});

// Atualiza lastActive ao enviar mensagem
router.post('/usuario/:nome/mensagem', auth, async (req, res) => {
    try {
        const nomeSala = req.params.nome;
        const sala = await SalaUsuario.findOne({ nome: nomeSala });
        if (sala) {
            sala.lastActive = new Date();
            await sala.save();
        }
        res.json({ msg: 'Atividade da sala atualizada.' });
    } catch (err) {
        console.error('[SALAS] ERRO ao atualizar atividade:', err);
        res.status(500).json({ msg: 'Erro ao atualizar atividade da sala.' });
    }
});

// ================= Salas fixas (em memória) ==================
const salasFixas = [
    'Escatologia',
    'Trindade',
    'Livre Arbítrio',
    'Soteriologia',
    'Bibliologia',
    'Cristologia',
    'Ateus',
    'Católicos',
    'Pentecostais',
    'Adventistas',
    'Presbiterianos',
    'Batistas',
    'Testemunhas da Jeova',
    'Mórmons'
];
let participantesSalasFixas = {};

router.post('/:nome/entrar', auth, (req, res) => {
    const nome = req.params.nome;
    if (!salasFixas.includes(nome)) return res.status(404).json({ msg: 'Sala fixa não encontrada.' });
    const apelido = req.usuario.apelido;
    if (!participantesSalasFixas[nome]) participantesSalasFixas[nome] = [];
    if (!participantesSalasFixas[nome].includes(apelido)) participantesSalasFixas[nome].push(apelido);
    console.log('[SALAS] Usuário entrou na sala fixa:', nome, '| apelido:', apelido);
    res.json({ msg: 'Entrou na sala fixa.' });
});

router.post('/sair', auth, (req, res) => {
    const apelido = req.usuario.apelido;
    for (const nome of salasFixas) {
        if (participantesSalasFixas[nome]) {
            participantesSalasFixas[nome] = participantesSalasFixas[nome].filter(a => a !== apelido);
        }
    }
    console.log('[SALAS] Usuário saiu de todas as salas fixas:', apelido);
    res.json({ msg: 'Saiu das salas fixas.' });
});

router.get('/:nome/participantes', (req, res) => {
    const nome = req.params.nome;
    if (!salasFixas.includes(nome)) return res.json({ total: 0 });
    const total = participantesSalasFixas[nome]?.length || 0;
    res.json({ total });
});

module.exports = router;
