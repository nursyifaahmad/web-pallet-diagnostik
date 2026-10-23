const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'artuniverse_super_secret_jwt_key_2026';

function requireAuth(req, res, next) {
  let token = null;

  // 1. Check cookies
  if (req.cookies && req.cookies.pallet_token) {
    token = req.cookies.pallet_token;
  } 
  // 2. Check Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // If no token provided
  if (!token) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ status: 'error', message: 'Silakan login terlebih dahulu sebagai guru.' });
    }
    return res.redirect('/login/guru');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify role is teacher or admin
    if (!decoded || (decoded.role !== 'teacher' && decoded.role !== 'admin')) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ status: 'error', message: 'Akses ditolak: Hanya akun guru yang diperbolehkan.' });
      }
      return res.redirect('/login/guru');
    }

    req.user = decoded;
    next();
  } catch (err) {
    // If token is invalid or expired
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ status: 'error', message: 'Sesi login telah kedaluwarsa. Silakan login kembali.' });
    }
    res.clearCookie('pallet_token');
    return res.redirect('/login/guru');
  }
}

module.exports = {
  requireAuth,
  JWT_SECRET
};
