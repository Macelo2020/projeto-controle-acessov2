// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');

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
// Lógica de Leitura de Matrículas
// ----------------------------------------------------
function lerMatriculasDoCSV(nomeDoArquivo) {
    const caminhoDoArquivo = path.join(__dirname, nomeDoArquivo);
    try {
        const conteudo = fs.readFileSync(caminhoDoArquivo, 'utf8');
        const linhas = conteudo.trim().split('\n');
        linhas.shift();
        return linhas.map(linha => linha.trim());
    } catch (erro) {
        console.error(`Erro ao ler o arquivo CSV: ${erro.message}`);
        return [];
    }
}

// ----------------------------------------------------
// Lógica de Log e Relatório
// ----------------------------------------------------
const arquivoDeLog = 'acessos.log';

function registrarAcesso(matricula, status) {
    const dataHora = new Date().toISOString();
    const registro = `${dataHora} - Matrícula: ${matricula} - Status: ${status}\n`;
    fs.appendFileSync(arquivoDeLog, registro, 'utf8');
}

// ----------------------------------------------------
// Rotas da API (o que o navegador vai chamar)
// ----------------------------------------------------

// Rota POST para verificar a matrícula
app.post('/verificar-acesso', (req, res) => {
    const { matricula } = req.body;
    const listaDeMatriculasPermitidas = lerMatriculasDoCSV('matriculas.csv');
    const acessoConcedido = listaDeMatriculasPermitidas.includes(matricula);
    const status = acessoConcedido ? 'concedido' : 'negado';

    registrarAcesso(matricula, status);

    if (acessoConcedido) {
        res.status(200).json({ mensagem: 'Acesso concedido', status: 'aprovado' });
    } else {
        res.status(401).json({ mensagem: 'Acesso negado', status: 'negado' });
    }
});

// Rota GET para gerar o relatório diário
app.get('/relatorio-diario', (req, res) => {
    try {
        const conteudoDoLog = fs.readFileSync(arquivoDeLog, 'utf8');
        const registros = conteudoDoLog.trim().split('\n');
        const dataDeHoje = new Date().toISOString().split('T')[0];
        const registrosDeHoje = registros.filter(reg => reg.startsWith(dataDeHoje));
        
        let acessosConcedidos = 0;
        let matriculasNegadas = [];
        
        registrosDeHoje.forEach(registro => {
            if (registro.includes('Status: concedido')) {
                acessosConcedidos++;
            } else if (registro.includes('Status: negado')) {
                const matriculaNegada = registro.match(/Matrícula: (\d+)/)[1];
                matriculasNegadas.push(matriculaNegada);
            }
        });

        const relatorio = {
            totalSolicitacoes: registrosDeHoje.length,
            acessosConcedidos,
            matriculasNegadas
        };

        res.status(200).json(relatorio);

    } catch (erro) {
        res.status(500).json({ erro: `Erro ao gerar o relatório: ${erro.message}` });
    }
});

// Rota GET para zerar o relatório diário
app.get('/zerar-relatorio', (req, res) => {
    try {
        fs.writeFileSync(arquivoDeLog, '', 'utf8');
        res.status(200).json({ mensagem: 'Relatório diário zerado com sucesso!' });
        console.log('Relatório diário zerado com sucesso.');
    } catch (erro) {
        res.status(500).json({ erro: `Erro ao zerar o relatório: ${erro.message}` });
        console.error(`Erro ao zerar o relatório: ${erro.message}`);
    }
});

// Rota POST para salvar o relatório em um arquivo
app.post('/salvar-relatorio', (req, res) => {
    const { relatorio } = req.body;
    const nomeDoArquivo = `relatorio-diario-${new Date().toISOString().split('T')[0]}.txt`;
    const caminhoDoArquivo = path.join(__dirname, 'relatorios', nomeDoArquivo);

    // Garante que a pasta 'relatorios' existe
    if (!fs.existsSync(path.join(__dirname, 'relatorios'))) {
        fs.mkdirSync(path.join(__dirname, 'relatorios'));
    }

    fs.writeFileSync(caminhoDoArquivo, relatorio, 'utf8');
    res.status(200).json({ mensagem: 'Relatório salvo com sucesso!' });
});

// Inicia o servidor e o faz "escutar" por requisições na porta especificada
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});