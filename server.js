// Importa os módulos necessários
const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const mongoose = require('mongoose'); // <-- Adicionado para a conexão com o MongoDB

const app = express();
const PORT = process.env.PORT || 3000;

// Senha para a rota de administração
const SENHA_ADMIN_ZERAR = 'adm@123'; // *** Mude esta senha para algo seguro ***

// ----------------------------------------------------
// Conexão com o MongoDB
// ----------------------------------------------------
const dbURI = process.env.MONGODB_URI;

mongoose.connect(dbURI)
  .then(() => {
    console.log('Conexão com o MongoDB estabelecida!');
    
    // ----------------------------------------------------
    // Lógica de Leitura de Matrículas e Nomes
    // ----------------------------------------------------
    // Movemos a lógica de leitura do CSV para dentro da conexão do MongoDB
    // para garantir que o servidor só inicie após a conexão ser bem-sucedida.
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
    // Inicia o Servidor (apenas se a conexão com o MongoDB for bem-sucedida)
    // ----------------------------------------------------
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });

  })
  .catch((err) => {
    console.error('Erro de conexão com o MongoDB:', err);
    // Adicione a lógica para sair da aplicação caso a conexão falhe
    process.exit(1);
  });


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

// ----------------------------------------------------
// Lógica de Log e Relatório (Usando arquivos, que não é o ideal para o Render)
// ----------------------------------------------------
// NOTA: Esta lógica funciona, mas para um projeto robusto, o ideal é
// substituir o uso de arquivos (.log, .csv) por coleções no MongoDB.
// Manter esta lógica para o momento, já que o foco é a conexão.
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