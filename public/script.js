document.getElementById('acessoForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const matricula = document.getElementById('matricula').value;
    const mensagemDiv = document.getElementById('mensagem');
    mensagemDiv.innerHTML = ''; // Limpa mensagens anteriores
    mensagemDiv.className = 'message-area'; // Resetar classes

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
                Acesso concedido.<br>
                Bem-vindo, ${data.nome}<br>
                Acesso realizado em: ${dataHoraAcesso}
            `;
            mensagemDiv.classList.add('success'); // Adiciona classe de sucesso
        } else {
            mensagemDiv.innerHTML = `Erro: ${data.mensagem}`;
            mensagemDiv.classList.add('error'); // Adiciona classe de erro
        }
    } catch (error) {
        console.error('Erro ao se comunicar com o servidor:', error);
        mensagemDiv.innerHTML = 'Erro ao se comunicar com o servidor.';
        mensagemDiv.classList.add('error'); // Adiciona classe de erro
    }
});