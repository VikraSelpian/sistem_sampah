// ===============================
// Import Library
// ===============================
const express = require('express');
const engine = require('ejs-locals');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');

// ===============================
// Konfigurasi Multer untuk Upload
// ===============================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public/uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ===============================
// Inisialisasi Aplikasi
// ===============================
const app = express();
const port = 3000;

// ===============================
// Atur View Engine
// ===============================
app.engine('ejs', engine);
app.set('view cache', false);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// Middleware
// ===============================
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true
}));

// ===============================
// Koneksi ke Database MySQL
// ===============================
let db;
(async () => {
    try {
        db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'sistem_sampah'
        });
        console.log('Server Terhubung ke MySQL!');
    } catch (error) {
        console.error('Gagal terhubung ke MySQL:', error);
    }
})();

// ===============================
// Middleware untuk Autentikasi
// ===============================
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/'); // Jika tidak terautentikasi, arahkan ke halaman login
}

function checkRole(...role) {
    return (req, res, next) => {
        if (req.session.user && role.includes(req.session.user.role)) {
            return next(); 
        } else {
            req.flash('error', 'Anda tidak memiliki akses ke halaman ini.');
            return res.redirect('/'); 
        }
    };
}


// ===============================
// Konfigurasi Nodemailer
// ===============================
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: "vikraselpian@gmail.com",
        pass: "stbc deit eina amze",
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('Koneksi gagal:', error);
    } else {
        console.log('Koneksi berhasil!');
    }
});

// ===============================
// Route: Halaman Login
// ===============================
app.get('/', (req, res) => {
    res.render('login');
});

// ===============================
// Route: Halaman Lupa Password
// ===============================
app.get('/lupa-password', (req, res) => {
    res.render('lupa-password'); 
});

