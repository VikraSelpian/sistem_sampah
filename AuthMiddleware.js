// middlewares/authMiddleware.js

// Middleware untuk mengecek apakah pengguna sudah terautentikasi
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next(); // Jika pengguna terautentikasi, lanjutkan ke rute berikutnya
    }
    res.redirect('/'); // Jika tidak, arahkan ke halaman login
}

// Middleware untuk proteksi halaman berdasarkan role
function checkRole(role) {
    return (req, res, next) => {
        if (req.session.user && role.includes(req.session.user.role)) {
            return next(); // Jika pengguna terautentikasi dan memiliki role yang sesuai, lanjutkan
        } else {
            res.status(403).send('Anda tidak memiliki akses ke halaman ini.'); // Jika tidak, tampilkan pesan akses ditolak
        }
    };
}

// Ekspor middleware
module.exports = {
    isAuthenticated,
    checkRole
};
