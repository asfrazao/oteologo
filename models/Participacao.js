const mongoose = require('mongoose');

const ParticipacaoSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    sala: {
        type: String,
        required: true
    },
    dataEntrada: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Participacao', ParticipacaoSchema);
