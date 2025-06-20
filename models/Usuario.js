const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  sobrenome: { type: String }, // ← não obrigatório
  nascimento: { type: Date },  // ← não obrigatório
  celular: { type: String },   // ← não obrigatório
  email: { type: String, required: true, unique: true },
  login: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  avatar: { type: String },
  perfil: { type: String, enum: ['usuario', 'moderador', 'admin'], default: 'usuario' },
  criadoEm: { type: Date, default: Date.now },
  refreshTokens: [
    {
      token: String,
      expira: Date,
    }
  ]
});

module.exports = mongoose.model('Usuario', usuarioSchema);
