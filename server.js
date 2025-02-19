const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;

// Configuração do PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'arcade_estoque',
    password: '2604', // Altere para sua senha
    port: 5432,
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Rota de login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND senha = $2', [email, senha]);
        if (result.rows.length > 0) {
            const usuario = result.rows[0];
            const token = jwt.sign({ id: usuario.id, email: usuario.email, tipo: usuario.tipo }, 'secreto');
            res.json({ success: true, token });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao fazer login');
    }
});

// Middleware de autenticação
const autenticar = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).send('Acesso negado. Token não fornecido.');

    try {
        const decoded = jwt.verify(token, 'secreto');
        req.usuario = decoded;
        next();
    } catch (err) {
        res.status(400).send('Token inválido.');
    }
};

// Rota para listar produtos
app.get('/produtos', autenticar, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produtos');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar produtos');
    }
});

// Rota para adicionar produtos (apenas admin)
app.post('/produtos', autenticar, async (req, res) => {
    if (req.usuario.tipo !== 'admin') {
        return res.status(403).send('Acesso negado. Somente admin pode adicionar produtos.');
    }

    const { modelo, descricao, pn, foto, quantidade, centro_custo } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO produtos (modelo, descricao, pn, foto, quantidade, centro_custo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [modelo, descricao, pn, foto, quantidade, centro_custo]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao adicionar produto');
    }
});

// Rota para criar solicitação (solicitante)
app.post('/solicitacoes', autenticar, async (req, res) => {
    const { id_produto, quantidade } = req.body;
    const id_usuario = req.usuario.id;
    try {
        const result = await pool.query(
            'INSERT INTO solicitacoes (id_produto, id_usuario, quantidade) VALUES ($1, $2, $3) RETURNING *',
            [id_produto, id_usuario, quantidade]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao criar solicitação');
    }
});

// Rota para listar solicitações (apenas admin)
app.get('/solicitacoes', autenticar, async (req, res) => {
    if (req.usuario.tipo !== 'admin') {
        return res.status(403).send('Acesso negado. Somente admin pode ver solicitações.');
    }

    try {
        const result = await pool.query(`
            SELECT s.id, p.modelo, s.quantidade, s.status
            FROM solicitacoes s
            JOIN produtos p ON s.id_produto = p.id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar solicitações');
    }
});

// Rota para aprovar uma solicitação (apenas admin)
app.put('/solicitacoes/:id/aprovar', autenticar, async (req, res) => {
    if (req.usuario.tipo !== 'admin') {
        return res.status(403).send('Acesso negado. Somente admin pode aprovar solicitações.');
    }

    const { id } = req.params;
    try {
        await pool.query('UPDATE solicitacoes SET status = $1 WHERE id = $2', ['aprovada', id]);
        res.send('Solicitação aprovada');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao aprovar solicitação');
    }
});

// Rota para negar uma solicitação (apenas admin)
app.put('/solicitacoes/:id/negar', autenticar, async (req, res) => {
    if (req.usuario.tipo !== 'admin') {
        return res.status(403).send('Acesso negado. Somente admin pode negar solicitações.');
    }

    const { id } = req.params;
    try {
        await pool.query('UPDATE solicitacoes SET status = $1 WHERE id = $2', ['negada', id]);
        res.send('Solicitação negada');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao negar solicitação');
    }
});

// Rota para listar solicitações do solicitante
app.get('/solicitacoes-solicitante', autenticar, async (req, res) => {
    const id_usuario = req.usuario.id;
    try {
        const result = await pool.query(`
            SELECT s.id, p.modelo, s.quantidade, s.status
            FROM solicitacoes s
            JOIN produtos p ON s.id_produto = p.id
            WHERE s.id_usuario = $1
        `, [id_usuario]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar solicitações');
    }
});

// Iniciar servidor
app.listen(port, () => console.log(`Servidor rodando: http://localhost:${port}`));