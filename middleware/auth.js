const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[AUTH] Token não fornecido no header.');
    return res.status(401).json({ msg: 'Token não fornecido.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'segredo123');
    req.usuario = decoded;
    console.log('[AUTH] Token JWT OK | Usuário:', decoded.apelido || decoded.id);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      console.warn('[AUTH] Token expirado:', token.substring(0,12) + '...');
      return res.status(401).json({ msg: 'Token expirado' });
    }
    console.error('[AUTH] Token inválido:', err);
    res.status(401).json({ msg: 'Token inválido' });
  }
};
