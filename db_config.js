const mysql = require('mysql');

// Buat koneksi ke database MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // ganti dengan password MySQL Anda
  database: 'sistem_sampah'
});

// Cek koneksi ke MySQL
db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('Terkoneksi dengan database MySQL');
});

module.exports = db;
