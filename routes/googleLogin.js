const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

router.post('/', async (req, res) => {
    try {
        const { sub, email, name, picture } = req.body;

        if (!sub || !email || !name) {
            return res.status(400).json({ msg: "Dados incompletos do Google" });
        }

        // Verifica se já existe pelo e-mail
        let usuario = await Usuario.findOne({ email });

        if (!usuario) {
            // Gera login único baseado no nome
            const baseLogin = name.replace(/\s+/g, '').toLowerCase();
            let loginFinal = baseLogin;
            let contador = 1;

            while (await Usuario.findOne({ login: loginFinal })) {
                loginFinal = `${baseLogin}${contador}`;
                contador++;
            }

            // Cria o novo usuário
            usuario = await Usuario.create({
                nome: name,
                login: loginFinal,
                email,
                avatar: picture,
                viaGoogle: true,
                senha: sub,
                perfil: 'usuario'
            });
        }

        const token = jwt.sign(
            { id: usuario._id, login: usuario.login },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            token,
            apelido: usuario.login,
            avatar: usuario.avatar
        });
    } catch (err) {
        console.error('Erro ao autenticar com Google:', err);
        res.status(500).json({ msg: 'Erro interno' });
    }
});

module.exports = router;
