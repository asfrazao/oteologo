const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nome:      { type: String, required: true },
  sobrenome: { type: String, required: true }, // Adicionado required para sobrenome
  nascimento: { type: Date, required: true }, // Adicionado required para nascimento
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true }, // Novo campo
  celular:   { type: String, required: true }, // Mantido como String, formato numérico é validado no controller
  login:     { type: String, required: true, unique: true, lowercase: true, trim: true }, // Apelido de login, agora case-insensitive no DB
  senha:     { type: String, required: true },
  role:      { type: String, default: 'user' }, // Novo campo para controle de acesso (ex: 'user', 'moderator', 'admin')
  refreshTokens: [
    {
      token: { type: String, required: true },
      expira: { type: Date, required: true }
    }
  ]
}, {
  timestamps: true // Opcional: Adiciona campos `createdAt` e `updatedAt` automaticamente
});

module.exports = mongoose.model('Usuario', usuarioSchema);