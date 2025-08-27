// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const mongoose = require('mongoose');
const cors = require('cors');

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

// Carrega as matrículas do arquivo CSV
listaDeFuncionarios = lerDadosDoCSV('matriculas.csv');
console.log(`Carregadas ${listaDeFuncionarios.length} matrículas para a memória.`);


// ----------------------------------------------------
// Conexão com o MongoDB
// ----------------------------------------------------
const dbURI = process.env.MONGODB_URI;

mongoose.connect(dbURI)
  .then(() => {
    console.log('Conexão com o MongoDB estabelecida!');
  })
  .catch((err) => {
    console.error('Erro de conexão com o MongoDB:', err);
    process.exit(1);
  });

// ----------------------------------------------------
// Middleware
// ----------------------------------------------------
app.use(express.static('public'));
app.use(express.json());
app.use(cors());


// ----------------------------------------------------
// Rotas da API
// ----------------------------------------------------

// Rota para a página do funcionário (página inicial)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para a página de administração
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ----------------------------------------------------
// Lógica de Log e Relatório (Usando arquivos, que não é o ideal para o Render)
// ----------------------------------------------------
const arquivoDeLog = 'acessos.log';
const pastaRelatorios = 'relatorios';

function registrarAcesso(matricula, nome, status) {
    const dataHora = new Date().toISOString();
    const registro = `${dataHora} - Matrícula: ${matricula} - Nome: ${nome} - Status: ${status}\n`;
    fs.appendFileSync(arquivoDeLog, registro, 'utf8');
}

// Função para verificar se a matrícula já foi usada hoje
function jaAcessouHoje(matricula) {
    try {
        if (!fs.existsSync(arquivoDeLog)) {
            return false;
        }
        const conteudoDoLog = fs.readFileSync(arquivoDeLog, 'utf8');
        const registros = conteudoDoLog.trim().split('\n');
        const dataDeHoje = new Date().toISOString().split('T')[0];
        
        return registros.some(registro => 
            registro.includes(matricula) && registro.startsWith(dataDeHoje) && registro.includes('Status: concedido')
        );
    } catch (erro) {
        return false;
    }
}

// Função para gerar o relatório em formato de string
function gerarRelatorio() {
    try {
        let conteudoDoLog = '';
        if (fs.existsSync(arquivoDeLog)) {
            conteudoDoLog = fs.readFileSync(arquivoDeLog, 'utf8');
        }
        
        const registros = conteudoDoLog.trim().split('\n');
        const dataDeHoje = new Date().toISOString().split('T')[0];
        const registrosDeHoje = registros.filter(reg => reg.startsWith(dataDeHoje));
        
        let acessosConcedidos = 0;
        let matriculasNegadas = [];
        
        registrosDeHoje.forEach(registro => {
            if (registro.includes('Status: concedido')) {
                acessosConcedidos++;
            } else if (registro.includes('Status: negado')) {
                const match = registro.match(/Matrícula: (\d+)/);
                if (match && match[1]) {
                    const matriculaNegada = match[1];
                    matriculasNegadas.push(matriculaNegada);
                }
            }
        });

        const relatorio = `
Relatório Diário - ${dataDeHoje}
----------------------------------
Total de Solicitações: ${registrosDeHoje.length}
Acessos Concedidos: ${acessosConcedidos}
Matrículas Negadas: ${matriculasNegadas.join(', ')}
----------------------------------
`;

        return relatorio;

    } catch (erro) {
        return `Erro ao gerar o relatório: ${erro.message}`;
    }
}

// ----------------------------------------------------
// Agendamento para Salvar o Relatório e Zera-lo (Cron Job)
// ----------------------------------------------------
cron.schedule('0 0 * * *', () => {
    console.log('Executando tarefa agendada: salvando e zerando relatório.');
    
    const relatorio = gerarRelatorio();
    const nomeDoArquivo = `relatorio-diario-${new Date().toISOString().split('T')[0]}.txt`;
    const caminhoDoArquivo = path.join(__dirname, pastaRelatorios, nomeDoArquivo);

    if (!fs.existsSync(path.join(__dirname, pastaRelatorios))) {
        fs.mkdirSync(path.join(__dirname, pastaRelatorios));
    }
    fs.writeFileSync(caminhoDoArquivo, relatorio, 'utf8');
    console.log(`Relatório salvo em: ${caminhoDoArquivo}`);

    fs.writeFileSync(arquivoDeLog, '', 'utf8');
    console.log('Arquivo de log zerado.');

}, {
    timezone: "America/Sao_Paulo"
});

// ----------------------------------------------------
// Rotas da API
// ----------------------------------------------------

// Rota POST para verificar a matrícula
app.post('/verificar-acesso', (req, res) => {
    const { matricula } = req.body;
    const funcionario = listaDeFuncionarios.find(f => f.matricula === matricula);

    if (!funcionario) {
        registrarAcesso(matricula, 'Desconhecido', 'negado');
        res.status(401).json({ mensagem: 'Acesso negado. Matrícula não encontrada.' });
        return;
    }

    if (jaAcessouHoje(matricula)) {
        registrarAcesso(matricula, funcionario.nome, 'negado (acesso duplicado)');
        res.status(403).json({ mensagem: `${funcionario.nome}, você já verificou seu acesso hoje.` });
        return;
    }

    registrarAcesso(matricula, funcionario.nome, 'concedido');
    res.status(200).json({ mensagem: 'Acesso concedido. Bem-vindo, ', nome: funcionario.nome, status: 'aprovado' });
});

// Rota GET para gerar o relatório diário
app.get('/relatorio-diario', (req, res) => {
    const relatorio = gerarRelatorio();
    res.status(200).send(relatorio);
});

// Rota GET para baixar o relatório diário mais recente
app.get('/baixar-relatorio', (req, res) => {
    const dataDeHoje = new Date().toISOString().split('T')[0];
    const nomeDoArquivo = `relatorio-diario-${dataDeHoje}.txt`;
    const caminhoDoArquivo = path.join(__dirname, pastaRelatorios, nomeDoArquivo);

    if (fs.existsSync(caminhoDoArquivo)) {
        res.download(caminhoDoArquivo, nomeDoArquivo, (erro) => {
            if (erro) {
                console.error("Erro ao baixar o arquivo:", erro);
                res.status(500).send("Erro ao tentar baixar o relatório.");
            }
        });
    } else {
        res.status(404).send("Relatório não encontrado. Certifique-se de que o relatório de hoje foi salvo.");
    }
});

// Rota de acesso exclusivo para zerar o relatório
app.get('/admin2/zerar', (req, res) => {
    const { senha } = req.query;
    
    if (senha !== SENHA_ADMIN_ZERAR) {
        return res.status(401).send("Acesso negado. Senha incorreta.");
    }

    try {
        fs.writeFileSync(arquivoDeLog, '', 'utf8');
        res.status(200).send('Relatório diário zerado com sucesso!');
        console.log('Relatório diário zerado por acesso manual.');
    } catch (erro) {
        res.status(500).send(`Erro ao zerar o relatório: ${erro.message}`);
        console.error(`Erro ao zerar o relatório: ${erro.message}`);
    }
});

// ----------------------------------------------------
// Inicia o Servidor (apenas se a conexão com o MongoDB for bem-sucedida)
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});