const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nome:      { type: String, required: true },
  sobrenome: String,
  nascimento: Date,
  rg:        { type: String, unique: true, sparse: true },
  cpf:       { type: String, unique: true, sparse: true },
  celular:   String,
  cep:       String,
  rua:       String,
  numero:    String,
  cidade:    String,
  estado:    String,
  pais:      String,
  login:     { type: String, required: true, unique: true },
  senha:     { type: String, required: true },
  refreshTokens: [
    {
      token: { type: String, required: true },
      expira: { type: Date, required: true }
    }
  ]
});

module.exports = mongoose.model('Usuario', usuarioSchema);
