document.getElementById('btnVerificar').addEventListener('click', async () => {
    const matricula = document.getElementById('inputMatricula').value;
    const mensagemElement = document.getElementById('mensagemStatus');
    
    if (!matricula) {
        mensagemElement.textContent = 'Por favor, digite uma matrícula.';
        return;
    }

    try {
        const resposta = await fetch('/verificar-acesso', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ matricula })
        });

        const dados = await resposta.json();
        
        if (dados.status === 'aprovado') {
            mensagemElement.textContent = dados.mensagem;
            mensagemElement.style.color = 'green';
        } else {
            mensagemElement.textContent = dados.mensagem;
            mensagemElement.style.color = 'red';
        }
    } catch (erro) {
        mensagemElement.textContent = 'Erro ao se comunicar com o servidor.';
        console.error('Erro:', erro);
    }
});