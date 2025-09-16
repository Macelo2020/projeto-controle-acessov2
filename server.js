// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cron = require('node-cron'); // Importa a biblioteca
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Senha para a rota de administração
const SENHA_ADMIN_ZERAR_RELATORIO = process.env.SENHA_ADMIN_ZERAR_RELATORIO;

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

if (!dbURI) {
    console.error('Erro: A variável de ambiente MONGODB_URI não está definida.');
    process.exit(1);
}

mongoose.connect(dbURI)
    .then(() => {
        console.log('Conexão com o MongoDB estabelecida!');
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });

        // ===========================================
        // Tarefa Agendada: Zerar o Relatório Diário
        // ===========================================
        // A tarefa será executada todos os dias à meia-noite.
        // O formato é: minuto hora dia-do-mes mes dia-da-semana
        // '0 0 * * *' -> 0 minutos, 0 horas, qualquer dia, qualquer mês, qualquer dia da semana
        cron.schedule('0 0 * * *', async () => {
            try {
                const resultado = await Acesso.deleteMany({});
                console.log(`Tarefa agendada: Relatório diário zerado com sucesso. ${resultado.deletedCount} registros removidos.`);
            } catch (erro) {
                console.error('Erro na tarefa agendada ao zerar o relatório:', erro);
            }
        });
        console.log('Tarefa de limpeza diária agendada para meia-noite.');

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
// Funções de Lógica (Refatoradas)
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
    const inicioDoDia = new Date(`${dataDeHoje}T00:00:00.000Z`);
    const fimDoDia = new Date(`${dataDeHoje}T23:59:59.999Z`);

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

// Nova função para buscar os dados de acesso (retorna JSON)
async function buscarRegistrosDoDia(dataParaRelatorio) {
    try {
        const data = dataParaRelatorio ? new Date(dataParaRelatorio) : new Date();
        const dataString = data.toISOString().split('T')[0];
        const inicioDoDia = new Date(`${dataString}T00:00:00.000Z`);
        const fimDoDia = new Date(`${dataString}T23:59:59.999Z`);
        
        return await Acesso.find({
            dataHora: { $gte: inicioDoDia, $lte: fimDoDia }
        }).sort({ dataHora: 1 }); // Ordena do mais antigo para o mais novo

    } catch (erro) {
        console.error('Erro ao buscar registros no MongoDB:', erro);
        return [];
    }
}

