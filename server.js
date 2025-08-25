// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron'); // Importa a biblioteca node-cron

const app = express();
const PORT = process.env.PORT || 3000;

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

// Serve arquivos estáticos da pasta 'public'
app.use(express.static('public'));

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
            const [matricula, nome] = linha.split(',');
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
        
        // Verifica se existe algum registro com a matrícula e a data de hoje
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
// Agenda para executar a cada dia à 00:00 (meia-noite)
// O fuso horário do Render é UTC
cron.schedule('0 0 * * *', () => {
    console.log('Executando tarefa agendada: salvando e zerando relatório.');
    
    // 1. Salva o relatório
    const relatorio = gerarRelatorio();
    const nomeDoArquivo = `relatorio-diario-${new Date().toISOString().split('T')[0]}.txt`;
    const caminhoDoArquivo = path.join(__dirname, pastaRelatorios, nomeDoArquivo);

    if (!fs.existsSync(path.join(__dirname, pastaRelatorios))) {
        fs.mkdirSync(path.join(__dirname, pastaRelatorios));
    }
    fs.writeFileSync(caminhoDoArquivo, relatorio, 'utf8');
    console.log(`Relatório salvo em: ${caminhoDoArquivo}`);

    // 2. Zera o arquivo de log
    fs.writeFileSync(arquivoDeLog, '', 'utf8');
    console.log('Arquivo de log zerado.');

}, {
    timezone: "America/Sao_Paulo" // Defina o fuso horário para Brasil
});

// ----------------------------------------------------
// Rotas da API
// ----------------------------------------------------

// Rota POST para verificar a matrícula
app.post('/verificar-acesso', (req, res) => {
    const { matricula } = req.body;
    const listaDeFuncionarios = lerDadosDoCSV('matriculas.csv');
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
    res.status(200).send(relatorio); // Envia o relatório como texto
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


// Rota GET para zerar o relatório manualmente (sem botão na tela)
app.get('/api/zerar-relatorio', (req, res) => {
    try {
        fs.writeFileSync(arquivoDeLog, '', 'utf8');
        res.status(200).json({ mensagem: 'Relatório diário zerado com sucesso!' });
        console.log('Relatório diário zerado com sucesso.');
    } catch (erro) {
        res.status(500).json({ erro: `Erro ao zerar o relatório: ${erro.message}` });
        console.error(`Erro ao zerar o relatório: ${erro.message}`);
    }
});


// Inicia o servidor e o faz "escutar" por requisições na porta especificada
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});