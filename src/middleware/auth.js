const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'artuniverse_super_secret_jwt_key_2026';

function requireAuth(req, res, next) {
  let token = null;

  // Check cookies first
  if (req.cookies && req.cookies.pallet_token) {
    token = req.cookies.pallet_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ status: 'error', message: 'Silakan login terlebih dahulu sebagai guru.' });
    }
    return res.redirect('/login/guru');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ status: 'error', message: 'Sesi login telah kedaluwarsa atau tidak valid.' });
    }
    return res.redirect('/login/guru');
  }
}

module.exports = {
  requireAuth,
  JWT_SECRET
};
