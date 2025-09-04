// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Senha para a rota de administração
const SENHA_ADMIN_ZERAR = 'adm@123';

// Middleware para processar JSON e dados de formulário
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão com o MongoDB
const uri = process.env.MONGODB_URI;
mongoose.connect(uri)
    .then(() => console.log('Conectado ao MongoDB!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Definição do Schema e Modelo do Mongoose
const acessoSchema = new mongoose.Schema({
    matricula: String,
    nome: String,
    status: String,
    data_acesso: { type: Date, default: Date.now }
}, { collection: 'acessos' });

const Acesso = mongoose.model('Acesso', acessoSchema);

// ----------------------------------------------------
// Lógica de Leitura de Matrículas e Nomes
// ----------------------------------------------------
let listaDeFuncionarios = [];

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

// Carrega as matrículas do arquivo CSV no escopo global
listaDeFuncionarios = lerDadosDoCSV('matriculas.csv');
console.log(`Carregadas ${listaDeFuncionarios.length} matrículas para a memória.`);

// ----------------------------------------------------
// Rotas da Aplicação
// ----------------------------------------------------

// Rota para a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de login do painel de administração
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota para autenticação
app.post('/admin', (req, res) => {
    const { usuario, senha } = req.body;
    const usuarioCorreto = 'admin'; 
    const senhaCorreta = '123456';

    if (usuario === usuarioCorreto && senha === senhaCorreta) {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.status(401).send('Credenciais inválidas');
    }
});

// Rota para verificação de acesso (CORRIGIDA)
app.post('/verificar-acesso', async (req, res) => {
    const { matricula } = req.body;
    let status = 'negado';
    let mensagem = 'Matrícula não cadastrada.';
    let nome = 'Não Encontrado';

    const funcionario = listaDeFuncionarios.find(f => f.matricula === matricula);

    if (funcionario) {
        status = 'aprovado';
        mensagem = 'Acesso Aprovado!';
        nome = funcionario.nome;
    } else {
        status = 'negado';
        mensagem = 'Acesso Negado!';
        nome = 'Não Encontrado';
    }

    try {
        // Cria uma nova instância do modelo Acesso
        const novoAcesso = new Acesso({
            matricula,
            nome,
            status,
            data_acesso: new Date()
        });
        // Salva o novo registro no banco de dados
        await novoAcesso.save();

        res.json({ status, mensagem, nome });
    } catch (erro) {
        console.error('Erro ao registrar o acesso no banco de dados:', erro);
        res.status(500).send('Erro interno do servidor ao registrar o acesso.');
    }
});

// Rota para gerar o relatório diário (CORRIGIDA)
app.get('/relatorio-diario', async (req, res) => {
    try {
        const inicioDoDia = new Date();
        inicioDoDia.setHours(0, 0, 0, 0);
        
        const fimDoDia = new Date();
        fimDoDia.setHours(23, 59, 59, 999);

        const acessos = await Acesso.find({
            data_acesso: {
                $gte: inicioDoDia,
                $lt: fimDoDia
            }
        }).sort({ data_acesso: 1 });

        if (acessos.length === 0) {
            return res.status(204).send();
        }
        res.json(acessos);
    } catch (erro) {
        console.error('Erro ao buscar o relatório do banco de dados:', erro);
        res.status(500).send('Erro interno do servidor ao gerar o relatório.');
    }
});

// Rota para baixar o relatório completo (em CSV)
app.get('/baixar-relatorio', async (req, res) => {
    try {
        const acessos = await Acesso.find({}).sort({ data_acesso: 1 });

        if (acessos.length === 0) {
            return res.status(404).send("Nenhum acesso registrado para baixar.");
        }

        const header = "Data/Hora;Matrícula;Nome;Status\n";
        const csvContent = acessos.map(acesso => {
            const dataHora = acesso.data_acesso.toLocaleString('pt-BR');
            return `${dataHora};${acesso.matricula};${acesso.nome};${acesso.status}`;
        }).join('\n');

        const fullCsv = header + csvContent;
        const nomeArquivo = 'relatorio_completo.csv';

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=\"${nomeArquivo}\"`);
        res.send(fullCsv);

    } catch (erro) {
        console.error('Erro ao gerar o CSV para download:', erro);
        res.status(500).send('Erro interno do servidor ao baixar o relatório.');
    }
});


// Rota para zerar o relatório (limpa a coleção no MongoDB)
app.get('/admin2/zerar', async (req, res) => {
    const { senha } = req.query;

    if (senha !== SENHA_ADMIN_ZERAR) {
        return res.status(401).send("Acesso negado. Senha incorreta.");
    }

    try {
        await Acesso.deleteMany({});
        res.status(200).send("Relatório zerado com sucesso.");
    } catch (erro) {
        console.error('Erro ao zerar o relatório:', erro);
        res.status(500).send('Erro interno do servidor ao zerar o relatório.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});