const chatSystem = {
    // 🔧 Inicialização do chat
    init() {
        console.log('💬 Chat System iniciado');
        this.setupFirebaseListener();
    },

    // 🔧 Configurar listener do Firebase para chat
    setupFirebaseListener() {
        if (!window.db) {
            console.log('⚠️ Firebase não disponível para chat');
            return;
        }

        console.log('🔧 Configurando listener Firebase para chat...');

        // Ouvir mensagens do chat geral
        window.db.collection('chat_geral')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .onSnapshot((snapshot) => {
                const mensagens = [];
                snapshot.forEach((doc) => {
                    mensagens.push(doc.data());
                });

                console.log('📨 Mensagens recebidas do Firebase:', mensagens.length);

                // Mesclar com mensagens locais
                this.processarMensagensFirebase(mensagens);

            }, (error) => {
                console.error('❌ Erro no listener do chat:', error);
            });
    },

    // 🔧 Processar mensagens do Firebase
    processarMensagensFirebase(mensagensFirebase) {
        // Carregar mensagens locais
        let mensagensLocais = JSON.parse(localStorage.getItem('porter_chat') || '[]');
        
        // Criar mapa para evitar duplicados
        const mapaMensagens = new Map();
        
        // Adicionar todas as mensagens do Firebase
        mensagensFirebase.forEach(msg => {
            mapaMensagens.set(msg.id, msg);
        });
        
        // Adicionar mensagens locais que não estão no Firebase
        mensagensLocais.forEach(msg => {
            if (!mapaMensagens.has(msg.id)) {
                mapaMensagens.set(msg.id, msg);
                // Se a mensagem local não tem flag firebaseSync, enviar para Firebase
                if (!msg.firebaseSync) {
                    this.enviarParaFirebase(msg);
                }
            }
        });
        
        // Converter mapa para array e ordenar
        const todasMensagens = Array.from(mapaMensagens.values());
        todasMensagens.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Salvar no localStorage
        localStorage.setItem('porter_chat', JSON.stringify(todasMensagens));
        
        // Atualizar interface se a aba de chat estiver visível
        if (document.getElementById('tab-chat') && 
            !document.getElementById('tab-chat').classList.contains('hidden')) {
            this.loadChat();
        }
        
        // Atualizar badge
        if (typeof app !== 'undefined' && app.atualizarBadgeChat) {
            app.atualizarBadgeChat();
        }
    },

    // 🔧 Enviar mensagem para Firebase
    enviarParaFirebase(mensagem) {
        if (!window.db) return;
        
        const mensagemParaFirebase = {
            id: mensagem.id,
            sender: mensagem.sender,
            senderRole: mensagem.senderRole,
            senderMood: mensagem.senderMood,
            message: mensagem.message,
            time: mensagem.time,
            timestamp: mensagem.timestamp,
            date: mensagem.date,
            firebaseSync: true
        };
        
        window.db.collection('chat_geral').add(mensagemParaFirebase)
            .then((docRef) => {
                console.log('✅ Mensagem enviada para Firebase:', docRef.id);
            })
            .catch((error) => {
                console.error('❌ Erro ao enviar para Firebase:', error);
            });
    },

    // 🔧 Função principal de carregar chat
    loadChat() {
        if (!document.getElementById('chat-messages')) return;
        
        const container = document.getElementById('chat-messages');
        const chat = JSON.parse(localStorage.getItem('porter_chat') || '[]');
        
        // Mostrar controles admin se for admin ou técnico
        if (app.currentUser && (app.currentUser.role === 'ADMIN' || app.currentUser.role === 'TÉCNICO')) {
            const adminControls = document.getElementById('chat-admin-controls');
            if (adminControls) adminControls.style.display = 'flex';
        }
        
        if (chat.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--gray);">
                    <i class="fas fa-comment-slash" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Nenhuma mensagem ainda. Seja o primeiro a enviar uma mensagem!</p>
                </div>
            `;
            return;
        }
        
        // Ordenar por timestamp (mais antigas primeiro)
        const chatOrdenado = [...chat].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        container.innerHTML = '';
        
        chatOrdenado.forEach(msg => {
            const isSent = msg.sender === app.currentUser.nome;
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;
            messageDiv.dataset.id = msg.id;
            
            messageDiv.innerHTML = `
                <div class="chat-message-header">
                    <span class="chat-message-sender">
                        <span style="font-size: 1.1rem; margin-right: 5px;">${msg.senderMood || '😐'}</span>
                        ${msg.sender} ${msg.senderRole === 'ADMIN' ? ' 👑' : ''} ${msg.senderRole === 'TÉCNICO' ? ' 🔧' : ''}
                    </span>
                    <span class="chat-message-time">${msg.date} ${msg.time}</span>
                </div>
                <div class="chat-message-text">${msg.message}</div>
                ${app.currentUser && (app.currentUser.role === 'ADMIN' || app.currentUser.role === 'TÉCNICO') && !isSent ?
                    `<div style="margin-top: 5px; text-align: right;">
                        <button class="btn btn-danger btn-sm" onclick="chatSystem.deleteChatMessage(${msg.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>` :
                    ''
                }
            `;
            
            container.appendChild(messageDiv);
        });
        
        // Scroll para baixo
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
        
        // Atualizar badge
        if (typeof app !== 'undefined' && app.atualizarBadgeChat) {
            app.atualizarBadgeChat();
        }
    },

    // 🔧 Enviar mensagem
    sendChatMessage() {
        if (!app.currentUser) {
            alert('Você precisa estar logado para enviar mensagens.');
            return;
        }
        
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        const sendBtn = document.getElementById('chat-send-btn');
        const originalHTML = sendBtn.innerHTML;
        sendBtn.innerHTML = '<div class="loading"></div>';
        sendBtn.disabled = true;
        
        // Criar objeto da mensagem
        const chatMessage = {
            id: Date.now(),
            sender: app.currentUser.nome,
            senderRole: app.currentUser.role,
            senderMood: app.getMoodAtual(),
            message: message,
            time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('pt-BR'),
            firebaseSync: false
        };
        
        // 1. Salvar localmente
        let chat = JSON.parse(localStorage.getItem('porter_chat') || '[]');
        chat.push(chatMessage);
        
        if (chat.length > 200) chat = chat.slice(-200);
        localStorage.setItem('porter_chat', JSON.stringify(chat));
        
        // 2. Enviar para Firebase (se disponível)
        if (window.db) {
            this.enviarParaFirebase(chatMessage);
        }
        
        // 3. Limpar campo e restaurar botão
        input.value = '';
        
        setTimeout(() => {
            sendBtn.innerHTML = originalHTML;
            sendBtn.disabled = false;
            input.focus();
        }, 500);
        
        // 4. Recarregar chat
        this.loadChat();
        
        // 5. Criar notificação
        if (typeof app !== 'undefined' && app.criarNotificacaoChatComAcao) {
            app.criarNotificacaoChatComAcao(chatMessage);
        }
    },

    // 🔧 Deletar mensagem
    deleteChatMessage(id) {
        if (!app.currentUser || (app.currentUser.role !== 'ADMIN' && app.currentUser.role !== 'TÉCNICO')) {
            alert('Apenas administradores ou técnicos podem excluir mensagens.');
            return;
        }
        
        if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;
        
        let chat = JSON.parse(localStorage.getItem('porter_chat') || '[]');
        chat = chat.filter(msg => msg.id !== id);
        localStorage.setItem('porter_chat', JSON.stringify(chat));
        
        this.loadChat();
        
        if (typeof app !== 'undefined' && app.updateTabCounts) {
            app.updateTabCounts();
        }
    },

    // 🔧 Limpar chat
    clearChat() {
        if (!app.currentUser || (app.currentUser.role !== 'ADMIN' && app.currentUser.role !== 'TÉCNICO')) {
            alert('Apenas administradores ou técnicos podem limpar o chat.');
            return;
        }
        
        if (!confirm('Tem certeza que deseja limpar todas as mensagens do chat?')) return;
        
        localStorage.removeItem('porter_chat');
        this.loadChat();
        
        if (typeof app !== 'undefined') {
            app.updateTabCounts();
            app.showMessage('Chat limpo com sucesso!', 'success');
        }
    },

    // 🔧 Funções do chat privado (mantidas do sistema original)
    loadPrivateChatUsers() {
        if (!app.currentUser) return;
        
        const select = document.getElementById('private-chat-target');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione um operador...</option>';
        
        // Usar lista de usuários do sistema
        const todosUsuarios = [
            ...DATA.funcionarios.filter(f => f.user !== app.currentUser.user),
            ...DATA.tecnicos.map(t => ({
                nome: t.nome,
                user: t.nome.split(' - ')[0].toLowerCase().replace(/\s+/g, '.'),
                role: 'TÉCNICO'
            })).filter(t => t.user !== app.currentUser.user)
        ];
        
        todosUsuarios.sort((a, b) => a.nome.localeCompare(b.nome));
        
        todosUsuarios.forEach(user => {
            const option = document.createElement('option');
            option.value = user.user;
            option.textContent = `${user.nome} ${user.role === 'ADMIN' ? '👑' : ''} ${user.role === 'TÉCNICO' ? '🔧' : ''}`;
            select.appendChild(option);
        });
    },

    loadPrivateChat() {
        if (!app.currentUser || !app.currentPrivateChatTarget) return;
        
        const container = document.getElementById('chat-private-messages');
        const privateChats = JSON.parse(localStorage.getItem('porter_chat_privado') || '{}');
        
        const chatId = this.getPrivateChatId(app.currentUser.user, app.currentPrivateChatTarget);
        const messages = privateChats[chatId] || [];
        
        // Habilitar campos
        const input = document.getElementById('chat-private-input');
        const sendBtn = document.getElementById('chat-private-send-btn');
        
        if (app.currentPrivateChatTarget) {
            input.disabled = false;
            sendBtn.disabled = false;
        }
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--gray);">
                    <i class="fas fa-comment-slash" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Nenhuma mensagem ainda. Comece a conversa!</p>
                </div>
            `;
            return;
        }
        
        const messagesOrdenado = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        container.innerHTML = '';
        
        messagesOrdenado.forEach(msg => {
            const isSent = msg.sender === app.currentUser.user;
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;
            
            const senderInfo = DATA.funcionarios.find(f => f.user === msg.sender) || 
                              { nome: msg.sender, role: 'OPERADOR' };
            
            messageDiv.innerHTML = `
                <div class="chat-message-header">
                    <span class="chat-message-sender">
                        <span style="font-size: 1.1rem; margin-right: 5px;">${msg.senderMood || '😐'}</span>
                        ${senderInfo.nome.split(' ')[0]} ${senderInfo.role === 'ADMIN' ? '👑' : ''}
                    </span>
                    <span class="chat-message-time">${msg.date} ${msg.time}</span>
                </div>
                <div class="chat-message-text">${msg.message}</div>
            `;
            
            container.appendChild(messageDiv);
        });
        
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    },

    sendPrivateChatMessage() {
        if (!app.currentUser || !app.currentPrivateChatTarget) {
            alert('Selecione um destinatário primeiro.');
            return;
        }
        
        const input = document.getElementById('chat-private-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        const sendBtn = document.getElementById('chat-private-send-btn');
        const originalHTML = sendBtn.innerHTML;
        sendBtn.innerHTML = '<div class="loading"></div>';
        sendBtn.disabled = true;
        
        const chatId = this.getPrivateChatId(app.currentUser.user, app.currentPrivateChatTarget);
        
        const chatMessage = {
            id: Date.now(),
            sender: app.currentUser.user,
            senderName: app.currentUser.nome,
            senderRole: app.currentUser.role,
            senderMood: app.getMoodAtual(),
            receiver: app.currentPrivateChatTarget,
            message: message,
            time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('pt-BR')
        };
        
        let privateChats = JSON.parse(localStorage.getItem('porter_chat_privado') || '{}');
        
        if (!privateChats[chatId]) {
            privateChats[chatId] = [];
        }
        
        privateChats[chatId].push(chatMessage);
        
        if (privateChats[chatId].length > 100) {
            privateChats[chatId] = privateChats[chatId].slice(-100);
        }
        
        localStorage.setItem('porter_chat_privado', JSON.stringify(privateChats));
        
        input.value = '';
        
        setTimeout(() => {
            sendBtn.innerHTML = originalHTML;
            sendBtn.disabled = false;
            input.focus();
        }, 500);
        
        this.loadPrivateChat();
        
        // Atualizar badge
        if (typeof app !== 'undefined' && app.atualizarBadgeChatPrivado) {
            app.atualizarBadgeChatPrivado();
        }
    },

    getPrivateChatId(user1, user2) {
        const users = [user1, user2].sort();
        return `${users[0]}_${users[1]}`;
    }
};

// 🔧 Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    // Aguardar um pouco para garantir que tudo esteja carregado
    setTimeout(() => {
        chatSystem.init();
    }, 2000);
});

// 🔧 Inicializar também quando o app estiver pronto
if (typeof app !== 'undefined') {
    app.loadChat = function() {
        if (typeof chatSystem !== 'undefined' && chatSystem.loadChat) {
            chatSystem.loadChat();
        }
    };
    
    app.sendChatMessage = function() {
        if (typeof chatSystem !== 'undefined' && chatSystem.sendChatMessage) {
            chatSystem.sendChatMessage();
        }
    };
    
    app.loadPrivateChat = function() {
        if (typeof chatSystem !== 'undefined' && chatSystem.loadPrivateChat) {
            chatSystem.loadPrivateChat();
        }
    };
    
    app.sendPrivateChatMessage = function() {
        if (typeof chatSystem !== 'undefined' && chatSystem.sendPrivateChatMessage) {
            chatSystem.sendPrivateChatMessage();
        }
    };
}
