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

// CARREGA OS DADOS UMA ÚNICA VEZ NA INICIALIZAÇÃO DO SERVIDOR
const listaDeFuncionarios = lerDadosDoCSV('matriculas.csv');
console.log(`Carregadas ${listaDeFuncionarios.length} matrículas para a memória.`);

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
        // --- CORREÇÃO: Verifique se o arquivo existe antes de ler ---
        if (!fs.existsSync(arquivoDeLog)) {
            return []; // Retorna um array vazio se o arquivo não existir
        }
        return fs.readFileSync(arquivoDeLog, 'utf8').trim().split('\n');
    } catch (erro) {
        // Lida com outros possíveis erros de leitura
        return [];
    }
}

// Rota para a página do funcionário (página inicial)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});