// Função para gerar o relatório em formato de string (do MongoDB)
async function gerarRelatorioComoTexto(registrosDoDia) {
    let acessosConcedidos = 0;
    let matriculasNegadas = [];

    registrosDoDia.forEach(registro => {
        if (registro.status === 'concedido') {
            acessosConcedidos++;
        } else if (registro.status.includes('negado')) {
            matriculasNegadas.push(registro.matricula);
        }
    });

    const dataString = new Date().toISOString().split('T')[0];
    const relatorio = `
Relatório Diário - ${dataString}
----------------------------------
Total de Solicitações: ${registrosDoDia.length}
Acessos Concedidos: ${acessosConcedidos}
Matrículas Negadas: ${matriculasNegadas.join(', ')}
----------------------------------
`;
    return relatorio;
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
app.post('/api/verificar-acesso', async (req, res) => {
    const { matricula } = req.body;
    
    // Validação básica da entrada para prevenção
    if (!matricula || typeof matricula !== 'string' || matricula.trim() === '') {
        return res.status(400).json({ mensagem: 'Matrícula inválida.' });
    }
    
    const funcionario = listaDeFuncionarios.find(f => f.matricula === matricula.trim());

    if (!funcionario) {
        await registrarAcesso(matricula, 'Desconhecido', 'negado');
        return res.status(401).json({ mensagem: 'Acesso negado. Matrícula não encontrada.' });
    }

    if (await jaAcessouHoje(matricula)) {
        await registrarAcesso(matricula, funcionario.nome, 'negado (acesso duplicado)');
        return res.status(403).json({ mensagem: `${funcionario.nome}, você já verificou seu acesso hoje.` });
    }

    await registrarAcesso(matricula, funcionario.nome, 'concedido');
    res.status(200).json({ mensagem: 'Acesso concedido. Bom apetite!', nome: funcionario.nome, status: 'aprovado' });
});

// Rota GET para buscar os registros de acesso (agora retorna JSON)
app.get('/api/admin/relatorio', async (req, res) => {
    const dataParaRelatorio = req.query.data;
    const registros = await buscarRegistrosDoDia(dataParaRelatorio);
    res.status(200).json(registros);
});

// Rota GET para baixar o relatório diário (mantida, mas mais robusta)
app.get('/api/admin/baixar-relatorio', async (req, res) => {
    const dataParaRelatorio = req.query.data;
    const dataString = dataParaRelatorio || new Date().toISOString().split('T')[0];
    const nomeDoArquivo = `relatorio-diario-${dataString}.txt`;
    const caminhoDoArquivo = path.join(__dirname, 'relatorios', nomeDoArquivo);
    const registros = await buscarRegistrosDoDia(dataParaRelatorio);
    const relatorioTexto = await gerarRelatorioComoTexto(registros);

    const pastaRelatorios = path.join(__dirname, 'relatorios');

    if (!fs.existsSync(pastaRelatorios)) {
        fs.mkdirSync(pastaRelatorios);
    }
    fs.writeFileSync(caminhoDoArquivo, relatorioTexto, 'utf8');

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

// Rota POST de acesso exclusivo para zerar o relatório (limpa a coleção no MongoDB)
app.post('/api/admin/zerar', async (req, res) => {
    const { senha } = req.body;

    if (senha !== SENHA_ADMIN_ZERAR_RELATORIO) {
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
admin.html (Completo)
Este arquivo agora tem o campo de pesquisa (<input type="text" id="searchInput">) para permitir que o administrador filtre a tabela de acessos.

HTML

<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel de Administração</title>
    <link rel="stylesheet" href="styles.css">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <style>
        /* Estilos adicionais para aprimorar a tabela */
        .admin-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
        }
        #searchInput {
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 5px;
            flex-grow: 1;
        }
        .acesso-concedido {
            background-color: #d4edda; /* Verde claro */
        }
        .acesso-negado {
            background-color: #f8d7da; /* Vermelho claro */
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="logo-area">
            <img src="images/hospital-sao-vicente-logo.png" alt="Logo Hospital São Vicente de Paulo" class="hospital-logo">
            <h1>Painel de Administração</h1>
            <h2>Refeitório - Hospital São Vicente de Paulo</h2>
        </header>

        <main class="admin-main">
            <p>Gerenciamento de Acessos ao Refeitório.</p>
            
            <div class="admin-actions">
                <button id="btnGerarRelatorio">
                    <span class="material-icons">visibility</span> Ver Relatório Diário
                </button>
                <button id="btnBaixarRelatorio">
                    <span class="material-icons">download</span> Baixar Relatório Diário
                </button>
                <button id="btnZerarRelatorio">
                    <span class="material-icons">delete_forever</span> Zerar Relatório Diário
                </button>
                <input type="text" id="searchInput" placeholder="Pesquisar por Matrícula, Nome ou Status...">
            </div>

            <div id="relatorioTexto">
                <div id="adminMessage" class="message-area" aria-live="polite"></div>
                <div class="table-container">
                    <table id="relatorioTable">
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Matrícula</th>
                                <th>Nome</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>

        <footer class="developer-logo-area">
            <img src="images/blue-frog-logo.png" alt="Logo Blue Frog Creative Solutions" class="developer-logo">
            <p class="copyright-text">© 2025 - Hospital São Vicente de Paulo - Todos os direitos reservados.</p>
            <p class="developer-text">Criação e desenvolvimento: Blue Frog Creative Solutions</p>
        </footer>
    </div>

    <script src="admin.js"></script>
</body>
</html>