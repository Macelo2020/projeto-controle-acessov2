document.getElementById('btnGerarRelatorio').addEventListener('click', async () => {
    const mensagemElement = document.getElementById('adminMessage');
    const tableBody = document.querySelector('#relatorioTable tbody');
    const btnVerBruto = document.getElementById('btnVerBruto');
    const rawContentElement = document.getElementById('rawContent');

    mensagemElement.innerHTML = '';
    mensagemElement.className = 'message-area';
    tableBody.innerHTML = '';
    btnVerBruto.style.display = 'none';
    rawContentElement.style.display = 'none';
    rawContentElement.textContent = '';

    try {
        const resposta = await fetch('/relatorio-diario');
        
        if (resposta.status === 204) {
            mensagemElement.innerHTML = `<span class="icon material-icons">info</span> <div class="text-content"><p class="title">Relatório Vazio</p><p class="details">Não há acessos registrados para hoje.</p></div>`;
            mensagemElement.classList.add('error');
            return;
        }

        if (!resposta.ok) {
            const erroMensagem = await resposta.text();
            throw new Error(erroMensagem);
        }

        const acessos = await resposta.json(); // <-- AQUI! Agora recebemos um JSON
        let parsedCount = 0;

        acessos.forEach(acesso => {
            const dataHora = new Date(acesso.data_acesso).toLocaleString('pt-BR');
            const status = acesso.status;
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${dataHora}</td>
                <td>${acesso.matricula}</td>
                <td>${acesso.nome}</td>
                <td><span class="status ${status.toLowerCase()}">${status}</span></td>
            `;
            tableBody.appendChild(newRow);
            parsedCount++;
        });

        if (parsedCount > 0) {
            mensagemElement.innerHTML = `<span class="icon material-icons">check_circle</span> <div class="text-content"><p class="title">Relatório Gerado!</p><p class="details">Foram encontrados ${parsedCount} acessos.</p></div>`;
            mensagemElement.classList.add('success');
        } else {
            mensagemElement.innerHTML = `<span class="icon material-icons">warning</span> <div class="text-content"><p class="title">Erro de Formato</p><p class="details">O conteúdo do arquivo de relatório não pôde ser lido corretamente.</p></div>`;
            mensagemElement.classList.add('error');
        }

    } catch (erro) {
        mensagemElement.innerHTML = `<span class="icon material-icons">warning</span> <div class="text-content"><p class="title">Erro de Conexão!</p><p class="details">Não foi possível se conectar ao servidor. ${erro.message}</p></div>`;
        mensagemElement.classList.add('error');
    }
});

document.getElementById('btnBaixarRelatorio').addEventListener('click', () => {
    window.location.href = '/baixar-relatorio';
});

document.getElementById('btnZerarRelatorio').addEventListener('click', async () => {
    const senha = prompt("Digite a senha de administrador para zerar o relatório:");
    if (senha === null || senha === "") {
        return;
    }
    
    const mensagemDiv = document.getElementById('adminMessage');
    
    try {
        const response = await fetch(`/admin2/zerar?senha=${senha}`);
        
        mensagemDiv.innerHTML = '';
        mensagemDiv.className = 'message-area';

        if (response.ok) {
            mensagemDiv.innerHTML = `<span class="icon material-icons">check_circle</span> <div class="text-content"><p class="title">Relatório Zerado!</p><p class="details">O relatório diário foi zerado com sucesso.</p></div>`;
            mensagemDiv.classList.add('success');
            document.querySelector('#relatorioTable tbody').innerHTML = '';
        } else {
            const errorText = await response.text();
            mensagemDiv.innerHTML = `<span class="icon material-icons">cancel</span> <div class="text-content"><p class="title">Erro ao Zerar!</p><p class="details">${errorText}</p></div>`;
            mensagemDiv.classList.add('error');
        }
    } catch (error) {
        console.error('Erro ao comunicar com o servidor:', error);
        mensagemDiv.innerHTML = `<span class="icon material-icons">warning</span> <div class="text-content"><p class="title">Erro de Conexão!</p><p class="details">Não foi possível se conectar ao servidor.</p></div>`;
        mensagemDiv.classList.add('error');
    }
});