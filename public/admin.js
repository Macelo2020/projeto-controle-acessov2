document.getElementById('btnGerarRelatorio').addEventListener('click', async () => {
    const mensagemElement = document.getElementById('adminMessage');
    const tableBody = document.querySelector('#relatorioTable tbody');
    const btnVerBruto = document.getElementById('btnVerBruto');
    const rawContentElement = document.getElementById('rawContent');

    // Limpa mensagens, tabela e botão de depuração anteriores
    mensagemElement.innerHTML = '';
    mensagemElement.className = 'message-area';
    tableBody.innerHTML = '';
    btnVerBruto.style.display = 'none';
    rawContentElement.style.display = 'none';
    rawContentElement.textContent = '';

    try {
        const resposta = await fetch('/relatorio-diario');
        const relatorio = await resposta.text();
        
        // Verifica se o relatório está vazio
        if (relatorio.trim() === '') {
            mensagemElement.innerHTML = `<span class="icon material-icons">info</span> <div class="text-content"><p class="title">Relatório Vazio</p><p class="details">Não há acessos registrados para hoje.</p></div>`;
            mensagemElement.classList.add('error');
            return;
        }

        // Divide o relatório em linhas e processa cada uma
        const linhas = relatorio.trim().split('\n');
        let parsedCount = 0;

        linhas.forEach(linha => {
            // Regex mais flexível para lidar com diferentes espaços e caracteres invisíveis
            const regex = /(.+?)\s*-\s*Matrícula: (\d+)\s*-\s*Nome: (.+?)\s*-\s*Status: (.+)/;
            const match = linha.match(regex);
            
            if (match) {
                const [_, dataHora, matricula, nome, status] = match;
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td>${dataHora}</td>
                    <td>${matricula}</td>
                    <td>${nome}</td>
                    <td><span class="status ${status.toLowerCase()}">${status}</span></td>
                `;
                tableBody.appendChild(newRow);
                parsedCount++;
            }
        });

        if (parsedCount > 0) {
            mensagemElement.innerHTML = `<span class="icon material-icons">check_circle</span> <div class="text-content"><p class="title">Relatório Gerado!</p><p class="details">Foram encontrados ${parsedCount} acessos.</p></div>`;
            mensagemElement.classList.add('success');
        } else {
            // Se nenhuma linha correspondeu, o formato do arquivo está incorreto
            mensagemElement.innerHTML = `<span class="icon material-icons">warning</span> <div class="text-content"><p class="title">Erro de Formato</p><p class="details">O conteúdo do arquivo de relatório não pôde ser lido corretamente.</p></div>`;
            mensagemElement.classList.add('error');
            btnVerBruto.style.display = 'block';
            
            // Evento para o novo botão de depuração
            btnVerBruto.onclick = () => {
                rawContentElement.textContent = relatorio;
                rawContentElement.style.display = 'block';
                btnVerBruto.style.display = 'none';
            };
        }

    } catch (erro) {
        mensagemElement.innerHTML = `<span class="icon material-icons">warning</span> <div class="text-content"><p class="title">Erro de Conexão!</p><p class="details">Não foi possível se conectar ao servidor.</p></div>`;
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
            // Limpa a tabela após zerar
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