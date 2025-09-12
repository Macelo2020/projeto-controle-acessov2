# Projeto: Sistema de Controle de Acesso ao Refeitório Versão 2.0

## Descrição do Projeto

Este projeto é um sistema de controle de acesso para o refeitório do Hospital São Vicente de Paulo, desenvolvido em Node.js. Ele utiliza um banco de dados MongoDB para registrar os acessos dos funcionários e um painel de administração para visualização e gerenciamento diário.

O sistema verifica as matrículas de funcionários a partir de um arquivo CSV (`matriculas.csv`) e registra todos os acessos (aprovados ou negados) no banco de dados.

## Funcionalidades

- **Verificação de Matrícula**: Acesso aprovado ou negado com base em um arquivo de matrículas.
- **Registro de Acessos**: Gravação de cada tentativa de acesso (data, matrícula, nome e status) no MongoDB.
- **Painel de Administração**: Interface para visualizar o relatório diário de acessos.
- **Exportação de Relatório**: Possibilidade de baixar o relatório completo em formato CSV.
- **Zerar Relatório**: Funcionalidade segura para limpar os registros diários no banco de dados.

## Tecnologias Utilizadas

- **Backend**: Node.js com o framework Express.
- **Banco de Dados**: MongoDB (hospedado no MongoDB Atlas ou localmente).
- **ORM**: Mongoose.
- **Frontend**: HTML, CSS e JavaScript puro (sem frameworks).
- **Hospedagem**: Render.com para o backend e frontend.
- **Controle de Versão**: Git e GitHub.

## Como Usar o Projeto

### Pré-requisitos

Certifique-se de ter o Node.js e o npm instalados em sua máquina.

### Configuração

1.  **Clonar o Repositório**:
    ```bash
    git clone [https://github.com/Macelo2020/projeto-controle-acesso.git](https://github.com/Macelo2020/projeto-controle-acesso.git)
    ```
2.  **Entrar na Pasta do Projeto**:
    ```bash
    cd projeto-controle-acesso
    ```
3.  **Instalar as Dependências**:
    ```bash
    npm install
    ```
4.  **Configurar o Banco de Dados**:
    Crie um arquivo `.env` na raiz do projeto e adicione a string de conexão do seu banco de dados MongoDB:
    ```
    MONGODB_URI=sua_string_de_conexao_do_mongodb
    ```
5.  **Adicionar o Arquivo de Matrículas**:
    Adicione o arquivo `matriculas.csv` na pasta principal do projeto. O arquivo deve ter duas colunas: `Matrícula` e `Nome`, separadas por ponto e vírgula.

### Como Rodar o Servidor

Para iniciar o servidor localmente, execute o seguinte comando:

```bash
npm start

O servidor estará rodando em http://localhost:3000.

Acesso às Rotas
Página Principal: http://localhost:3000/

Use esta rota para a verificação de matrículas.

Painel de Administração: http://localhost:3000/admin

Usuário: admin

Senha: 123456

Contato
Desenvolvido por Marcelo
