// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Senha para a rota de administração
const SENHA_ADMIN_ZERAR = 'adm@123';

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
// Conexão com o MongoDB
// ----------------------------------------------------
const dbURI = process.env.MONGODB_URI;

mongoose.connect(dbURI)
    .then(() => {
        console.log('Conexão com o MongoDB estabelecida!');
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });

    })
    .catch((err) => {
        console.error('Erro de conexão com o MongoDB:', err);
        process.exit(1);
    });

// ----------------------------------------------------
// Schema e Modelo do MongoDB para Acessos
// ----------------------------------------------------
const acessoSchema = new mongoose.Schema({
    matricula: String,
    nome: String,
    status: String,
    dataHora: { type: Date, default: Date.now }
});

const Acesso = mongoose.model('Acesso', acessoSchema);

// ----------------------------------------------------
// Funções de Lógica
// ----------------------------------------------------

// Função para registrar acesso no MongoDB
async function registrarAcesso(matricula, nome, status) {
    const novoAcesso = new Acesso({
        matricula,
        nome,
        status,
        dataHora: new Date()
    });
    try {
        await novoAcesso.save();
        console.log('Acesso registrado no MongoDB com sucesso!');
    } catch (erro) {
        console.error('Erro ao registrar acesso no MongoDB:', erro);
    }
}

// Função para verificar se a matrícula já foi usada hoje (no MongoDB)
async function jaAcessouHoje(matricula) {
    const dataDeHoje = new Date().toISOString().split('T')[0];
    const inicioDoDia = new Date(`${dataDeHoje}T00:00:00Z`);
    const fimDoDia = new Date(`${dataDeHoje}T23:59:59Z`);

    try {
        const acessoExistente = await Acesso.findOne({
            matricula: matricula,
            status: 'concedido',
            dataHora: { $gte: inicioDoDia, $lte: fimDoDia }
        });
        return !!acessoExistente;
    } catch (erro) {
        console.error('Erro ao verificar acesso no MongoDB:', erro);
        return false;
    }
}

// Função para gerar o relatório em formato de string (do MongoDB), agora com um parâmetro de data
async function gerarRelatorio(dataParaRelatorio) {
    try {
        const data = dataParaRelatorio ? new Date(dataParaRelatorio) : new Date();
        const dataString = data.toISOString().split('T')[0];
        const inicioDoDia = new Date(`${dataString}T00:00:00Z`);
        const fimDoDia = new Date(`${dataString}T23:59:59Z`);

        const registrosDoDia = await Acesso.find({
            dataHora: { $gte: inicioDoDia, $lte: fimDoDia }
        });

        let acessosConcedidos = 0;
        let matriculasNegadas = [];

        registrosDoDia.forEach(registro => {
            if (registro.status === 'concedido') {
                acessosConcedidos++;
            } else if (registro.status === 'negado' || registro.status.includes('duplicado')) {
                matriculasNegadas.push(registro.matricula);
            }
        });

        const relatorio = `
Relatório Diário - ${dataString}
----------------------------------
Total de Solicitações: ${registrosDoDia.length}
Acessos Concedidos: ${acessosConcedidos}
Matrículas Negadas: ${matriculasNegadas.join(', ')}
----------------------------------
`;
        return relatorio;
    } catch (erro) {
        console.error('Erro ao gerar o relatório do MongoDB:', erro);
        return `Erro ao gerar o relatório: ${erro.message}`;
    }
}


// ----------------------------------------------------
// Rotas da API
// ----------------------------------------------------

// Serve arquivos estáticos da pasta 'public'
app.use(express.static('public'));

// Rota para a página do funcionário (página inicial)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para a página de administração
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Permite que o servidor processe dados JSON no corpo da requisição
app.use(express.json());

// Rota POST para verificar a matrícula
app.post('/verificar-acesso', async (req, res) => {
    const { matricula } = req.body;
    const funcionario = listaDeFuncionarios.find(f => f.matricula === matricula);

    if (!funcionario) {
        await registrarAcesso(matricula, 'Desconhecido', 'negado');
        res.status(401).json({ mensagem: 'Acesso negado. Matrícula não encontrada.' });
        return;
    }

    if (await jaAcessouHoje(matricula)) {
        await registrarAcesso(matricula, funcionario.nome, 'negado (acesso duplicado)');
        res.status(403).json({ mensagem: `${funcionario.nome}, você já verificou seu acesso hoje.` });
        return;
    }

    await registrarAcesso(matricula, funcionario.nome, 'concedido');
    res.status(200).json({ mensagem: 'Acesso concedido. Bem-vindo, ', nome: funcionario.nome, status: 'aprovado' });
});

// Rota GET para gerar o relatório diário
app.get('/relatorio-diario', async (req, res) => {
    try {
        const acessos = await Acesso.find({}).sort({ data_acesso: 1 });
        if (acessos.length === 0) {
            return res.status(204).send(); // 204 No Content para indicar que não há dados
        }
        res.json(acessos);
    } catch (erro) {
        console.error('Erro ao buscar o relatório do banco de dados:', erro);
        res.status(500).send('Erro interno do servidor ao gerar o relatório.');
    }
});

// Rota GET para baixar o relatório diário
app.get('/baixar-relatorio', async (req, res) => {
    const dataParaRelatorio = req.query.data;
    const dataString = dataParaRelatorio || new Date().toISOString().split('T')[0];
    const nomeDoArquivo = `relatorio-diario-${dataString}.txt`;
    const caminhoDoArquivo = path.join(__dirname, 'relatorios', nomeDoArquivo);

    const relatorio = await gerarRelatorio(dataParaRelatorio);
    const pastaRelatorios = path.join(__dirname, 'relatorios');

    if (!fs.existsSync(pastaRelatorios)) {
        fs.mkdirSync(pastaRelatorios);
    }
    fs.writeFileSync(caminhoDoArquivo, relatorio, 'utf8');

    if (fs.existsSync(caminhoDoArquivo)) {
        res.download(caminhoDoArquivo, nomeDoArquivo, (erro) => {
            if (erro) {
                console.error("Erro ao baixar o arquivo:", erro);
                res.status(500).send("Erro ao tentar baixar o relatório.");
            }
        });
    } else {
        res.status(404).send("Relatório não encontrado. Verifique os logs do servidor.");
    }
});

// Rota de acesso exclusivo para zerar o relatório (limpa a coleção no MongoDB)
app.get('/admin2/zerar', async (req, res) => {
    const { senha } = req.query;

    if (senha !== SENHA_ADMIN_ZERAR) {
        return res.status(401).send("Acesso negado. Senha incorreta.");
    }

    try {
        await Acesso.deleteMany({});
        res.status(200).send('Relatório diário zerado com sucesso!');
        console.log('Relatório diário zerado por acesso manual.');
    } catch (erro) {
        res.status(500).send(`Erro ao zerar o relatório: ${erro.message}`);
        console.error(`Erro ao zerar o relatório: ${erro.message}`);
    }
});