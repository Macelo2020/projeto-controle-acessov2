document.addEventListener('DOMContentLoaded', () => {
    const btnGerarRelatorio = document.getElementById('btnGerarRelatorio');
    const btnBaixarRelatorio = document.getElementById('btnBaixarRelatorio');
    const btnZerarRelatorio = document.getElementById('btnZerarRelatorio');
    const relatorioTableBody = document.querySelector('#relatorioTable tbody');
    const adminMessage = document.getElementById('adminMessage');
    const searchInput = document.getElementById('searchInput'); // Novo campo de pesquisa
    let registrosGlobais = []; // Armazenará todos os registros para filtrar

    // Função para mostrar mensagens de status
    const showMessage = (msg, isError = false) => {
        adminMessage.textContent = msg;
        adminMessage.style.color = isError ? '#d9534f' : '#5cb85c';
        adminMessage.style.display = 'block';
    };

    // Função para renderizar os dados na tabela
    const renderTable = (registros) => {
        relatorioTableBody.innerHTML = ''; // Limpa a tabela
        if (registros.length === 0) {
            showMessage('Nenhum acesso encontrado com o filtro aplicado.');
            return;
        }

        registros.forEach(registro => {
            const row = document.createElement('tr');
            const dataHora = new Date(registro.dataHora).toLocaleString('pt-BR');
            // Adicione uma classe para o estilo de acordo com o status
            row.classList.add(registro.status === 'concedido' ? 'acesso-concedido' : 'acesso-negado');
            row.innerHTML = `
                <td>${dataHora}</td>
                <td>${registro.matricula}</td>
                <td>${registro.nome}</td>
                <td>${registro.status}</td>
            `;
            relatorioTableBody.appendChild(row);
        });
        showMessage(`Relatório diário carregado com sucesso! Total: ${registros.length} acessos.`, false);
    };

    // Função para buscar e exibir o relatório completo
    const fetchAndDisplayReport = async () => {
        try {
            const response = await fetch('/api/admin/relatorio');
            registrosGlobais = await response.json(); // Armazena os dados
            renderTable(registrosGlobais); // Renderiza a tabela completa
        } catch (error) {
            console.error('Erro ao buscar o relatório:', error);
            showMessage('Erro ao carregar o relatório.', true);
        }
    };

    // Função de filtro
    const filterData = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredRegistros = registrosGlobais.filter(registro => {
            return (
                registro.matricula.toLowerCase().includes(searchTerm) ||
                registro.nome.toLowerCase().includes(searchTerm) ||
                registro.status.toLowerCase().includes(searchTerm)
            );
        });
        renderTable(filteredRegistros);
    };

    // Event Listeners
    btnGerarRelatorio.addEventListener('click', fetchAndDisplayReport);
    btnBaixarRelatorio.addEventListener('click', () => {
        window.location.href = '/api/admin/baixar-relatorio';
    });
    btnZerarRelatorio.addEventListener('click', async () => {
        const senha = prompt("Digite a senha para zerar o relatório:");
        if (senha) {
            try {
                const response = await fetch('/api/admin/zerar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senha })
                });

                const mensagem = await response.text();
                if (response.ok) {
                    showMessage(mensagem, false);
                    relatorioTableBody.innerHTML = ''; // Limpa a tabela
                    registrosGlobais = []; // Limpa os dados
                } else {
                    showMessage(mensagem, true);
                }
            } catch (error) {
                console.error('Erro ao zerar o relatório:', error);
                showMessage('Erro ao tentar zerar o relatório.', true);
            }
        }
    });

    // Adiciona o listener para a pesquisa
    searchInput.addEventListener('input', filterData);

    // Carrega o relatório automaticamente ao abrir a página
    fetchAndDisplayReport();
});