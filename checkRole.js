function checkRole(role) {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            return next(); 
        } else {
            req.flash('error', 'Anda tidak memiliki akses ke halaman ini.');
            return res.redirect('/'); 
        }
    };
}
