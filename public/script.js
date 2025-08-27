script 270825

document.getElementById('btnVerificar').addEventListener('click', async () => {
    const matricula = document.getElementById('inputMatricula').value;
    const mensagemElement = document.getElementById('mensagemStatus');
    
    // Limpa a mensagem anterior
    mensagemElement.innerHTML = '';
    
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
        
        // Função para formatar a data e a hora
        const formatarDataHora = () => {
            const agora = new Date();
            const data = agora.toLocaleDateString('pt-BR');
            const hora = agora.toLocaleTimeString('pt-BR');
            return `<p>Acesso realizado em: ${data} às ${hora}</p>`;
        };

        if (dados.status === 'aprovado') {
            // Se o status for aprovado, exibe o nome do funcionário
            mensagemElement.innerHTML = `
                <p>${dados.mensagem} ${dados.nome}</p>
                ${formatarDataHora()}
            `;
            mensagemElement.style.color = 'green';
        } else {
            // Se o status for negado, apenas a mensagem é exibida
            mensagemElement.innerHTML = `
                <p>${dados.mensagem}</p>
                ${formatarDataHora()}
            `;
            mensagemElement.style.color = 'red';
        }
    } catch (erro) {
        mensagemElement.innerHTML = `<p>Erro ao se comunicar com o servidor.</p>`;
        console.error('Erro:', erro);
    }
});