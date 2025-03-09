const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer'); // เพิ่ม multer สำหรับจัดการการอัปโหลดไฟล์
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

// Session Setup
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// Multer Configuration for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/'); // โฟลเดอร์สำหรับเก็บไฟล์
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // ชื่อไฟล์ใหม่
    }
});
const upload = multer({ storage });

// Ensure the uploads directory exists
const fs = require('fs');
const dir = './public/uploads';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

// Routes
app.get('/', (req, res) => {
    if (req.session.loggedIn) {
        res.redirect('/admin');
    } else {
        res.redirect('/login');
    }
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login');
});

// Register Page
app.get('/register', (req, res) => {
    res.render('register');
});

// Admin Dashboard
app.get('/admin', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/login');

    const query = 'SELECT * FROM tblproduct';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.render('admin', { products: results });
    });
});

// Handle Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM tbladmin WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send('Invalid username or password');

        const match = await bcrypt.compare(password, results[0].password);
        if (match) {
            req.session.loggedIn = true;
            req.session.adminId = results[0].id;
            res.redirect('/admin');
        } else {
            res.send('Invalid username or password');
        }
    });
});

// Handle Registration
app.post('/register', async (req, res) => {
    const { username, password, admin_name, email, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = 'INSERT INTO tbladmin (username, password, admin_name, email, phone) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [username, hashedPassword, admin_name, email, phone], (err) => {
        if (err) throw err;
        res.redirect('/login');
    });
});

// Add Product with Image Upload
app.post('/add-product', upload.single('image'), (req, res) => {
    const { product_code, product_name, price, quantity } = req.body;
    const image = req.file ? req.file.filename : null; // เก็บชื่อไฟล์ภาพ
    const query = 'INSERT INTO tblproduct (product_code, product_name, price, quantity, image) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [product_code, product_name, price, quantity, image], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// Delete Product
app.get('/delete-product/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM tblproduct WHERE product_id = ?';
    db.query(query, [id], (err) => {
        if (err) throw err;
        res.redirect('/product-list');
    });
});

// Show Edit Product Form
app.get('/edit-product/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM tblproduct WHERE product_id = ?';
    db.query(query, [id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send('Product not found');
        res.render('edit-product', { product: results[0] });
    });
});

// Update Product
// Update Product
app.post('/update-product/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { product_code, product_name, price, quantity } = req.body;
    const image = req.file ? req.file.filename : null; // อัปเดตชื่อไฟล์ภาพ
    let query, params;

    if (image) {
        query = 'UPDATE tblproduct SET product_code = ?, product_name = ?, price = ?, quantity = ?, image = ? WHERE product_id = ?';
        params = [product_code, product_name, price, quantity, image, id];
    } else {
        query = 'UPDATE tblproduct SET product_code = ?, product_name = ?, price = ?, quantity = ? WHERE product_id = ?';
        params = [product_code, product_name, price, quantity, id];
    }

    db.query(query, params, (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});
// Search Product
app.post('/search', (req, res) => {
    const { search } = req.body;
    const query = 'SELECT * FROM tblproduct WHERE product_name LIKE ? OR product_code LIKE ?';
    db.query(query, [`%${search}%`, `%${search}%`], (err, results) => {
        if (err) throw err;
        res.render('admin', { products: results });
    });
});

// Show Product List Page
app.get('/product-list', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/login');

    const query = 'SELECT * FROM tblproduct';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.render('product-list', { products: results });
    });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});