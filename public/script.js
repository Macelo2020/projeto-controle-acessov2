document.getElementById('acessoForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const matriculaInput = document.getElementById('matricula');
    const matricula = matriculaInput.value;
    const mensagemDiv = document.getElementById('mensagem');
    const btnVerificar = document.getElementById('btnVerificar');

    // Limpa mensagens anteriores e reseta as classes
    mensagemDiv.innerHTML = '';
    mensagemDiv.className = 'message-area';

    // Estado de carregamento
    btnVerificar.disabled = true;
    btnVerificar.classList.add('loading');
    btnVerificar.querySelector('.btn-text').style.display = 'none';
    btnVerificar.querySelector('.loading-text').style.display = 'inline';

    try {
        const response = await fetch('/verificar-acesso', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ matricula: matricula })
        });

        const data = await response.json();

        if (response.ok) {
            const dataHoraAcesso = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
            mensagemDiv.innerHTML = `
                <span class="icon material-icons">check_circle</span>
                <div class="text-content">
                    <p class="title">Acesso Concedido.</p>
                    <p class="details">Bem-vindo, ${data.nome}</p>
                    <p class="details">Acesso realizado em: ${dataHoraAcesso}</p>
                </div>
            `;
            mensagemDiv.classList.add('success');
        } else {
            mensagemDiv.innerHTML = `
                <span class="icon material-icons">cancel</span>
                <div class="text-content">
                    <p class="title">Acesso Negado.</p>
                    <p class="details">Motivo: ${data.mensagem}</p>
                </div>
            `;
            mensagemDiv.classList.add('error');
        }
    } catch (error) {
        console.error('Erro ao se comunicar com o servidor:', error);
        mensagemDiv.innerHTML = `
            <span class="icon material-icons">warning</span>
            <div class="text-content">
                <p class="title">Erro de Conexão.</p>
                <p class="details">Não foi possível se conectar ao servidor.</p>
            </div>
        `;
        mensagemDiv.classList.add('error');
    } finally {
        // Remove o estado de carregamento
        btnVerificar.disabled = false;
        btnVerificar.classList.remove('loading');
        btnVerificar.querySelector('.btn-text').style.display = 'inline';
        btnVerificar.querySelector('.loading-text').style.display = 'none';
    }
});