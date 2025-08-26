// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Permite que o servidor processe dados JSON no corpo da requisição
app.use(express.json());

// Serve arquivos estáticos da pasta 'public'
app.use(express.static('public'));

// Define o caminho do arquivo de log dentro do volume persistente.
// O 'logs' deve ser o mesmo nome da pasta que você definiu em 'fly.toml'
const diretorioDeLog = path.join(__dirname, 'logs');
const arquivoDeLog = path.join(diretorioDeLog, 'acessos.log');

// Certifica-se de que o diretório de log existe
if (!fs.existsSync(diretorioDeLog)) {
    fs.mkdirSync(diretorioDeLog);
}

// Senha para a rota de administração de zerar relatório
const SENHA_ADMIN_ZERAR = process.env.SENHA_ADMIN_ZERAR || 'suasenha123';

// Rota para a página do funcionário (página inicial)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para a página de administração
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

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

// ----------------------------------------------------
// Lógica de Log e Relatório
// ----------------------------------------------------

// Função para registrar um acesso no arquivo de log
function registrarAcesso(acesso) {
    fs.appendFileSync(arquivoDeLog, acesso + '\n');
}

// Função para ler os acessos do arquivo de log
function lerAcessos() {
    try {
        return fs.readFileSync(arquivoDeLog, 'utf8').trim().split('\n');
    } catch (erro) {
        return [];
    }
}

// Rota POST para verificar a matrícula
app.post('/verificar-acesso', (req, res) => {
    const { matricula } = req.body;
    const listaDeFuncionarios = lerDadosDoCSV('matriculas.csv');
    const funcionario = listaDeFuncionarios.find(f => f.matricula === matricula);

    const acessosHoje = lerAcessos();
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    if (!funcionario) {
        registrarAcesso(`${matricula};Desconhecido;negado;${new Date().toLocaleString()}`);
        return res.status(401).json({ mensagem: 'Acesso negado. Matrícula não encontrada.' });
    }

    const jaAcessou = acessosHoje.some(log => {
        const [logMatricula, logNome, logStatus, logDataHora] = log.split(';');
        const dataLog = new Date(logDataHora).toLocaleDateString('pt-BR');
        return logMatricula === matricula && logStatus === 'concedido' && dataLog === dataHoje;
    });

    if (jaAcessou) {
        registrarAcesso(`${matricula};${funcionario.nome};negado (acesso duplicado);${new Date().toLocaleString()}`);
        return res.status(403).json({ mensagem: `${funcionario.nome}, você já verificou seu acesso hoje.` });
    }

    registrarAcesso(`${matricula};${funcionario.nome};concedido;${new Date().toLocaleString()}`);
    res.status(200).json({ mensagem: 'Acesso concedido. Bem-vindo, ', nome: funcionario.nome, status: 'aprovado' });
});

// Rota GET para gerar o relatório diário
app.get('/relatorio-diario', (req, res) => {
    const acessos = lerAcessos();
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    
    const registrosDeHoje = acessos.filter(log => {
        const [, , , dataHora] = log.split(';');
        return new Date(dataHora).toLocaleDateString('pt-BR') === dataHoje;
    });

    let acessosConcedidos = 0;
    let matriculasNegadas = new Set();
    
    registrosDeHoje.forEach(registro => {
        const [matricula, , status] = registro.split(';');
        if (status === 'concedido') {
            acessosConcedidos++;
        } else if (status.includes('negado')) {
            matriculasNegadas.add(matricula);
        }
    });

    const relatorio = `
Relatório Diário - ${dataHoje}
----------------------------------
Total de Solicitações: ${registrosDeHoje.length}
Acessos Concedidos: ${acessosConcedidos}
Matrículas Negadas: ${[...matriculasNegadas].join(', ')}
----------------------------------
`;
    res.status(200).send(relatorio);
});

// Rota GET para zerar o relatório manualmente
app.get('/api/zerar-relatorio', (req, res) => {
    const { senha } = req.query;
    
    if (senha !== SENHA_ADMIN_ZERAR) {
        return res.status(401).send("Acesso negado. Senha incorreta.");
    }
    
    // Z