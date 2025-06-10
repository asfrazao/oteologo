// models/SalaUsuario.js
const mongoose = require('mongoose');

const SalaUsuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true },
    criador: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, unique: true }, // um usuário só pode criar uma sala
    participantes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
    lastActive: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SalaUsuario', SalaUsuarioSchema);
