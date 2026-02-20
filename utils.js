// Funções utilitárias
const utils = {
    // FIX: botão de voltar para formulário OS
    fecharModalEmail() {
        const modal = document.getElementById('modal-email-detalhes');
        if (modal) modal.remove();
    },

    // FIX: função para destacar mensagem no chat
    destacarMensagemChat(mensagemId) {
        const mensagens = document.querySelectorAll('.chat-message');
        mensagens.forEach(msg => {
            msg.classList.remove('mensagem-destacada');
            if (msg.dataset.id === String(mensagemId)) {
                msg.classList.add('mensagem-destacada');
                msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    msg.classList.remove('mensagem-destacada');
                }, 5000);
            }
        });
    },

    // FIX: função para enviar mensagem no chat (compatibilidade)
    sendChatMessage() {
        chatSystem.sendChatMessage();
    },

    // FIX: função para carregar chat privado (compatibilidade)
    loadPrivateChat() {
        chatSystem.loadPrivateChat();
    },

    // FIX: função para enviar mensagem privada (compatibilidade)
    sendPrivateChatMessage() {
        chatSystem.sendPrivateChatMessage();
    },

    // FIX: função para gerar PDF (compatibilidade)
    generatePDF() {
        pdfGenerator.generatePDF();
    },

    // FIX: função para voltar ao formulário OS (compatibilidade)
    voltarParaFormOS() {
        appEmail.voltarParaFormOS();
    },

    // FIX: função para ver detalhes do email da OS (compatibilidade)
    verDetalhesEmailOS(osId) {
        appEmail.verDetalhesEmailOS(osId);
    }
};

// 🔧 FIX 2: Função para detectar atualização de página (F5)
function detectarAtualizacaoPagina() {
    // Verificar performance navigation
    if (window.performance && window.performance.navigation) {
        const tipoNavegacao = window.performance.navigation.type;
        
        // TYPE_RELOAD = 1 (atualização da página)
        if (tipoNavegacao === 1) {
            console.log('🔄 Página foi atualizada (F5)');
            
            // 🔧 FIX 2: Manter sessão ativa
            if (typeof app !== 'undefined' && app.currentUser) {
                console.log('✅ Mantendo sessão do usuário:', app.currentUser.nome);
                // Atualizar timestamp da sessão
                app.salvarSessao();
            }
        }
    }
}

// Executar quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectarAtualizacaoPagina);
} else {
    detectarAtualizacaoPagina();
}

// 🔧 FIX 2: Monitorar o evento beforeunload para salvar sessão
window.addEventListener('beforeunload', function() {
    if (typeof app !== 'undefined' && app.currentUser) {
        // Salvar sessão antes de sair
        app.salvarSessao();
    }
});

// 🔧 FIX 2: Monitorar quando a página volta a ficar visível
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        if (typeof app !== 'undefined' && app.currentUser) {
            console.log('📱 Página voltou a ficar visível');
            // Atualizar sessão
        if (app && typeof app.salvarSessao === 'function') {
    app.salvarSessao();
} else {
    console.log('⚠️ app.salvarSessao não está disponível, usando fallback');
    // Fallback: salvar sessão manualmente
    if (app && app.currentUser) {
        localStorage.setItem('porter_sessao', JSON.stringify({
            user: app.currentUser,
            timestamp: new Date().toISOString()
        }));
    }
}

// Tornar funções disponíveis globalmente para compatibilidade
window.sendChatMessage = chatSystem ? chatSystem.sendChatMessage : utils.sendChatMessage;
window.loadPrivateChat = chatSystem ? chatSystem.loadPrivateChat : utils.loadPrivateChat;
window.sendPrivateChatMessage = chatSystem ? chatSystem.sendPrivateChatMessage : utils.sendPrivateChatMessage;
window.generatePDF = pdfGenerator ? pdfGenerator.generatePDF : utils.generatePDF;
window.voltarParaFormOS = appEmail ? appEmail.voltarParaFormOS : utils.voltarParaFormOS;
window.verDetalhesEmailOS = appEmail ? appEmail.verDetalhesEmailOS : utils.verDetalhesEmailOS;
window.destacarMensagemChat = utils.destacarMensagemChat;
window.fecharModalEmail = utils.fecharModalEmail;
