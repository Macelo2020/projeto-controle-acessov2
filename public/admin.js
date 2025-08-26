document.getElementById('btnGerarRelatorio').addEventListener('click', async () => {
    const mensagemElement = document.getElementById('mensagemRelatorio');
    const relatorioElement = document.getElementById('relatorioTexto');
    
    mensagemElement.textContent = '';
    relatorioElement.textContent = 'Gerando relatório...';

    try {
        const resposta = await fetch('/relatorio-diario');
        const relatorio = await resposta.text();
        
        relatorioElement.textContent = relatorio;
        mensagemElement.textContent = '';

    } catch (erro) {
        mensagemElement.textContent = 'Erro ao se comunicar com o servidor ou gerar o relatório.';
        relatorioElement.textContent = '';
    }
});

document.getElementById('btnBaixarRelatorio').addEventListener('click', () => {
    window.location.href = '/baixar-relatorio';
});