app.post('/lupa-password', async (req, res) => {
    const { identifier } = req.body;

    if (!identifier) {
        return res.status(400).send('Email tidak boleh kosong.');
    }

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [identifier]);

        if (results.length > 0) {
            const user = results[0];
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpires = new Date(Date.now() + 3600000);

            await db.query('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?', [resetToken, resetTokenExpires, user.id]);

            const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
            const mailOptions = {
                from: 'WEB SISTE_SAMPAH',
                to: user.email,
                subject: 'Reset Password',
                text: `Silakan klik link berikut untuk mereset password Anda: ${resetLink}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return console.error('Gagal mengirim email:', error);
                }
                console.log('Email terkirim:', info.response );
            });

            res.send('Link untuk reset password telah dikirim ke email Anda.'); 
        } else {
            res.status(404).send('Pengguna dengan email tersebut tidak ditemukan.'); 
        }
    } catch (error) {
        console.error('Error saat melakukan reset password:', error);
        res.status(500).send('Terjadi kesalahan saat memproses reset password.');
    }
});

// ===============================
// Route: Halaman Reset Password
// ===============================
app.get('/reset-password/:token', async (req, res) => {
    const { token } = req.params;

    try {
        const [results] = await db.query('SELECT * FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()', [token]);

        if (results.length > 0) {
            res.render('reset-password', { token }); 
        } else {
            res.status(400).send('Token tidak valid atau telah kedaluwarsa.');
        }
    } catch (error) {
        console.error('Error saat memvalidasi token reset password:', error);
        res.status(500).send('Terjadi kesalahan saat memproses permintaan.');
    }
});

app.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        const [results] = await db.query('SELECT * FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()', [token]);

        if (results.length > 0) {
            const hashedPassword = await bcrypt.hash(password, 10);

            await db.query('UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?', [hashedPassword, results[0].id]);

            return res.render('login'); 
        } else {
            return res.status(400).send('Token reset password tidak valid atau telah kadaluarsa.');
        }
    } catch (error) {
        console.error('Error saat mereset password:', error);
        return res.status(500).send('Gagal mereset password.');
    }
});

// ===============================
// Route: Proses Login
// ===============================
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [results] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);

        if (results.length > 0) {
            const user = results[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    email: user.email,
                    no_hp: user.no_hp,
                    alamat: user.alamat,
                    profile_picture: user.profile_picture
                };

                if (user.role === 'admin') {
                    res.redirect('/admin');
                } else if (user.role === 'petugas') {
                    res.redirect('/petugas/petugas_kebersihan');
                } else if (user.role === 'guru') {
                    res.redirect('/guru/guru');
                } else {
                    res.redirect('/');
                }
            } else {
                res.send('Login gagal, password salah.');
            }
        } else {
            res.send('Login gagal, username atau email tidak ditemukan.');
        }
    } catch (error) {
        console.error('Error saat login:', error);
        res.status(500).send('Terjadi kesalahan saat login');
    }
});

// ===============================
// Route: Halaman Admin
// ===============================
app.get('/admin', isAuthenticated, checkRole('admin'), async (req, res) => {
    try {
        const [result] = await db.query('SELECT * FROM data_sensor ORDER BY timestamp DESC LIMIT 1');

        const sensorData = result.length > 0 ? {
            organik: result[0].organik,
            non_organik: result[0].non_organik,
            metal: result[0].metal
        } : { organik: 0, non_organik: 0, metal: 0 };

        res.render('admin/admin', { user: req.session.user, sensorData });
    } catch (error) {
        console.error('Error saat mengambil data sensor:', error);
        res.status(500).send('Gagal mengambil data sensor');
    }
});

// ===============================
// Route: Halaman Settings
// ===============================
app.get('/settings/:id', isAuthenticated, checkRole('admin'), async (req, res) => {
    const { id } = req.params;
    
    try {
        const [results] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (results.length > 0) {
            res.render('admin/settings', { user: results[0] }); 
        } else {
            res.status(404).send('User tidak ditemukan');
        }
    } catch (error) {
        console.error('Error saat mengambil data sensor:', error);
        res.status(500).send('Gagal mengambil data sensor');
    } 
});

// ===============================
// Route: Update User Settings
// ===============================
app.post('/settings/update', isAuthenticated, checkRole('admin'), async (req, res) => {
    const { username, no_hp, email, alamat } = req.body;
    console.log({username, no_hp, email, alamat});

    let updateQuery = 'UPDATE users SET username = ?, no_hp = ?, email = ?, alamat = ?';
    const updateValues = [username, no_hp, email, alamat];

    if (req.file) {
        updateQuery += ', profile_picture = ?';
        updateValues.push(req.file.filename); 
    }

    updateQuery += ' WHERE id = ?';
    updateValues.push(req.session.user.id); 

    try {
        const [result] = await db.query(updateQuery, updateValues);
        if (result.affectedRows > 0) {
            req.session.user.username = username;
            req.session.user.no_hp = no_hp;
            req.session.user.email = email;
            req.session.user.alamat = alamat;
            if (req.file) {
                req.session.user.profile_picture = req.file.filename; 
            }
            res.redirect('/admin');   
        } else {
            res.status(400).send('No changes made or user not found.');
        }
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).send('Error updating user settings.');
    }
});

// ===============================
// Route: Tambah User Baru
// ===============================
app.get('/tambahuser', isAuthenticated, checkRole('admin'), (req, res) => {
    res.render('admin/tambahuser' , { user: req.session.user });
});

app.post('/add-user', upload.single('profile_picture'), async (req, res) => {
    const { username, password, email, no_hp, alamat, role } = req.body;
    const profilePicture = req.file ? req.file.filename : null; 

    console.log({
        username, 
        password, 
        email, 
        no_hp, 
        alamat, 
        role, 
        profilePicture
    });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            'INSERT INTO users (username, password, email, no_hp, alamat, role, profile_picture) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, email, no_hp, alamat, role, profilePicture]
        );

        res.redirect('/users'); 
    } catch (error) {
        console.error('Error while adding a user:', error);
        res.status(500).send('Gagal menambah user');
    }
});

// ===============================
// Route: Edit User
// ===============================
app.get('/edit-user/:id', isAuthenticated, checkRole('admin'), async (req, res) => {
    const { id } = req.params;

    try {
        const [results] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (results.length > 0) {
            res.render('admin/edituser', { user: results[0] })  ,{ user: req.session.user }
        } else {
            res.status(404).send('User tidak ditemukan');
        }
    } catch (error) {
        console.error('Error saat mengambil data user untuk edit:', error);
        res.status(500).send('Gagal mengambil data user');
    }
});

app.post('/update-user/:id', isAuthenticated, checkRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { username, email, no_hp, alamat, role, password } = req.body;

    if (!username || !email || !no_hp || !alamat || !role) {
        return res.status(400).send('Data tidak lengkap');
    }

    try {
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query('UPDATE users SET username = ?, email = ?, no_hp = ?, alamat = ?, role = ?, password = ? WHERE id = ?', 
                           [username, email, no_hp, alamat, role, hashedPassword, id]);
        } else {
            await db.query('UPDATE users SET username = ?, email = ?, no_hp = ?, alamat = ?, role = ? WHERE id = ?', 
                           [username, email, no_hp, alamat, role, id]);
        }
        res.redirect('/users');
    } catch (error) {
        console.error('Error saat memperbarui user:', error);
        res.status(500).send('Gagal memperbarui user');
    }
});

// ===============================
// Route: Hapus User
// ===============================
app.post('/delete-user/:id', isAuthenticated, checkRole('admin'), async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.status(200).json({ message: 'User berhasil dihapus' }); 
    } catch (error) {
        console.error('Error saat menghapus user:', error);
        res.status(500).json({ message: 'Gagal menghapus user' });
    }
});

// ===============================
// Route: Daftar User
// ===============================
app.get('/users', isAuthenticated, checkRole('admin'), async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM users');
        res.render('admin/users', { user: req.session.user, users: results }); // Render halaman daftar user di folder 'admin'
    } catch (error) {
        console.error('Error saat mengambil data user dari database:', error);
        res.status(500).send('Gagal mengambil data user');
    }
});

// ===============================
// Route: History
// ===============================
app.get('/history', isAuthenticated, checkRole('admin'), (req, res) => {
    res.render('admin/history', { user: req.session.user });
});

// ===============================
// Route: Status
// ===============================
app.get('/status', isAuthenticated, checkRole('admin'), (req, res) => {
    res.render('admin/status', { user: req.session.user });; 
});

// ===============================
// Route: Lokasi
// ===============================
app.get('/lokasi', isAuthenticated, checkRole('admin'), (req, res) => {
    res.render('admin/lokasi' , { user: req.session.user });; 
});

// ===============================
// Route: Notifikasi
// ===============================
app.get('/notifikasi', (req, res) => {
    res.render('admin/notifikasi'); 
});

// ===============================
// Route: API Data
// ===============================
app.post('/api/data', async (req, res) => {
    const { organik, non_organik, metal } = req.body;

    if (!organik || !non_organik || !metal) {
        return res.status(400).send('Data tidak lengkap');
    }

    try {
        await db.query('INSERT INTO data_sensor (organik, non_organik, metal) VALUES (?, ?, ?)', 
                       [organik, non_organik, metal]);
        res.send('Data berhasil dimasukkan');
    } catch (error) {
        console.error('Error saat memasukkan data sensor:', error);
        res.status(500).send('Gagal memasukkan data');
    }
});

app.get('/api/data', async (req, res) => {
    try {
        const [result] = await db.query('SELECT * FROM data_sensor ORDER BY timestamp DESC LIMIT 1');
        
        res.json({
            organik: result[0]. organik,
            non_organik: result[0].non_organik,
            metal: result[0].metal
        });
    } catch (error) {
        console.error('Error saat mengambil data sensor:', error);
        res.status(500).send('Gagal mengambil data');
    }
});

// ==========================================================//
//                  PETUGAS KEBERSIHAN PUNYA                 //
// ==========================================================//
// ===============================
// Route: Halaman Petugas
// ===============================
app.get('/petugas/petugas_kebersihan', isAuthenticated, checkRole('petugas' , 'admin'), async (req, res) => {
    try {
        const [result] = await db.query('SELECT * FROM data_sensor ORDER BY timestamp DESC LIMIT 1');

        const sensorData = result.length > 0 ? {
            organik: result[0].organik,
            non_organik: result[0].non_organik,
            metal: result[0].metal
        } : { organik: 0, non_organik: 0, metal: 0 };

        res.render('petugas/petugas_kebersihan', { user: req.session.user, sensorData });
    } catch (error) {
        console.error('Error saat mengambil data sensor:', error);
        res.status(500).send('Gagal mengambil data sensor');
    }
});

// ===============================
// Route: Halaman Settings
// ===============================
app.get('/petugas/settings/:id', isAuthenticated, checkRole('petugas' , 'admin'), async (req, res) => {
    const { id } = req.params;
    
    try {
        const [results] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (results.length > 0) {
            res.render('petugas/petugas_settings', { user: results[0] }); 
        } else {
            res.status(404).send('User tidak ditemukan');
        }
    } catch (error) {
        console.error('Error saat mengambil data sensor:', error);
        res.status(500).send('Gagal mengambil data sensor');
    } 
});

// ===============================
// Route: Update User Settings
// ===============================
app.post('/petugas/settings/update', isAuthenticated, checkRole('petugas' , 'admin'), async (req, res) => {
    const { username, no_hp, email, alamat } = req.body;
    console.log({username, no_hp, email, alamat});

    let updateQuery = 'UPDATE users SET username = ?, no_hp = ?, email = ?, alamat = ?';
    const updateValues = [username, no_hp, email, alamat];

    if (req.file) {
        updateQuery += ', profile_picture = ?';
        updateValues.push(req.file.filename); 
    }

    updateQuery += ' WHERE id = ?';
    updateValues.push(req.session.user.id); 

    try {
        const [result] = await db.query(updateQuery, updateValues);
        if (result.affectedRows > 0) {
            req.session.user.username = username;
            req.session.user.no_hp = no_hp;
            req.session.user.email = email;
            req.session.user.alamat = alamat;
            if (req.file) {
                req.session.user.profile_picture = req.file.filename; 
            }
            res.redirect(`/petugas/settings/${req.session.user.id}`);   
        } else {
            res.status(400).send('No changes made or user not found.');
        }
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).send('Error updating user settings.');
    }
});

// ===============================
// Route: Status
// ===============================
app.get('/petugas/status', isAuthenticated, checkRole('petugas' , 'admin'), (req, res) => {
    res.render('petugas/petugas_status', { user: req.session.user }); 
});

// ===============================
// Route: Lokasi
// ===============================
app.get('/petugas/lokasi', isAuthenticated, checkRole('petugas' , 'admin'), (req, res) => {
    res.render('petugas/petugas_lokasi', { user: req.session.user }); 
});

// ===============================
// Route: Lokasi
// ===============================
app.get('/petugas/history', isAuthenticated, checkRole('petugas' , 'admin'), (req, res) => {
    res.render('petugas/petugas_history', { user: req.session.user }); 
});


// ==========================================================//
//                  GURU PUNYA                 //
// ==========================================================//
// ===============================
// Route: Halaman Petugas
// ===============================
app.get('/guru/guru', isAuthenticated, checkRole('guru' , 'admin'), async (req, res) => {
    try {
        const [result] = await db.query('SELECT * FROM data_sensor ORDER BY timestamp DESC LIMIT 1');

        const sensorData = result.length > 0 ? {
            organik: result[0].organik,
            non_organik: result[0].non_organik,
            metal: result[0].metal
        } : { organik: 0, non_organik: 0, metal: 0 };

        res.render('guru/guru', { user: req.session.user, sensorData });
    } catch (error) {
        console.error('Error saat mengambil data sensor:', error);
        res.status(500).send('Gagal mengambil data sensor');
    }
});

// ===============================
// Route: Halaman Settings
// ===============================
app.get('/guru/settings/:id', isAuthenticated, checkRole('guru' , 'admin'), async (req, res) => {
    const { id } = req.params;
    
    try {
        const [results] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (results.length > 0) {
            res.render('guru/guru_settings', { user: results[0] }); 
        } else {
            res.status(404).send('User tidak ditemukan');
        }
    } catch (error) {
        console.error('Error saat mengambil data sensor:', error);
        res.status(500).send('Gagal mengambil data sensor');
    } 
});

// ===============================
// Route: Update User Settings
// ===============================
app.post('/guru/settings/update', isAuthenticated, checkRole('guru' , 'admin'), async (req, res) => {
    const { username, no_hp, email, alamat } = req.body;
    console.log({username, no_hp, email, alamat});

    let updateQuery = 'UPDATE users SET username = ?, no_hp = ?, email = ?, alamat = ?';
    const updateValues = [username, no_hp, email, alamat];

    if (req.file) {
        updateQuery += ', profile_picture = ?';
        updateValues.push(req.file.filename); 
    }

    updateQuery += ' WHERE id = ?';
    updateValues.push(req.session.user.id); 

    try {
        const [result] = await db.query(updateQuery, updateValues);
        if (result.affectedRows > 0) {
            req.session.user.username = username;
            req.session.user.no_hp = no_hp;
            req.session.user.email = email;
            req.session.user.alamat = alamat;
            if (req.file) {
                req.session.user.profile_picture = req.file.filename; 
            }
            res.redirect(`/guru/settings/${req.session.user.id}`);   
        } else {
            res.status(400).send('No changes made or user not found.');
        }
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).send('Error updating user settings.');
    }
});

// ===============================
// Route: Status
// ===============================
app.get('/guru/status', isAuthenticated, checkRole('guru' , 'admin'), (req, res) => {
    res.render('guru/guru_status', { user: req.session.user }); 
});

// ===============================
// Route: Lokasi
// ===============================
app.get('/guru/lokasi', isAuthenticated, checkRole('guru' , 'admin'), (req, res) => {
    res.render('guru/guru_lokasi', { user: req.session.user }); 
});

// ===============================
// Route: History
// ===============================
app.get('/guru/history', isAuthenticated, checkRole('guru' , 'admin'), (req, res) => {
    res.render('guru/guru_history', { user: req.session.user }); 
});


// ===============================
// Route: Logout
// ===============================
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ===============================
// Jalankan Server
// ===============================
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});