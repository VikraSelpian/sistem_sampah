const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function init() {
    try {
        const db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'sistem_sampah'
        });

        console.log('Database terhubung!');

        const adminPassword = 'admin123';
        const petugasPassword = 'petugas123';
        const guruPassword = 'guru123';

        const adminData = {
            username: 'admin',
            email: 'admin@gmail.com',
            no_hp: '08123456789',
            alamat: 'Batuaji',
            role: 'admin',
        };

        const petugasData = {
            username: 'Vikraselpian',
            email: 'vikraselpian@gmail.com',
            no_hp: '085272343255',
            alamat: 'Tembesi',
            role: 'petugas',
        };

        const guruData = {
            username: 'guru123',
            email: 'guru@gmail.com',
            no_hp: '08123456780',
            alamat: 'Batam Center',
            role: 'guru',
        };

        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
        const hashedPetugasPassword = await bcrypt.hash(petugasPassword, 10);
        const hashedGuruPassword = await bcrypt.hash(guruPassword, 10);

        const insertQueries = [
            db.query(
                'INSERT INTO users (username, email, no_hp, alamat, password, role) VALUES (?, ?, ?, ?, ?, ?)', 
                [adminData.username, adminData.email, adminData.no_hp, adminData.alamat, hashedAdminPassword, adminData.role]
            ),
            db.query(
                'INSERT INTO users (username, email, no_hp, alamat, password, role) VALUES (?, ?, ?, ?, ?, ?)', 
                [petugasData.username, petugasData.email, petugasData.no_hp, petugasData.alamat, hashedPetugasPassword, petugasData.role]
            ),
            db.query(
                'INSERT INTO users (username, email, no_hp, alamat, password, role) VALUES (?, ?, ?, ?, ?, ?)', 
                [guruData.username, guruData.email, guruData.no_hp, guruData.alamat, hashedGuruPassword, guruData.role]
            )
        ];

        // Tunggu hingga semua query selesai
        const results = await Promise.all(insertQueries);
        console.log('Hasil query:', results);

        console.log('Pengguna berhasil ditambahkan!');
        
        await db.end();
        
    } catch (err) {
        console.error('Terjadi kesalahan:', err);
    }
}

// Panggil fungsi init untuk memulai proses
init();
