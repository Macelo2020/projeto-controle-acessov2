// Lógica para Gerar e Exibir o Relatório
document.getElementById('btnGerarRelatorio').addEventListener('click', async () => {
    const relatorioElement = document.getElementById('relatorio');
    
    try {
        const resposta = await fetch('/relatorio-diario');
        const dados = await resposta.json();
        
        if (resposta.ok) {
            // Exibe o relatório na tela
            relatorioElement.innerHTML = `
                <p>Total de solicitações: ${dados.totalSolicitacoes}</p>
                <p>Acessos concedidos: ${dados.acessosConcedidos}</p>
                <p>Matrículas com acesso negado: ${dados.matriculasNegadas.join(', ') || 'Nenhuma'}</p>
            `;
            
            // Salva o relatório em um arquivo de texto no servidor
            const relatorioTexto = `Relatório Diário:\nTotal de solicitações: ${dados.totalSolicitacoes}\nAcessos concedidos: ${dados.acessosConcedidos}\nMatrículas com acesso negado: ${dados.matriculasNegadas.join(', ') || 'Nenhuma'}`;
            await fetch('/salvar-relatorio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ relatorio: relatorioTexto })
            });
            console.log('Relatório salvo no servidor.');

        } else {
            relatorioElement.innerHTML = `<p style="color: red;">Erro ao gerar relatório: ${dados.erro}</p>`;
        }
    } catch (erro) {
        relatorioElement.innerHTML = `<p style="color: red;">Erro ao se comunicar com o servidor.</p>`;
        console.error('Erro:', erro);
    }
});

// Lógica para Zerar o Relatório
document.getElementById('btnZerarRelatorio').addEventListener('click', async () => {
    const mensagemElement = document.getElementById('mensagemZerarRelatorio');
    
    const confirmacao = confirm('Tem certeza que deseja zerar o relatório diário? Esta ação é irreversível.');
    if (!confirmacao) {
        return;
    }

    try {
        const resposta = await fetch('/zerar-relatorio');
        const dados = await resposta.json();

        if (resposta.ok) {
            mensagemElement.textContent = dados.mensagem;
            mensagemElement.style.color = 'green';
            document.getElementById('relatorio').innerHTML = ''; // Limpa o relatório da tela
        } else {
            mensagemElement.textContent = `Erro: ${dados.erro}`;
            mensagemElement.style.color = 'red';
        }
    } catch (erro) {
        mensagemElement.textContent = 'Erro ao se comunicar com o servidor.';
        console.error('Erro:', erro);
    }
});