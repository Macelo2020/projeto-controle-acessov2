
// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const mongoose = require('mongoose'); // <-- NOVO: Importa o Mongoose

const app = express();
const PORT = process.env.PORT || 3000;

// Conecta ao banco de dados MongoDB
mongoose.connect(process.env.MONGODB_URI) // <-- USA A VARIÁVEL DE AMBIENTE DO RENDER
    .then(() => console.log('Conectado ao MongoDB.'))
    .catch(err => console.error('Erro de conexão ao MongoDB:', err));

// Define o esquema (schema) do registro de acesso
const AcessoSchema = new mongoose.Schema({
    matricula: String,
    nome: String,
    status: String,
    dataHora: { type: Date, default: Date.now }
});

const Acesso = mongoose.model('Acesso', AcessoSchema);

// Serve arquivos estáticos da pasta 'public'
app.use(express.static('public'));
app.use(express.json());

const SENHA_ADMIN_ZERAR = process.env.SENHA_ADMIN_ZERAR || 'suasenha123';

// ----------------------------------------------------
// Lógica de Leitura de Matrículas e Nomes
// ----------------------------------------------------
function lerDadosDoCSV(nomeDoArquivo) {
    const caminhoDoArquivo = path.join(__dirname, nomeDoArquivo);
    try {
        const conteudo = fs.readFileSync(caminhoDoArquivo, 'utf8');
        const linhas = conteudo.trim().split('\n');
        linhas.shift(); // Remove o cabeçalho
        return linhas.map(linha => {
            const [matricula, nome] = linha.split(';');
            return { matricula: matricula.trim(), nome: nome.trim() };
        });
    } catch (erro) {
        console.error(`Erro ao ler o arquivo CSV: ${erro.message}`);
        return [];
    }
}

const listaDeFuncionarios = lerDadosDoCSV('matriculas.csv');
console.log(`Carregadas ${listaDeFuncionarios.length} matrículas para a memória.`);

// ----------------------------------------------------
// Lógica de Log e Relatório (Agora usando o MongoDB)
// ----------------------------------------------------

async function registrarAcesso(matricula, nome, status) {
    try {
        const novoAcesso = new Acesso({ matricula, nome, status });
        await novoAcesso.save();
    } catch (err) {
        console.error('Erro ao registrar acesso no banco de dados:', err);
    }
}

async function jaAcessouHoje(matricula) {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const count = await Acesso.countDocuments({
            matricula: matricula,
            status: 'concedido',
            dataHora: { $gte: hoje }
        });
        return count > 0;
    } catch (err) {
        console.error('Erro ao verificar acesso no banco de dados:', err);
        return false;
    }
}

// Rotas (com alterações para usar as funções do MongoDB)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/verificar-acesso', async (req, res) => {
    const { matricula } = req.body;
    const funcionario = listaDeFuncionarios.find(f => f.matricula === matricula);

    if (!funcionario) {
        await registrarAcesso(matricula, 'Desconhecido', 'negado');
        return res.status(401).json({ mensagem: 'Acesso negado. Matrícula não encontrada.' });
    }

    if (await jaAcessouHoje(matricula)) {
        await registrarAcesso(matricula, funcionario.nome, 'negado (acesso duplicado)');
        return res.status(403).json({ mensagem: `${funcionario.nome}, você já verificou seu acesso hoje.` });
    }

    await registrarAcesso(matricula, funcionario.nome, 'concedido');
    res.status(200).json({ mensagem: 'Acesso concedido. Bem-vindo, ', nome: funcionario.nome, status: 'aprovado' });
});

app.get('/relatorio-diario', async (req, res) => {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const registrosDeHoje = await Acesso.find({
            dataHora: { $gte: hoje }
        });

        let acessosConcedidos = 0;
        let matriculasNegadas = new Set();
        
        registrosDeHoje.forEach(registro => {
            if (registro.status === 'concedido') {
                acessosConcedidos++;
            } else if (registro.status.includes('negado')) {
                matriculasNegadas.add(registro.matricula);
            }
        });

        const relatorio = `
Relatório Diário - ${hoje.toISOString().split('T')[0]}
----------------------------------
Total de Solicitações: ${registrosDeHoje.length}
Acessos Concedidos: ${acessosConcedidos}
Matrículas Negadas: ${[...matriculasNegadas].join(', ')}
----------------------------------
`;
        res.status(200).send(relatorio);
    } catch (erro) {
        res.status(500).send(`Erro ao gerar o relatório: ${erro.message}`);
    }
});

app.get('/api/zerar-relatorio', async (req, res) => {
    const { senha } = req.query;
    if (senha !== SENHA_ADMIN_ZERAR) {
        return res.status(401).send("Acesso negado. Senha incorreta.");
    }
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        await Acesso.deleteMany({ dataHora: { $lt: hoje } });
        res.status(200).send('Registros antigos zerados com sucesso!');
    } catch (erro) {
        res.status(500).send(`Erro ao zerar o relatório: ${erro.message}`);
    }
});

// Tarefa agendada para limpar o banco de dados à meia-noite
cron.schedule('0 0 * * *', async () => {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        await Acesso.deleteMany({ dataHora: { $lt: hoje } });
        console.log('Registros antigos do banco de dados limpos com sucesso!');
    } catch (erro) {
        console.error(`Erro ao limpar o banco de dados: ${erro.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});