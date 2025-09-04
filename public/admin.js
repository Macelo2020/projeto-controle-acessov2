document.getElementById('btnGerarRelatorio').addEventListener('click', async () => {
    const mensagemElement = document.getElementById('adminMessage');
    const tabelaCorpo = document.getElementById('relatorioTableBody');

    mensagemElement.textContent = 'Gerando relatório...';
    tabelaCorpo.innerHTML = ''; // Limpa a tabela

    try {
        const resposta = await fetch('/relatorio-diario');
        
        if (resposta.status === 204) {
            mensagemElement.textContent = 'Relatório Vazio. Não há acessos registrados para hoje.';
            return;
        }

        const acessos = await resposta.json(); // LÊ OS DADOS COMO JSON
        
        if (acessos.length === 0) {
            mensagemElement.textContent = 'Relatório Vazio. Não há acessos registrados para hoje.';
        } else {
            acessos.forEach(acesso => {
                const linha = document.createElement('tr');
                const dataHora = new Date(acesso.data_acesso).toLocaleString('pt-BR');
                
                linha.innerHTML = `
                    <td>${dataHora}</td>
                    <td>${acesso.matricula}</td>
                    <td>${acesso.nome}</td>
                    <td>${acesso.status}</td>
                `;
                tabelaCorpo.appendChild(linha);
            });
            mensagemElement.textContent = 'Relatório gerado com sucesso.';
        }
    } catch (erro) {
        console.error('Erro ao gerar o relatório:', erro);
        mensagemElement.textContent = 'Erro ao se comunicar com o servidor ou gerar o relatório.';
    }
});

// Outras funcionalidades do painel de administração
document.getElementById('btnBaixarRelatorio').addEventListener('click', () => {
    window.location.href = '/baixar-relatorio';
});

document.getElementById('btnZerarRelatorio').addEventListener('click', async () => {
    const senha = prompt("Por favor, digite a senha para zerar o relatório:");
    if (!senha) return;
    
    try {
        const resposta = await fetch(`/admin2/zerar?senha=${senha}`);
        const mensagem = await resposta.text();
        alert(mensagem);
    } catch (erro) {
        alert("Erro ao zerar o relatório.");
    }
});