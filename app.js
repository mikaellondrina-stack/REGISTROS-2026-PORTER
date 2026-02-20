// Aplicação principal
const app = {
    currentUser: null,
    selectedMood: null,
    currentCondoFilter: '',
    notifications: [],
    lastLogoffTime: null,
    chatInterval: null,
    privateChatInterval: null,
    moodInterval: null,
    onlineInterval: null,
    onlineUsers: [],
    lastOSId: null,
    currentPrivateChatTarget: null,
    filtrosAtas: {},
    filtrosPresenca: {},

    init() {
        // 🔧 FIX 2: Restaurar sessão ao iniciar
        this.restaurarSessao();
        
        // GARANTIR que começa na tela de login se não houver sessão
        if (!this.currentUser) {
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('main-content').classList.add('hidden');
        } else {
            this.showApp();
        }

        // Limpar auto-preenchimento dos campos de login
        setTimeout(() => {
            document.getElementById('login-user').value = '';
            document.getElementById('login-pass').value = '';
            document.getElementById('login-turno').value = 'Diurno';
        }, 100);

        this.loadCondos();
        this.loadFiltros();
        this.loadNotifications();
        this.setupEventListeners();
        this.setupAutoSave();
        this.setupOSPreview();
        this.setupResponsive();

        // Configurar datas padrão
        const hoje = new Date();
        const umaSemanaAtras = new Date();
        umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
        
        document.getElementById('filter-data-inicio').value = umaSemanaAtras.toISOString().split('T')[0];
        document.getElementById('filter-data-fim').value = hoje.toISOString().split('T')[0];
        document.getElementById('filter-presenca-inicio').value = umaSemanaAtras.toISOString().split('T')[0];
        document.getElementById('filter-presenca-fim').value = hoje.toISOString().split('T')[0];
        document.getElementById('os-data').value = hoje.toISOString().split('T')[0];

        // Preencher datas do relatório
        document.getElementById('report-data-inicio').value = umaSemanaAtras.toISOString().split('T')[0];
        document.getElementById('report-data-fim').value = hoje.toISOString().split('T')[0];

        this.carregarFiltrosSalvos();

        // Configurar clique fora da lista de online
        document.addEventListener('click', (e) => {
            const onlineList = document.getElementById('online-users-list');
            const onlineDropdown = document.getElementById('online-users');
            if (onlineList && onlineList.style.display === 'block' &&
                !onlineDropdown.contains(e.target) &&
                !onlineList.contains(e.target)) {
                onlineList.style.display = 'none';
            }
        });

        // Configurar clique fora das notificações
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-bell') && !e.target.closest('.notifications-panel')) {
                document.getElementById('notifications-panel').classList.remove('show');
            }
        });
    },

    // 🔧 FIX 2: NOVA FUNÇÃO - Restaurar sessão ao iniciar
    restaurarSessao() {
        try {
            // Tentar recuperar sessão do localStorage
            const sessaoSalva = localStorage.getItem('porter_session');
            if (sessaoSalva) {
                const usuario = JSON.parse(sessaoSalva);
                
                // Verificar se a sessão não expirou (últimas 24 horas)
                const ultimaAtividade = new Date(usuario.loginTimestamp || usuario.lastActivity);
                const agora = new Date();
                const horasDesdeLogin = (agora - ultimaAtividade) / (1000 * 60 * 60);
                
                if (horasDesdeLogin < 24) { // Sessão válida por 24 horas
                    this.currentUser = usuario;
                    console.log('✅ Sessão restaurada:', usuario.nome);
                    return true;
                } else {
                    console.log('⚠️ Sessão expirada');
                    localStorage.removeItem('porter_session');
                    localStorage.removeItem('porter_last_session');
                }
            }
        } catch (e) {
            console.log('❌ Erro ao restaurar sessão:', e);
        }
        return false;
    },

    setupEventListeners() {
        // Enter no login
        document.getElementById('login-pass').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        // Enter no chat
        document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // 🔧 FIX 1: chat individual - garantir que o evento está configurado
        const privateChatSelect = document.getElementById('private-chat-target');
        if (privateChatSelect) {
            // Remover event listeners anteriores para evitar duplicação
            privateChatSelect.replaceWith(privateChatSelect.cloneNode(true));
            
            // Recapturar o elemento
            const newSelect = document.getElementById('private-chat-target');
            newSelect.addEventListener('change', (e) => {
                this.currentPrivateChatTarget = e.target.value;
                this.loadPrivateChat();
            });
        }

        // Enter no chat privado
        document.getElementById('chat-private-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendPrivateChatMessage();
            }
        });

        // Salvar logoff quando a página for fechada
        window.addEventListener('beforeunload', () => {
            if (this.currentUser) {
                this.salvarSessao(); // Apenas salvar sessão, não registrar logoff
            }
        });

        // 🔧 FIX 3: botão online - corrigir evento de toggle
        const onlineDropdown = document.getElementById('online-users');
        if (onlineDropdown) {
            onlineDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleOnlineUsers();
            });
        }

        // Configurar envio do formulário de OS
        const osForm = document.getElementById('os-form-email');
        if (osForm) {
            osForm.addEventListener('submit', (e) => {
                this.abrirOSComEmail(e);
            });
        }

        // 🔧 FIX 2: Recarregar usuários online ao voltar para a página
        window.addEventListener('pageshow', () => {
            if (this.currentUser) {
                this.updateOnlineUsers();
            }
        });
    },

    setupAutoSave() {
        setInterval(() => {
            if (this.currentUser) {
                this.salvarSessao();
            }
        }, 30000);
    },

    setupResponsive() {
        window.addEventListener('resize', () => {
            if (this.currentUser) {
                if (window.innerWidth > 1200) {
                    document.getElementById('sidebar').style.display = 'block';
                    document.getElementById('sidebar').classList.remove('show');
                } else {
                    document.getElementById('sidebar').style.display = 'none';
                }
            }
        });
    },

    setupOSPreview() {
        if (typeof appEmail !== 'undefined' && appEmail.setupOSPreview) {
            appEmail.setupOSPreview();
        }
    },

    setupOnlineTracking() {
        // 🔧 FIX 3: Atualizar status online a cada 10 segundos (mais frequente)
        this.onlineInterval = setInterval(() => {
            if (this.currentUser) {
                this.updateOnlineUsers();
            }
        }, 10000);
        // Inicializar imediatamente
        this.updateOnlineUsers();
    },

    getMoodStatusTexto(mood) {
        const statusMap = {
            '😠': 'Zangado hoje',
            '😔': 'Triste hoje',
            '😐': 'Neutro hoje',
            '🙂': 'Feliz hoje',
            '😄': 'Radiante hoje'
        };
        return statusMap[mood] || 'Não avaliado';
    },

    // 🔧 FIX 3: botão online - função completamente reformulada
    updateOnlineUsers() {
        if (!this.currentUser) return;
        
        const agora = new Date();
        
        // 1. Atualizar a própria sessão primeiro
        this.salvarSessao();
        
        // 2. Buscar usuários online do Firebase
        let usuariosOnline = [];
        
        // Adicionar usuário atual primeiro
        const moodAtual = this.getMoodAtual();
        const statusMood = this.getMoodStatusTexto(moodAtual);
        usuariosOnline.push({
            ...this.currentUser,
            lastActivity: agora.toISOString(),
            mood: moodAtual,
            moodStatus: statusMood,
            isCurrentUser: true,
            online: true
        });
        
        // 3. Buscar outros usuários do Firebase
        try {
            const onlineData = localStorage.getItem('porter_online_firebase');
            if (onlineData) {
                const data = JSON.parse(onlineData);
                const dataTime = new Date(data.timestamp);
                const diferencaSegundos = (agora - dataTime) / 1000;
                
                if (diferencaSegundos < 10) { // Dados recentes do Firebase
                    data.users.forEach(usuario => {
                        // Pular usuário atual
                        if (usuario.user === this.currentUser.user) return;
                        
                        usuariosOnline.push({
                            nome: usuario.nome,
                            user: usuario.user,
                            role: usuario.role,
                            lastActivity: usuario.lastActivity,
                            mood: usuario.mood || '😐',
                            moodStatus: this.getMoodStatusTexto(usuario.mood || '😐'),
                            isCurrentUser: false,
                            online: true,
                            turno: usuario.turno || 'Diurno'
                        });
                    });
                }
            }
        } catch (e) {
            console.log('Erro ao buscar usuários online do Firebase:', e);
        }
        
        this.onlineUsers = usuariosOnline;
        
        // 4. Atualizar contador no header
        const onlineCount = document.getElementById('online-count');
        if (onlineCount) {
            if (this.onlineUsers.length === 1) {
                onlineCount.textContent = '1 (apenas você)';
                onlineCount.style.color = '#f39c12';
            } else {
                onlineCount.textContent = this.onlineUsers.length;
                onlineCount.style.color = '#2ecc71';
            }
        }
        
        // 5. Se a lista estiver visível, atualizar
        const onlineList = document.getElementById('online-users-list');
        if (onlineList && onlineList.style.display === 'block') {
            this.renderOnlineUsersList();
        }
        
        console.log('👥 Usuários online atualizados:', this.onlineUsers.length);
    },

    // 🔧 FIX 3: botão online - função para mostrar/ocultar lista
    toggleOnlineUsers() {
        const onlineList = document.getElementById('online-users-list');
        if (onlineList.style.display === 'block') {
            onlineList.style.display = 'none';
        } else {
            this.renderOnlineUsersList();
            onlineList.style.display = 'block';
            // Reposicionar se necessário
            setTimeout(() => {
                const rect = onlineList.getBoundingClientRect();
                if (rect.bottom > window.innerHeight) {
                    onlineList.style.bottom = '100%';
                    onlineList.style.top = 'auto';
                }
            }, 10);
        }
    },

    renderOnlineUsersList() {
        const onlineList = document.getElementById('online-users-list');
        onlineList.innerHTML = '';
        
        if (this.onlineUsers.length === 0) {
            onlineList.innerHTML = `
                <div class="online-user-item">
                    <div class="online-user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="online-user-info">
                        <div class="online-user-name">Nenhum operador online</div>
                        <div class="online-user-role">Apenas você está conectado</div>
                    </div>
                </div>
            `;
            return;
        }
        
        this.onlineUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'online-user-item';
            
            // Determinar status de atividade
            const ultimaAtividade = new Date(user.lastActivity);
            const agora = new Date();
            const diferencaMinutos = Math.floor((agora - ultimaAtividade) / (1000 * 60));
            let statusTexto = '';
            
            if (user.isCurrentUser) {
                statusTexto = 'Online agora';
            } else if (diferencaMinutos < 1) {
                statusTexto = 'Online agora';
            } else if (diferencaMinutos < 5) {
                statusTexto = `Online há ${diferencaMinutos} min`;
            } else {
                statusTexto = 'Online há +5 min';
            }
            
            userItem.innerHTML = `
                <div class="online-user-avatar" style="background: ${this.getCorPorMood(user.mood)}">
                    <i class="fas fa-user"></i>
                </div>
                <div class="online-user-info">
                    <div class="online-user-name">
                        ${user.nome.split(' ')[0]} ${user.isCurrentUser ? '(Você)' : ''}
                        ${user.role === 'ADMIN' ? ' 👑' : ''}
                        ${user.role === 'TÉCNICO' ? ' 🔧' : ''}
                    </div>
                    <div class="online-user-role">
                        ${user.turno || 'Diurno'} | ${statusTexto}
                    </div>
                </div>
                <div class="online-status" style="background: ${user.isCurrentUser || diferencaMinutos < 5 ? '#2ecc71' : '#f39c12'}"></div>
            `;
            onlineList.appendChild(userItem);
        });
    },

    formatarTempoAtivo(dataAtividade) {
        const agora = new Date();
        const diferenca = agora - new Date(dataAtividade);
        const minutos = Math.floor(diferenca / (1000 * 60));
        
        if (minutos < 1) return 'Agora mesmo';
        if (minutos === 1) return 'Há 1 minuto';
        if (minutos < 60) return `Há ${minutos} minutos`;
        
        const horas = Math.floor(minutos / 60);
        if (horas === 1) return 'Há 1 hora';
        return `Há ${horas} horas`;
    },

    getCorPorMood(mood) {
        const cores = {
            '😠': '#ffeaa7',
            '😔': '#fd79a8',
            '😐': '#dfe6e9',
            '🙂': '#a29bfe',
            '😄': '#55efc4'
        };
        return cores[mood] || '#e8f4fc';
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('show');
    },

    registrarLogoff() {
        if (!this.currentUser) return;
        
        const logoffs = JSON.parse(localStorage.getItem('porter_logoffs') || '[]');
        const logoffData = {
            user: this.currentUser.user,
            nome: this.currentUser.nome,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            timestamp: new Date().toISOString(),
            turno: this.currentUser.turno
        };
        
        logoffs.unshift(logoffData);
        if (logoffs.length > 200) logoffs.pop();
        localStorage.setItem('porter_logoffs', JSON.stringify(logoffs));
        
        this.lastLogoffTime = new Date().toISOString();
        localStorage.setItem('porter_last_logoff', this.lastLogoffTime);
        
        // Limpar intervalos
        if (this.chatInterval) {
            clearInterval(this.chatInterval);
            this.chatInterval = null;
        }
        
        if (this.privateChatInterval) {
            clearInterval(this.privateChatInterval);
            this.privateChatInterval = null;
        }
        
        if (this.moodInterval) {
            clearInterval(this.moodInterval);
            this.moodInterval = null;
        }
        
        if (this.onlineInterval) {
            clearInterval(this.onlineInterval);
            this.onlineInterval = null;
        }
        
        // 🔧 FIX 2: Remover sessão específica do usuário
        localStorage.removeItem('porter_session');
        localStorage.removeItem(`porter_session_${this.currentUser.user}`);
        
        // 🔧 FIX 3: Remover do registro de online no Firebase
        this.removeFromOnlineUsers();
    },

    // 🔧 FIX 3: Nova função para remover usuário da lista de online
    removeFromOnlineUsers() {
        try {
            // Marcar como offline no Firebase
            if (window.db && this.currentUser) {
                window.db.collection('online_users').doc(this.currentUser.user).update({
                    online: false,
                    lastActivity: new Date().toISOString()
                }).then(() => {
                    console.log('✅ Usuário marcado como offline no Firebase');
                }).catch(() => {});
            }
        } catch (e) {
            console.log('Erro ao remover usuário dos online:', e);
        }
    },

    // 🔧 FIX 2: Função de salvar sessão melhorada
    salvarSessao() {
        if (!this.currentUser) return;
        
        const sessionData = {
            ...this.currentUser,
            lastActivity: new Date().toISOString(),
            mood: this.getMoodAtual()
        };
        
        // Salvar sessão principal
        localStorage.setItem('porter_session', JSON.stringify(sessionData));
        
        // 🔧 FIX 3: Sincronizar status online com Firebase
        if (typeof firebaseHelper !== 'undefined' && firebaseHelper.sincronizarStatusOnlineComFirebase) {
            firebaseHelper.sincronizarStatusOnlineComFirebase();
        }
        
        console.log('✅ Sessão salva para:', this.currentUser.nome);
    },

    loadCondos() {
        const sidebarList = document.getElementById('condo-list');
        sidebarList.innerHTML = '';
        
        const ataSelect = document.getElementById('ata-condo');
        const osSelect = document.getElementById('os-condo');
        const filterSelect = document.getElementById('filter-condo');
        const reportSelect = document.getElementById('report-condo');
        
        ataSelect.innerHTML = '<option value="">Selecione um condomínio...</option>';
        osSelect.innerHTML = '<option value="">Selecione um condomínio...</option>';
        filterSelect.innerHTML = '<option value="">Todos os condomínios</option>';
        reportSelect.innerHTML = '<option value="">Todos os condomínios</option>';
        
        DATA.condominios.sort((a,b) => a.n.localeCompare(b.n)).forEach(c => {
            const condoItem = document.createElement('div');
            condoItem.className = 'condo-item';
            condoItem.dataset.condo = c.n;
            condoItem.onclick = () => this.filtrarPorCondominio(c.n);
            condoItem.innerHTML = `
                <div class="condo-name">${c.n}</div>
                <div class="condo-badge" id="badge-${c.n.replace(/\s+/g, '-')}">0</div>
            `;
            sidebarList.appendChild(condoItem);
            
            [ataSelect, osSelect, filterSelect, reportSelect].forEach(select => {
                const opt = document.createElement('option');
                opt.value = c.n;
                opt.textContent = c.n;
                select.appendChild(opt);
            });
        });
    },

    loadFiltros() {
        const filterOperador = document.getElementById('filter-presenca-operador');
        filterOperador.innerHTML = '<option value="">Todos os operadores</option>';
        
        DATA.funcionarios.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(f => {
            let opt = document.createElement('option');
            opt.value = f.nome;
            opt.textContent = f.nome;
            filterOperador.appendChild(opt);
        });
    },

    carregarMoodOptions() {
        const MOOD_OPTIONS = [
            { id: 1, label: "Zangado", color: "#e74c3c", status: "😠 Zangado", description: "Raiva ou tristeza profunda" },
            { id: 2, label: "Triste", color: "#e67e22", status: "😔 Triste", description: "Desânimo ou insatisfação" },
            { id: 3, label: "Neutro", color: "#f1c40f", status: "😐 Neutro", description: "Indiferente ou tédio" },
            { id: 4, label: "Feliz", color: "#2ecc71", status: "🙂 Feliz", description: "Bem-estar e satisfação" },
            { id: 5, label: "Radiante", color: "#27ae60", status: "😄 Radiante", description: "Felicidade plena e euforia" }
        ];
        
        const container = document.getElementById('mood-options');
        container.innerHTML = '';
        
        MOOD_OPTIONS.forEach(mood => {
            const moodElement = document.createElement('div');
            moodElement.className = 'mood-option';
            moodElement.dataset.id = mood.id;
            moodElement.style.color = mood.color;
            moodElement.onclick = () => this.selecionarMood(mood.id);
            
            let svgContent = '';
            switch(mood.id) {
                case 1: svgContent = `<circle cx="18" cy="18" r="3" fill="${mood.color}" /><circle cx="32" cy="18" r="3" fill="${mood.color}" /><path d="M15 35 Q25 25 35 35" stroke="${mood.color}" stroke-width="3" fill="none" />`; break;
                case 2: svgContent = `<circle cx="18" cy="18" r="3" fill="${mood.color}" /><circle cx="32" cy="18" r="3" fill="${mood.color}" /><path d="M15 32 Q25 28 35 32" stroke="${mood.color}" stroke-width="3" fill="none" />`; break;
                case 3: svgContent = `<circle cx="18" cy="18" r="3" fill="${mood.color}" /><circle cx="32" cy="18" r="3" fill="${mood.color}" /><line x1="15" y1="30" x2="35" y2="30" stroke="${mood.color}" stroke-width="3" />`; break;
                case 4: svgContent = `<circle cx="18" cy="18" r="3" fill="${mood.color}" /><circle cx="32" cy="18" r="3" fill="${mood.color}" /><path d="M15 28 Q25 33 35 28" stroke="${mood.color}" stroke-width="3" fill="none" />`; break;
                case 5: svgContent = `<circle cx="18" cy="18" r="3" fill="${mood.color}" /><circle cx="32" cy="18" r="3" fill="${mood.color}" /><path d="M12 25 Q25 40 38 25" stroke="${mood.color}" stroke-width="3" fill="none" />`; break;
            }
            
            moodElement.innerHTML = `
                <div class="mood-face" style="border-color: ${mood.color}">
                    <svg viewBox="0 0 50 50">${svgContent}</svg>
                </div>
                <div class="mood-label">${mood.label}</div>
                <div class="mood-description">${mood.description}</div>
            `;
            
            container.appendChild(moodElement);
        });
    },

    selecionarMood(moodId) {
        const MOOD_OPTIONS = [
            { id: 1, status: "😠 Zangado" },
            { id: 2, status: "😔 Triste" },
            { id: 3, status: "😐 Neutro" },
            { id: 4, status: "🙂 Feliz" },
            { id: 5, status: "😄 Radiante" }
        ];
        
        this.selectedMood = MOOD_OPTIONS.find(m => m.id === moodId);
        
        document.querySelectorAll('.mood-option').forEach(el => {
            el.classList.remove('selected');
        });
        
        document.querySelector(`.mood-option[data-id="${moodId}"]`).classList.add('selected');
        
        document.getElementById('mood-status').innerHTML = `
            <i class="fas fa-check-circle" style="color: ${document.querySelector(`.mood-option[data-id="${moodId}"]`).style.color}"></i>
            <span>Selecionado: <strong>${this.selectedMood.status}</strong></span>
        `;
        
        document.getElementById('mood-submit-btn').disabled = false;
    },

    enviarMood() {
        if (!this.selectedMood || !this.currentUser) return;
        
        const hoje = new Date();
        const dataISO = hoje.toISOString().split('T')[0];
        
        let moods = JSON.parse(localStorage.getItem('porter_moods') || '[]');
        const indexExistente = moods.findIndex(m => m.user === this.currentUser.user && m.dataISO === dataISO);
        
        const moodData = {
            user: this.currentUser.user,
            nome: this.currentUser.nome,
            moodStatus: this.selectedMood.status,
            data: hoje.toLocaleDateString('pt-BR'),
            dataISO: dataISO,
            hora: hoje.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            turno: this.currentUser.turno,
            timestamp: hoje.toISOString()
        };
        
        if (indexExistente !== -1) {
            moods[indexExistente] = moodData;
        } else {
            moods.unshift(moodData);
        }
        
        if (moods.length > 500) moods = moods.slice(0, 500);
        localStorage.setItem('porter_moods', JSON.stringify(moods));
        
        const resultDiv = document.getElementById('mood-result');
        resultDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <strong>Sentimento registrado com sucesso!</strong>
            <span>${this.selectedMood.status}</span>
        `;
        resultDiv.classList.remove('hidden');
        
        document.getElementById('mood-submit-btn').disabled = true;
        
        // Atualizar lista de online
        this.updateOnlineUsers();
        
        // Atualizar a área do usuário
        this.updateUserInfo();
        
        setTimeout(() => {
            resultDiv.classList.add('hidden');
            this.verificarMoodHoje();
        }, 5000);
    },

    verificarMoodHoje() {
        if (!this.currentUser) return;
        
        const hojeISO = new Date().toISOString().split('T')[0];
        const moods = JSON.parse(localStorage.getItem('porter_moods') || '[]');
        const jaAvaliouHoje = moods.some(m => m.user === this.currentUser.user && m.dataISO === hojeISO);
        
        if (jaAvaliouHoje) {
            setTimeout(() => {
                const moodContainer = document.getElementById('mood-check-container');
                moodContainer.classList.add('hidden');
            }, 2000);
        }
    },

    getMoodAtual() {
        if (!this.currentUser) return '😐';
        
        const hojeISO = new Date().toISOString().split('T')[0];
        const moods = JSON.parse(localStorage.getItem('porter_moods') || '[]');
        const moodHoje = moods.find(m => m.user === this.currentUser.user && m.dataISO === hojeISO);
        
        return moodHoje ? moodHoje.moodStatus.split(' ')[0] : '😐';
    },

    updateCity() {
        const condoName = document.getElementById('ata-condo').value;
        const condo = DATA.condominios.find(c => c.n === condoName);
        document.getElementById('ata-cidade').value = condo ? condo.c : "";
    },

    updateCityOS() {
        const condoName = document.getElementById('os-condo').value;
        const condo = DATA.condominios.find(c => c.n === condoName);
        document.getElementById('os-cidade').value = condo ? condo.c : "";
    },

    login() {
        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value;
        const t = document.getElementById('login-turno').value;
        
        const user = DATA.funcionarios.find(f => f.user === u && f.pass === p);
        
        if (user) {
            this.currentUser = {
                ...user,
                turno: t,
                loginTime: new Date().toLocaleString('pt-BR'),
                loginTimestamp: new Date().toISOString(),
                loginDate: new Date().toLocaleDateString('pt-BR'),
                loginHour: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})
            };
            
            localStorage.setItem('porter_session', JSON.stringify(this.currentUser));
            
            // Registrar login
            let presencas = JSON.parse(localStorage.getItem('porter_presencas') || '[]');
            presencas.unshift({
                nome: user.nome,
                turno: t,
                data: new Date().toLocaleDateString('pt-BR'),
                hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
                timestamp: new Date().toISOString(),
                dataISO: new Date().toISOString().split('T')[0],
                tipo: 'login'
            });
            
            if (presencas.length > 100) presencas = presencas.slice(0, 100);
            localStorage.setItem('porter_presencas', JSON.stringify(presencas));
            
            this.showApp();
            
            // 🔧 FIX 1: Carregar usuários do chat privado
            this.loadPrivateChatUsers();
        } else {
            // 🆕 VERIFICAR SE É TÉCNICO
            const tecnico = DATA.tecnicos.find(t => {
                const nomeTecnico = t.nome.split(' - ')[0].toLowerCase().replace(/\s+/g, '.');
                return u === nomeTecnico && p === "Tecnico@2026";
            });
            
            if (tecnico) {
                this.currentUser = {
                    nome: tecnico.nome,
                    user: tecnico.nome.split(' - ')[0].toLowerCase().replace(/\s+/g, '.'),
                    role: "TÉCNICO",
                    turno: t,
                    loginTime: new Date().toLocaleString('pt-BR'),
                    loginTimestamp: new Date().toISOString(),
                    loginDate: new Date().toLocaleDateString('pt-BR'),
                    loginHour: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})
                };
                
                localStorage.setItem('porter_session', JSON.stringify(this.currentUser));
                
                let presencas = JSON.parse(localStorage.getItem('porter_presencas') || '[]');
                presencas.unshift({
                    nome: tecnico.nome,
                    turno: t,
                    data: new Date().toLocaleDateString('pt-BR'),
                    hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
                    timestamp: new Date().toISOString(),
                    dataISO: new Date().toISOString().split('T')[0],
                    tipo: 'login'
                });
                
                if (presencas.length > 100) presencas = presencas.slice(0, 100);
                localStorage.setItem('porter_presencas', JSON.stringify(presencas));
                
                this.showApp();
                
                // 🔧 FIX 1: Carregar usuários do chat privado
                this.loadPrivateChatUsers();
            } else {
                alert('Credenciais inválidas! Verifique usuário e senha.');
            }
        }
    },

    showApp() {
        // Transição suave
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        
        // MOSTRAR SIDEBAR APÓS LOGIN
        if (window.innerWidth > 1200) {
            document.getElementById('sidebar').style.display = 'block';
        }
        
        this.updateUserInfo();
        this.carregarMoodOptions();
        
        const jaAvaliou = this.jaAvaliouHoje();
        if (!jaAvaliou) {
            document.getElementById('mood-check-container').classList.remove('hidden');
        }
        
        this.renderAll();
        this.updateNotificationBadges();
        this.salvarSessao();
        
        // 🔧 FIX 3: ATUALIZAR OPERADORES ONLINE IMEDIATAMENTE
        this.updateOnlineUsers();
        
        // Se for admin, mostrar controles
        if (this.currentUser.role === 'ADMIN' || this.currentUser.role === 'TÉCNICO') {
            document.getElementById('admin-controls').style.display = 'flex';
        }
        
        // Iniciar chat
        this.loadChat();
        this.chatInterval = setInterval(() => this.loadChat(), 5000);
        
        // 🔧 FIX 1: Iniciar chat privado com usuários carregados
        this.loadPrivateChatUsers();
        this.privateChatInterval = setInterval(() => {
            if (this.currentPrivateChatTarget) {
                this.loadPrivateChat();
            }
        }, 5000);
        
        // 🔧 FIX 3: Iniciar tracking de online melhorado
        this.setupOnlineTracking();
        
        // 🆕 Inicializar visto por
        this.registrarVisualizacaoChat();
        
        // Auto-preenche campos do funcionário na OS se estiver logado
        if (this.currentUser) {
            document.getElementById('os-funcionario').value = this.currentUser.nome;
            document.getElementById('os-email').value = `${this.currentUser.user}@porter.com.br`;
        }
    },

    updateUserInfo() {
        const userInfo = document.getElementById('user-info');
        if (this.currentUser) {
            const moodAtual = this.getMoodAtual();
            userInfo.innerHTML = `
                <div class="user-info-name">
                    <span style="font-size: 1.2rem; margin-right: 5px;">${moodAtual}</span>
                    <strong>${this.currentUser.nome.split(' ')[0]}</strong>
                    ${this.currentUser.role === 'TÉCNICO' ? '<span style="background: #f39c12; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px;">TÉCNICO</span>' : ''}
                </div>
                <div class="user-info-time">
                    <i class="far fa-calendar"></i> ${this.currentUser.loginDate}
                    <i class="far fa-clock"></i> ${this.currentUser.loginHour}
                </div>
                <div class="user-info-role">
                    ${this.currentUser.turno} | ${this.currentUser.role}
                </div>
            `;
        }
    },

    jaAvaliouHoje() {
        if (!this.currentUser) return true;
        
        const hojeISO = new Date().toISOString().split('T')[0];
        const moods = JSON.parse(localStorage.getItem('porter_moods') || '[]');
        return moods.some(m => m.user === this.currentUser.user && m.dataISO === hojeISO);
    },

    logout() {
        if (confirm('Deseja realmente sair do sistema?')) {
            this.registrarLogoff();
            
            // Limpar intervalos primeiro
            if (this.chatInterval) {
                clearInterval(this.chatInterval);
                this.chatInterval = null;
            }
            
            if (this.privateChatInterval) {
                clearInterval(this.privateChatInterval);
                this.privateChatInterval = null;
            }
            
            if (this.moodInterval) {
                clearInterval(this.moodInterval);
                this.moodInterval = null;
            }
            
            if (this.onlineInterval) {
                clearInterval(this.onlineInterval);
                this.onlineInterval = null;
            }
            
            // 🔧 FIX 2: Limpar todas as sessões relacionadas
            localStorage.removeItem('porter_session');
            if (this.currentUser) {
                localStorage.removeItem(`porter_session_${this.currentUser.user}`);
            }
            
            this.currentUser = null;
            
            // Esconder aplicação
            document.getElementById('main-content').classList.add('hidden');
            
            // Mostrar login com transição suave
            document.getElementById('login-screen').classList.remove('hidden');
            
            // Resetar formulário de login
            document.getElementById('login-user').value = '';
            document.getElementById('login-pass').value = '';
            
            this.showMessage('Logoff realizado com sucesso!', 'success');
        }
    },

    switchTab(tabId, btn) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(tabId).classList.remove('hidden');
        btn.classList.add('active');
        
        // Se for a aba de chat, carregar mensagens e marcar como visualizado
        if (tabId === 'tab-chat') {
            this.loadChat();
            this.marcarChatComoVisualizado();
        }
        
        // 🔧 FIX 1: Se for a aba de chat privado, carregar usuários
        if (tabId === 'tab-chat-privado') {
            this.loadPrivateChatUsers();
        }
    },

    updateTabCounts() {
        const atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
        const fixas = atas.filter(a => a.tipo && a.tipo.includes('Informações Fixas'));
        const os = JSON.parse(localStorage.getItem('porter_os') || '[]');
        
        document.getElementById('tab-count-ata').textContent = atas.length;
        document.getElementById('tab-count-fixas').textContent = fixas.length;
        document.getElementById('tab-count-os').textContent = os.length;
        
        // 🆕 Usar função atualizarBadgeChat
        this.atualizarBadgeChat();
        
        // 🔧 FIX 1: Atualizar badge do chat privado
        this.atualizarBadgeChatPrivado();
    },

    atualizarBadgeChat() {
        const chat = JSON.parse(localStorage.getItem('porter_chat') || '[]');
        const ultimaVisualizacao = localStorage.getItem('porter_chat_last_view') || '0';
        const ultimaVisualizacaoTime = parseInt(ultimaVisualizacao);
        
        const mensagensNaoVisualizadas = chat.filter(msg => {
            if (!msg.timestamp) return false;
            const msgTime = new Date(msg.timestamp).getTime();
            return msgTime > ultimaVisualizacaoTime;
        }).length;
        
        const badge = document.getElementById('chat-badge');
        if (mensagensNaoVisualizadas > 0) {
            badge.textContent = mensagensNaoVisualizadas > 99 ? '99+' : mensagensNaoVisualizadas;
            badge.style.display = 'inline-block';
            
            const chatTab = document.querySelector('.chat-tab');
            if (chatTab) {
                chatTab.classList.add('has-new-message');
            }
        } else {
            badge.textContent = '0';
            badge.style.display = 'none';
            
            const chatTab = document.querySelector('.chat-tab');
            if (chatTab) {
                chatTab.classList.remove('has-new-message');
            }
        }
        
        return mensagensNaoVisualizadas;
    },

    atualizarBadgeChatPrivado() {
        if (!this.currentUser) return 0;
        
        const privateChats = JSON.parse(localStorage.getItem('porter_chat_privado') || '{}');
        let totalNaoVisualizadas = 0;
        
        // Verificar todas as conversas privadas do usuário atual
        Object.keys(privateChats).forEach(chatId => {
            const [user1, user2] = chatId.split('_');
            if (user1 === this.currentUser.user || user2 === this.currentUser.user) {
                const mensagens = privateChats[chatId];
                const ultimaVisualizacaoKey = `porter_chat_privado_last_view_${chatId}`;
                const ultimaVisualizacao = localStorage.getItem(ultimaVisualizacaoKey) || '0';
                const ultimaVisualizacaoTime = parseInt(ultimaVisualizacao);
                
                const mensagensNaoVisualizadas = mensagens.filter(msg => {
                    if (!msg.timestamp) return false;
                    const msgTime = new Date(msg.timestamp).getTime();
                    return msgTime > ultimaVisualizacaoTime && msg.sender !== this.currentUser.user;
                }).length;
                
                totalNaoVisualizadas += mensagensNaoVisualizadas;
            }
        });
        
        const badge = document.getElementById('chat-private-badge');
        if (totalNaoVisualizadas > 0) {
            badge.textContent = totalNaoVisualizadas > 99 ? '99+' : totalNaoVisualizadas;
            badge.style.display = 'inline-block';
        } else {
            badge.textContent = '0';
            badge.style.display = 'none';
        }
        
        return totalNaoVisualizadas;
    },

    marcarChatComoVisualizado() {
        localStorage.setItem('porter_chat_last_view', Date.now().toString());
        this.atualizarBadgeChat();
        this.registrarVisualizacaoChat();
    },

    registrarVisualizacaoChat() {
        if (!this.currentUser) return;
        
        const visualizacoes = JSON.parse(localStorage.getItem('porter_chat_views') || '{}');
        const agora = Date.now();
        
        visualizacoes[this.currentUser.user] = {
            nome: this.currentUser.nome,
            hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            data: new Date().toLocaleDateString('pt-BR'),
            timestamp: agora,
            mood: this.getMoodAtual()
        };
        
        // Limpar visualizações antigas (mais de 1 hora)
        Object.keys(visualizacoes).forEach(user => {
            if (agora - visualizacoes[user].timestamp > 60 * 60 * 1000) {
                delete visualizacoes[user];
            }
        });
        
        localStorage.setItem('porter_chat_views', JSON.stringify(visualizacoes));
    },

    obterVisualizacoesRecentes() {
        const visualizacoes = JSON.parse(localStorage.getItem('porter_chat_views') || '{}');
        const agora = Date.now();
        const cincoMinutos = 5 * 60 * 1000;
        
        const visualizacoesRecentes = Object.entries(visualizacoes)
            .filter(([user, data]) => agora - data.timestamp <= cincoMinutos)
            .map(([user, data]) => ({
                user,
                ...data
            }));
        
        return visualizacoesRecentes;
    },

    aplicarFiltrosAtas() {
        this.filtrosAtas = {
            condo: document.getElementById('filter-condo').value,
            dataInicio: document.getElementById('filter-data-inicio').value,
            dataFim: document.getElementById('filter-data-fim').value,
            tipo: document.getElementById('filter-tipo').value,
            status: document.getElementById('filter-status').value
        };
        
        localStorage.setItem('porter_filtros_atas', JSON.stringify(this.filtrosAtas));
        this.mostrarFiltrosAtivosAtas();
        this.renderAta();
    },

    limparFiltrosAtas() {
        const hoje = new Date();
        const umaSemanaAtras = new Date();
        umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
        
        document.getElementById('filter-condo').value = '';
        document.getElementById('filter-data-inicio').value = umaSemanaAtras.toISOString().split('T')[0];
        document.getElementById('filter-data-fim').value = hoje.toISOString().split('T')[0];
        document.getElementById('filter-tipo').value = '';
        document.getElementById('filter-status').value = '';
        
        this.filtrosAtas = { condo: '', dataInicio: '', dataFim: '', tipo: '', status: '' };
        localStorage.removeItem('porter_filtros_atas');
        
        this.mostrarFiltrosAtivosAtas();
        this.renderAta();
        this.showMessage('Filtros limpos!', 'success');
    },

    filtrarPorCondominio(condoName) {
        document.getElementById('filter-condo').value = condoName;
        this.currentCondoFilter = condoName;
        this.aplicarFiltrosAtas();
        
        // Destacar item na sidebar
        document.querySelectorAll('.condo-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const condoItem = document.querySelector(`.condo-item[data-condo="${condoName}"]`);
        if (condoItem) {
            condoItem.classList.add('active');
        }
        
        // Fechar sidebar em mobile
        if (window.innerWidth <= 1200) {
            this.toggleSidebar();
        }
    },

    aplicarFiltrosPresenca() {
        this.filtrosPresenca = {
            operador: document.getElementById('filter-presenca-operador').value,
            dataInicio: document.getElementById('filter-presenca-inicio').value,
            dataFim: document.getElementById('filter-presenca-fim').value,
            turno: document.getElementById('filter-presenca-turno').value
        };
        
        localStorage.setItem('porter_filtros_presenca', JSON.stringify(this.filtrosPresenca));
        this.renderPresenca();
    },

    limparFiltrosPresenca() {
        const hoje = new Date();
        const umaSemanaAtras = new Date();
        umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
        
        document.getElementById('filter-presenca-operador').value = '';
        document.getElementById('filter-presenca-inicio').value = umaSemanaAtras.toISOString().split('T')[0];
        document.getElementById('filter-presenca-fim').value = hoje.toISOString().split('T')[0];
        document.getElementById('filter-presenca-turno').value = '';
        
        this.filtrosPresenca = { operador: '', dataInicio: '', dataFim: '', turno: '' };
        localStorage.removeItem('porter_filtros_presenca');
        
        this.renderPresenca();
        this.showMessage('Filtros limpos!', 'success');
    },

    carregarFiltrosSalvos() {
        const filtrosAtasSalvos = localStorage.getItem('porter_filtros_atas');
        if (filtrosAtasSalvos) {
            this.filtrosAtas = JSON.parse(filtrosAtasSalvos);
            document.getElementById('filter-condo').value = this.filtrosAtas.condo || '';
            document.getElementById('filter-data-inicio').value = this.filtrosAtas.dataInicio || '';
            document.getElementById('filter-data-fim').value = this.filtrosAtas.dataFim || '';
            document.getElementById('filter-tipo').value = this.filtrosAtas.tipo || '';
            document.getElementById('filter-status').value = this.filtrosAtas.status || '';
        }
        
        const filtrosPresencaSalvos = localStorage.getItem('porter_filtros_presenca');
        if (filtrosPresencaSalvos) {
            this.filtrosPresenca = JSON.parse(filtrosPresencaSalvos);
            document.getElementById('filter-presenca-operador').value = this.filtrosPresenca.operador || '';
            document.getElementById('filter-presenca-inicio').value = this.filtrosPresenca.dataInicio || '';
            document.getElementById('filter-presenca-fim').value = this.filtrosPresenca.dataFim || '';
            document.getElementById('filter-presenca-turno').value = this.filtrosPresenca.turno || '';
        }
    },

    mostrarFiltrosAtivosAtas() {
        const container = document.getElementById('filtros-ativos-ata');
        const filtros = [];
        
        if (this.filtrosAtas.condo) filtros.push(`Condomínio: ${this.filtrosAtas.condo}`);
        if (this.filtrosAtas.dataInicio) filtros.push(`De: ${this.formatarDataBR(this.filtrosAtas.dataInicio)}`);
        if (this.filtrosAtas.dataFim) filtros.push(`Até: ${this.formatarDataBR(this.filtrosAtas.dataFim)}`);
        if (this.filtrosAtas.tipo) filtros.push(`Tipo: ${this.filtrosAtas.tipo}`);
        if (this.filtrosAtas.status) filtros.push(`Status: ${this.filtrosAtas.status}`);
        
        if (filtros.length > 0) {
            container.innerHTML = `<strong>Filtros ativos:</strong> ${filtros.join(' | ')}`;
        } else {
            container.innerHTML = 'Nenhum filtro ativo';
        }
    },

    formatarDataBR(dataISO) {
        if (!dataISO) return '';
        const [ano, mes, dia] = dataISO.split('-');
        return `${dia}/${mes}/${ano}`;
    },

    saveAta() {
        const condo = document.getElementById('ata-condo').value;
        const desc = document.getElementById('ata-desc').value.trim();
        const tipo = document.getElementById('ata-tipo').value;
        
        if (!condo || !desc) {
            alert('Preencha todos os campos obrigatórios! (Condomínio e Descrição)');
            return;
        }
        
        const novaAta = {
            id: Date.now(),
            condo,
            cidade: document.getElementById('ata-cidade').value,
            tipo: tipo,
            status: document.getElementById('ata-status').value,
            desc,
            operador: this.currentUser.nome,
            user: this.currentUser.user,
            turno: this.currentUser.turno,
            data: new Date().toLocaleDateString('pt-BR'),
            dataISO: new Date().toISOString().split('T')[0],
            hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            timestamp: new Date().toISOString(),
            comentarios: [],
            fixa: tipo.includes('Informações Fixas')
        };
        
        let atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
        atas.unshift(novaAta);
        
        if (atas.length > 200) atas = atas.slice(0, 200);
        localStorage.setItem('porter_atas', JSON.stringify(atas));
        
        this.criarNotificacao(condo, tipo, desc);
        
        // Limpar formulário
        document.getElementById('ata-desc').value = "";
        document.getElementById('ata-condo').value = "";
        document.getElementById('ata-cidade').value = "";
        
        this.showMessage('Registro salvo com sucesso!', 'success');
        this.renderAll();
        this.updateNotificationBadges();
    },

    criarNotificacao(condo, tipo, desc) {
        const notificacao = {
            id: Date.now(),
            condo,
            tipo,
            desc: desc.length > 100 ? desc.substring(0, 100) + '...' : desc,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            timestamp: new Date().toISOString(),
            lida: false
        };
        
        let notificacoes = JSON.parse(localStorage.getItem('porter_notificacoes') || '[]');
        notificacoes.unshift(notificacao);
        
        if (notificacoes.length > 50) notificacoes.pop();
        localStorage.setItem('porter_notificacoes', JSON.stringify(notificacoes));
        
        if (tipo === 'Ordem de Serviço') {
            this.criarNotificacaoChat(`Nova OS criada em ${condo}: ${desc.substring(0, 80)}...`);
        }
        
        this.loadNotifications();
    },

    criarNotificacaoChat(texto) {
        let notificacoes = JSON.parse(localStorage.getItem('porter_notificacoes') || '[]');
        const notificacao = {
            id: Date.now(),
            condo: 'Chat Geral',
            tipo: 'chat',
            desc: texto,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            timestamp: new Date().toISOString(),
            lida: false
        };
        
        notificacoes.unshift(notificacao);
        if (notificacoes.length > 50) notificacoes.pop();
        localStorage.setItem('porter_notificacoes', JSON.stringify(notificacoes));
        
        this.loadNotifications();
    },

    criarNotificacaoChatComAcao(chatMessage) {
        const notificacao = {
            id: Date.now(),
            condo: 'Chat Geral',
            tipo: 'chat_mensagem',
            desc: `Nova mensagem de ${chatMessage.sender}: ${chatMessage.message.substring(0, 50)}${chatMessage.message.length > 50 ? '...' : ''}`,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
            timestamp: new Date().toISOString(),
            lida: false,
            acao: {
                tipo: 'ir_para_chat',
                mensagemId: chatMessage.id,
                sender: chatMessage.sender
            },
            destaque: true
        };
        
        let notificacoes = JSON.parse(localStorage.getItem('porter_notificacoes') || '[]');
        notificacoes.unshift(notificacao);
        
        if (notificacoes.length > 50) notificacoes.pop();
        localStorage.setItem('porter_notificacoes', JSON.stringify(notificacoes));
        
        this.loadNotifications();
        this.updateNotificationBadges();
        this.atualizarBadgeChat();
    },

    loadNotifications() {
        const notificacoes = JSON.parse(localStorage.getItem('porter_notificacoes') || '[]');
        this.notifications = notificacoes;
        
        const list = document.getElementById('notifications-list');
        list.innerHTML = '';
        
        if (notificacoes.length === 0) {
            list.innerHTML = `
                <div class="notification-item">
                    <div style="text-align: center; color: var(--gray); padding: 2rem;">
                        <i class="fas fa-bell-slash" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p>Nenhuma notificação</p>
                    </div>
                </div>
            `;
            return;
        }
        
        notificacoes.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${notif.lida ? '' : 'unread'} ${notif.destaque ? 'destaque' : ''}`;
            item.dataset.tipo = notif.tipo;
            item.onclick = (e) => {
                e.stopPropagation();
                this.processarNotificacao(notif);
            };
            
            let icon = '📝';
            if (notif.tipo === 'chat_mensagem') icon = '💬';
            if (notif.tipo.includes('Ocorrência')) icon = '⚠️';
            if (notif.tipo.includes('Incidente')) icon = '🚨';
            if (notif.tipo.includes('Fixas')) icon = '📌';
            if (notif.tipo === 'chat') icon = '💬';
            if (notif.tipo === 'Ordem de Serviço') icon = '🔧';
            
            const acaoRapida = notif.tipo === 'chat_mensagem' ?
                `<button class="btn btn-sm btn-success" style="margin-top: 8px; padding: 4px 10px; font-size: 0.8rem;"
                 onclick="app.irParaChatAgora(event, ${notif.acao?.mensagemId})">
                    <i class="fas fa-comment"></i> Ver no Chat
                </button>` : '';
            
            item.innerHTML = `
                <div class="notification-condo">${icon} ${notif.condo}</div>
                <div style="margin: 5px 0;">${notif.desc}</div>
                <div class="notification-time">${notif.data} ${notif.hora}</div>
                ${acaoRapida}
            `;
            
            list.appendChild(item);
        });
        
        this.updateNotificationBadges();
    },

    processarNotificacao(notificacao) {
        this.marcarNotificacaoComoLida(notificacao.id);
        
        if (notificacao.acao) {
            switch(notificacao.acao.tipo) {
                case 'ir_para_chat':
                    this.irParaChat(notificacao.acao.mensagemId);
                    break;
            }
        }
        
        document.getElementById('notifications-panel').classList.remove('show');
    },

    irParaChat(mensagemId = null) {
        const chatTabBtn = document.querySelector('.chat-tab');
        if (chatTabBtn) {
            this.switchTab('tab-chat', chatTabBtn);
        } else {
            const chatTab = document.querySelector('.tab-btn.chat-tab');
            if (chatTab) {
                this.switchTab('tab-chat', chatTab);
            }
        }
        
        this.loadChat();
        this.marcarChatComoVisualizado();
        
        if (mensagemId) {
            setTimeout(() => {
                this.destacarMensagemChat(mensagemId);
            }, 500);
        }
        
        setTimeout(() => {
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.focus();
            }
        }, 300);
    },

    irParaChatAgora(event, mensagemId) {
        event.stopPropagation();
        event.preventDefault();
        this.irParaChat(mensagemId);
    },

    updateNotificationBadges() {
        const notificacoes = JSON.parse(localStorage.getItem('porter_notificacoes') || '[]');
        const naoLidas = notificacoes.filter(n => !n.lida).length;
        
        const badge = document.getElementById('notification-count');
        if (naoLidas > 0) {
            badge.textContent = naoLidas > 99 ? '99+' : naoLidas;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
        
        DATA.condominios.forEach(condo => {
            const condoNotificacoes = notificacoes.filter(n => n.condo === condo.n && !n.lida);
            const condoBadge = document.getElementById(`badge-${condo.n.replace(/\s+/g, '-')}`);
            
            if (condoBadge) {
                if (condoNotificacoes.length > 0) {
                    condoBadge.textContent = condoNotificacoes.length > 9 ? '9+' : condoNotificacoes.length;
                    condoBadge.classList.add('has-notification');
                } else {
                    condoBadge.classList.remove('has-notification');
                }
            }
        });
        
        this.updateTabCounts();
    },

    toggleNotifications() {
        const panel = document.getElementById('notifications-panel');
        const estaAberto = panel.classList.contains('show');
        
        if (!estaAberto) {
            this.marcarTodasNotificacoesComoLidas();
        }
        
        panel.classList.toggle('show');
    },

    marcarTodasNotificacoesComoLidas() {
        let notificacoes = JSON.parse(localStorage.getItem('porter_notificacoes') || '[]');
        notificacoes = notificacoes.map(notif => ({ ...notif, lida: true }));
        localStorage.setItem('porter_notificacoes', JSON.stringify(notificacoes));
        
        this.loadNotifications();
        this.updateNotificationBadges();
    },

    marcarNotificacaoComoLida(id) {
        let notificacoes = JSON.parse(localStorage.getItem('porter_notificacoes') || '[]');
        const index = notificacoes.findIndex(n => n.id === id);
        
        if (index !== -1) {
            notificacoes[index].lida = true;
            localStorage.setItem('porter_notificacoes', JSON.stringify(notificacoes));
            this.loadNotifications();
        }
    },

    clearNotifications() {
        localStorage.removeItem('porter_notificacoes');
        this.loadNotifications();
    },

    adicionarComentario(ataId, texto) {
        if (!texto.trim()) return;
        
        let atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
        const index = atas.findIndex(a => a.id === ataId);
        
        if (index !== -1) {
            if (!atas[index].comentarios) atas[index].comentarios = [];
            atas[index].comentarios.unshift({
                id: Date.now(),
                autor: this.currentUser.nome,
                user: this.currentUser.user,
                texto: texto,
                data: new Date().toLocaleDateString('pt-BR'),
                hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
                timestamp: new Date().toISOString()
            });
            
            localStorage.setItem('porter_atas', JSON.stringify(atas));
            this.renderAta();
            this.renderFixas();
            this.showMessage('Comentário adicionado!', 'success');
        }
    },

    // FIX: BOTÃO COMENTAR - FUNCIONANDO CORRETAMENTE
    abrirComentarios(ataId) {
        let atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
        const ata = atas.find(a => a.id === ataId);
        
        if (!ata) return;
        
        const modalContent = document.getElementById('comments-modal-content');
        modalContent.innerHTML = `
            <h4><i class="fas fa-building"></i> ${ata.condo} - ${ata.data} ${ata.hora}</h4>
            <div style="margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid var(--accent);">
                <strong><i class="fas fa-align-left"></i> Descrição:</strong>
                <p style="white-space: pre-wrap; margin-top: 8px; padding: 10px; background: white; border-radius: 6px;">${ata.desc}</p>
            </div>
            <div class="comment-form">
                <h5><i class="fas fa-edit"></i> Adicionar Comentário</h5>
                <textarea
                    id="novo-comentario-texto"
                    placeholder="Digite seu comentário aqui..."
                    rows="4"
                    data-ata-id="${ataId}"
                ></textarea>
                <button class="btn btn-primary" onclick="app.adicionarComentarioModal(${ataId})" style="align-self: flex-end;">
                    <i class="fas fa-paper-plane"></i> Enviar Comentário
                </button>
            </div>
            <div class="comments-title" style="margin-top: 2rem;">
                <i class="fas fa-comments"></i> Comentários (${ata.comentarios ? ata.comentarios.length : 0})
            </div>
            <div class="comment-list" id="modal-comment-list">
                ${ata.comentarios && ata.comentarios.length > 0 ?
                    ata.comentarios.map(c => `
                        <div class="comment-item">
                            <div class="comment-header">
                                <span class="comment-author">
                                    <i class="fas fa-user"></i> ${c.autor}
                                </span>
                                <span class="comment-time">${c.data} ${c.hora}</span>
                            </div>
                            <div class="comment-text">${c.texto}</div>
                        </div>
                    `).join('') :
                    '<p style="text-align: center; color: var(--gray); padding: 2rem; background: #f8f9fa; border-radius: 8px;">Nenhum comentário ainda. Seja o primeiro a comentar!</p>'
                }
            </div>
        `;
        
        document.getElementById('comments-modal').classList.add('show');
        
        setTimeout(() => {
            const campoTexto = document.getElementById('novo-comentario-texto');
            if (campoTexto) campoTexto.focus();
        }, 300);
    },

    // FIX: BOTÃO COMENTAR - ENVIO DIRETO SEM FECHAR MODAL
    adicionarComentarioModal(ataId) {
        const textoInput = document.getElementById('novo-comentario-texto');
        if (!textoInput) return;
        
        const texto = textoInput.value.trim();
        if (!texto) {
            alert('Por favor, digite um comentário antes de enviar!');
            textoInput.focus();
            return;
        }
        
        this.adicionarComentario(ataId, texto);
        textoInput.value = '';
        
        // Recarregar os comentários no modal sem fechar
        setTimeout(() => {
            this.abrirComentarios(ataId);
        }, 100);
    },

    closeCommentsModal() {
        document.getElementById('comments-modal').classList.remove('show');
    },

    renderFixas() {
        const list = document.getElementById('fixas-lista');
        const atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
        const fixas = atas.filter(a => a.fixa);
        
        if (fixas.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-thumbtack"></i>
                    <h3>Nenhuma informação fixa</h3>
                    <p>Para criar uma informação fixa, selecione "Informações Fixas" no tipo de registro.</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = '';
        
        fixas.forEach(a => {
            const podeExcluir = this.currentUser && (this.currentUser.role === 'ADMIN' || a.user === this.currentUser.user);
            
            const card = document.createElement('div');
            card.className = 'ata-card fixed fade-in';
            card.innerHTML = `
                <div class="ata-header">
                    <span><i class="far fa-calendar"></i> ${a.data} | <i class="far fa-clock"></i> ${a.hora} | <i class="fas fa-user-clock"></i> Turno: ${a.turno}</span>
                    <span class="status-badge status-fixo">
                        <i class="fas fa-thumbtack"></i> FIXA
                    </span>
                </div>
                <div class="ata-condo"><i class="fas fa-building"></i> ${a.condo} (${a.cidade})</div>
                <div class="ata-type fixed"><i class="fas fa-tag"></i> ${a.tipo}</div>
                <div style="white-space: pre-wrap; margin: 15px 0; padding: 15px; background: #fff3cd30; border-radius: 6px; line-height: 1.5;">
                    ${a.desc}
                </div>
                <div style="font-size: 0.85rem; color: #666; border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <i class="fas fa-user-edit"></i> Operador: ${a.operador}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-info" onclick="app.abrirComentarios(${a.id})">
                            <i class="fas fa-comments"></i> Comentários (${a.comentarios ? a.comentarios.length : 0})
                        </button>
                        ${podeExcluir ?
                            `<button class="btn btn-danger" onclick="app.deleteAta(${a.id})">
                                <i class="fas fa-trash"></i> Excluir
                            </button>` :
                            '<span style="font-size: 0.8rem; color: var(--gray);"><i class="fas fa-lock"></i> Apenas autor/Admin</span>'
                        }
                    </div>
                </div>
            `;
            
            list.appendChild(card);
        });
    },

    // 🔧 FIX 1: Função para salvar OS com Firebase
    saveOSComFirebase(osData) {
        // 1. Salvar no localStorage (para backup e uso offline)
        let osList = JSON.parse(localStorage.getItem('porter_os') || '[]');
        osList.unshift(osData);
        
        if (osList.length > 100) osList = osList.slice(0, 100);
        localStorage.setItem('porter_os', JSON.stringify(osList));
        
        // 2. Salvar no Firebase (para compartilhamento entre máquinas)
        if (typeof firebaseHelper !== 'undefined' && firebaseHelper.salvarOSNoFirebase) {
            firebaseHelper.salvarOSNoFirebase(osData)
                .then(sucesso => {
                    if (sucesso) {
                        console.log('✅ OS salva no Firebase com sucesso');
                    } else {
                        console.log('⚠️ OS salva apenas localmente (Firebase indisponível)');
                    }
                });
        }
        
        return osData;
    },

    // 🆕 FUNÇÃO PRINCIPAL DE ENVIO DE OS COM E-MAIL (ATUALIZADA)
    abrirOSComEmail(event) {
        // Prevenir envio padrão do formulário
        if (event) event.preventDefault();
        
        // Validar campos obrigatórios
        const condo = document.getElementById('os-condo').value;
        const funcionario = document.getElementById('os-funcionario').value.trim();
        const email = document.getElementById('os-email').value.trim();
        const setor = document.getElementById('os-setor').value;
        const gravidade = document.getElementById('os-gravidade').value;
        const desc = document.getElementById('os-desc').value.trim();
        
        if (!condo || !funcionario || !email || !setor || !gravidade || !desc) {
            alert('Por favor, preencha todos os campos obrigatórios marcados com *');
            return;
        }
        
        // Validar e-mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Por favor, insira um e-mail válido');
            document.getElementById('os-email').focus();
            return;
        }
        
        // Gerar ID da OS
        const osId = 'OS-' + Date.now().toString().slice(-6);
        this.lastOSId = osId;
        
        // Obter data e hora atual
        const agora = new Date();
        const dataHora = agora.toLocaleString('pt-BR');
        const dataISO = agora.toISOString().split('T')[0];
        const hora = agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
        
        // Criar objeto da OS para salvar no sistema
        const novaOS = {
            id: Date.now(),
            osId: osId,
            condo,
            cidade: document.getElementById('os-cidade').value,
            gravidade,
            desc,
            dataOS: document.getElementById('os-data').value || dataISO,
            data: agora.toLocaleDateString('pt-BR'),
            dataISO: dataISO,
            hora: hora,
            funcionario: funcionario,
            email: email,
            setor: setor,
            operador: this.currentUser ? this.currentUser.nome : funcionario,
            user: this.currentUser ? this.currentUser.user : 'anonimo',
            turno: this.currentUser ? this.currentUser.turno : 'Não informado',
            status: 'Em branco', // 🆕 STATUS PADRÃO
            statusOS: 'Em branco', // 🆕 STATUS ESPECÍFICO DA OS
            timestamp: agora.toISOString(),
            prazoResposta: appEmail ? appEmail.calcularPrazoPorGravidade(gravidade) : '3 dias úteis',
            corGravidade: appEmail ? appEmail.getCorGravidade(gravidade) : '#666',
            enviadoPorEmail: true,
            dataEnvioEmail: agora.toISOString(),
            tecnicoResponsavel: document.getElementById('os-tecnico').value || '' // 🆕 TÉCNICO RESPONSÁVEL
        };
        
        // 🔧 FIX 1: Usar nova função para salvar com Firebase
        this.saveOSComFirebase(novaOS);
        
        // Atualizar contagem de OS
        this.updateTabCounts();
        
        // Adicionar campos ocultos com informações adicionais
        if (typeof appEmail !== 'undefined' && appEmail.adicionarCamposOcultosForm) {
            appEmail.adicionarCamposOcultosForm(osId, dataHora, novaOS.prazoResposta);
        }
        
        // Mostrar mensagem de processamento
        this.showMessage('Enviando Ordem de Serviço...', 'info');
        
        // Submeter o formulário para o FormSubmit
        setTimeout(() => {
            // Submeter formulário
            const form = document.getElementById('os-form-email');
            form.submit();
            
            // Mostrar tela de confirmação
            if (typeof appEmail !== 'undefined' && appEmail.mostrarConfirmacaoOS) {
                appEmail.mostrarConfirmacaoOS(novaOS);
            } else {
                this.mostrarConfirmacaoOSFallback(novaOS);
            }
            
            // Criar notificação
            this.criarNotificacao(condo, 'Ordem de Serviço', `Nova OS ${osId}: ${gravidade} - ${desc.substring(0, 50)}...`);
            
            this.showMessage('Ordem de Serviço aberta com sucesso!', 'success');
        }, 100);
    },

    mostrarConfirmacaoOSFallback(osData) {
        // Ocultar formulário
        document.getElementById('os-form-container').classList.add('hidden');
        
        // Mostrar tela de confirmação
        const confirmationScreen = document.getElementById('os-confirmation-screen');
        confirmationScreen.classList.remove('hidden');
        
        // Preencher dados na tela de confirmação
        document.getElementById('os-confirmation-id').textContent = osData.osId;
        document.getElementById('os-confirmation-condo').textContent = osData.condo;
        document.getElementById('os-confirmation-gravidade').textContent = osData.gravidade;
        document.getElementById('os-confirmation-funcionario').textContent = osData.funcionario;
        document.getElementById('os-confirmation-email').textContent = osData.email;
        document.getElementById('os-confirmation-data').textContent = `${osData.data} ${osData.hora}`;
    },

    filtrarOSTodas() {
        this.renderOS();
    },

    filtrarOSGravidade(gravidade) {
        const osList = JSON.parse(localStorage.getItem('porter_os') || '[]');
        const filtradas = osList.filter(os => os.gravidade === gravidade);
        this.renderOSList(filtradas, `Filtradas por gravidade: ${gravidade}`);
    },

    // 🆕 FUNÇÃO PARA ATUALIZAR STATUS DA OS
    atualizarStatusOS(osId, novoStatus) {
        let osList = JSON.parse(localStorage.getItem('porter_os') || '[]');
        const index = osList.findIndex(os => os.id === osId);
        
        if (index !== -1) {
            osList[index].statusOS = novoStatus;
            osList[index].status = novoStatus; // Mantém compatibilidade
            osList[index].dataAtualizacao = new Date().toISOString();
            osList[index].atualizadoPor = this.currentUser.nome;
            
            localStorage.setItem('porter_os', JSON.stringify(osList));
            
            // 🔧 FIX 1: Atualizar também no Firebase
            if (typeof firebaseHelper !== 'undefined' && firebaseHelper.salvarOSNoFirebase) {
                firebaseHelper.salvarOSNoFirebase(osList[index]);
            }
            
            this.renderOS();
            this.showMessage('Status atualizado com sucesso!', 'success');
        }
    },

    // 🆕 FUNÇÃO PARA EXCLUIR OS (APENAS TÉCNICO)
    excluirOS(osId) {
        if (this.currentUser.role !== 'TÉCNICO') {
            alert('Apenas técnicos podem excluir Ordens de Serviço.');
            return;
        }
        
        if (!confirm('Tem certeza que deseja excluir esta Ordem de Serviço?')) {
            return;
        }
        
        let osList = JSON.parse(localStorage.getItem('porter_os') || '[]');
        const osIndex = osList.findIndex(os => os.id === osId);
        
        if (osIndex !== -1) {
            // Registrar exclusão
            let exclusoes = JSON.parse(localStorage.getItem('porter_exclusoes_os') || '[]');
            exclusoes.unshift({
                osId: osList[osIndex].osId,
                condo: osList[osIndex].condo,
                excluidoPor: this.currentUser.nome,
                data: new Date().toLocaleDateString('pt-BR'),
                hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
                timestamp: new Date().toISOString()
            });
            
            localStorage.setItem('porter_exclusoes_os', JSON.stringify(exclusoes));
            
            // Remover OS do localStorage
            osList.splice(osIndex, 1);
            localStorage.setItem('porter_os', JSON.stringify(osList));
            
            // 🔧 FIX 1: Remover também do Firebase se possível
            if (window.db) {
                window.db.collection('ordens_servico').doc(osId.toString()).delete()
                    .then(() => {
                        console.log('✅ OS removida do Firebase');
                    })
                    .catch(error => {
                        console.error('❌ Erro ao remover OS do Firebase:', error);
                    });
            }
            
            this.renderOS();
            this.showMessage('Ordem de Serviço excluída com sucesso!', 'success');
        }
    },

    renderOSList(osList, titulo = '') {
        const list = document.getElementById('os-lista');
        
        if (osList.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tools"></i>
                    <h3>${titulo ? titulo : 'Nenhuma Ordem de Serviço'}</h3>
                    <p>${titulo ? 'Nenhuma OS encontrada com este filtro.' : 'Use o formulário acima para criar uma nova OS.'}</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = '';
        
        osList.forEach(os => {
            const podeExcluir = this.currentUser && (this.currentUser.role === 'TÉCNICO');
            const podeMudarStatus = this.currentUser && (
                this.currentUser.role === 'TÉCNICO' || 
                (this.currentUser.role === 'OPERADOR' && os.statusOS === 'Técnico compareceu ao local')
            );
            
            // 🆕 BOTÕES DE STATUS BASEADOS NO PERFIL
            const botoesStatus = this.gerarBotoesStatusOS(os, podeMudarStatus);
            
            const card = document.createElement('div');
            card.className = 'ata-card os fade-in';
            card.innerHTML = `
                <div class="ata-header">
                    <span><i class="far fa-calendar"></i> ${os.data} | <i class="far fa-clock"></i> ${os.hora}</span>
                    <span class="status-badge status-os" style="background: ${os.corGravidade || '#d6eaf8'};">
                        <i class="fas ${appEmail ? appEmail.getIconeGravidade(os.gravidade) : 'fa-circle'}"></i> ${os.gravidade}
                    </span>
                </div>
                <div class="ata-condo"><i class="fas fa-building"></i> ${os.condo} (${os.cidade})</div>
                <div class="ata-type os">
                    <i class="fas fa-business-time"></i> Prazo: ${os.prazoResposta || '3 dias úteis'}
                </div>
                ${os.tecnicoResponsavel ? `
                    <div style="margin: 10px 0; padding: 10px; background: #fff3cd; border-radius: 6px;
                        border-left: 4px solid #f39c12;">
                        <i class="fas fa-user-cog"></i> <strong>Técnico responsável:</strong>
                        ${os.tecnicoResponsavel}
                    </div>
                ` : ''}
                <div style="margin: 10px 0; padding: 8px 15px; background: ${os.corGravidade}20;
                    border-left: 4px solid ${os.corGravidade}; border-radius: 6px;">
                    <strong><i class="fas fa-${appEmail ? appEmail.getIconeGravidade(os.gravidade) : 'circle'}"></i>
                    GRAVIDADE: ${os.gravidade.toUpperCase()}</strong>
                    <div style="font-size: 0.85rem; margin-top: 5px;">
                        <i class="far fa-clock"></i> Prazo máximo: ${os.prazoResposta}
                    </div>
                </div>
                ${os.funcionario ? `
                    <div style="margin: 10px 0; padding: 10px; background: #e8f4fc; border-radius: 6px;
                        border-left: 4px solid #3498db;">
                        <i class="fas fa-user"></i> <strong>Solicitante:</strong>
                        ${os.funcionario} (${os.setor || 'Não informado'})<br>
                        <i class="fas fa-envelope"></i> <strong>E-mail:</strong> ${os.email || 'Não informado'}
                    </div>
                ` : ''}
                ${os.enviadoPorEmail ? `
                    <div style="margin: 10px 0; padding: 8px 15px; background: #d4edda; border-radius: 6px;
                        border-left: 4px solid #27ae60;">
                        <i class="fas fa-paper-plane"></i> <strong>Enviado por e-mail</strong>
                        <div style="font-size: 0.85rem; margin-top: 5px;">
                            <i class="far fa-clock"></i> ${new Date(os.dataEnvioEmail).toLocaleString('pt-BR')}
                        </div>
                    </div>
                ` : ''}
                <!-- 🆕 STATUS DA OS -->
                <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong><i class="fas fa-flag"></i> Status da OS:</strong>
                        <span class="os-status-badge ${this.getClasseStatusOS(os.statusOS)}">
                            ${this.getIconeStatusOS(os.statusOS)} ${os.statusOS || 'Em branco'}
                        </span>
                    </div>
                    ${os.atualizadoPor ? `
                        <div style="font-size: 0.85rem; color: #666;">
                            <i class="fas fa-user-edit"></i> Atualizado por: ${os.atualizadoPor}
                            ${os.dataAtualizacao ? ` em ${new Date(os.dataAtualizacao).toLocaleString('pt-BR')}` : ''}
                        </div>
                    ` : ''}
                    <!-- 🆕 BOTÕES DE AÇÃO -->
                    <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px;">
                        ${botoesStatus}
                    </div>
                </div>
                <div style="white-space: pre-wrap; margin: 15px 0; padding: 15px; background: #d6eaf820; border-radius: 6px; line-height: 1.5;">
                    ${os.desc}
                </div>
                <div style="font-size: 0.85rem; color: #666; border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <i class="fas fa-user-edit"></i> Operador: ${os.operador}
                        ${os.osId ? `<br><i class="fas fa-hashtag"></i> OS: ${os.osId}` : ''}
                    </div>
                    ${podeExcluir ?
                        `<button class="btn btn-danger" onclick="app.excluirOS(${os.id})" title="Apenas técnicos podem excluir">
                            <i class="fas fa-trash"></i> Excluir
                        </button>` :
                        ''
                    }
                </div>
            `;
            
            list.appendChild(card);
        });
    },

    // 🆕 FUNÇÃO PARA GERAR BOTÕES DE STATUS
    gerarBotoesStatusOS(os, podeMudarStatus) {
        if (!podeMudarStatus) return '';
        
        const statusOptions = [
            { value: 'Resolvida', label: '✅ Resolvida', class: 'tec-only', icon: 'fa-check-circle' },
            { value: 'Técnico resolveu remotamente', label: '🖥️ Remotamente', class: 'tec-only', icon: 'fa-desktop' },
            { value: 'Em espera', label: '⏳ Em espera', class: 'tec-only', icon: 'fa-clock' },
            { value: 'Técnico compareceu ao local', label: '📍 Compareceu', class: 'all', icon: 'fa-map-marker-alt' },
            { value: 'Manutenção por conta do condomínio - em espera', label: '🏢 Condomínio', class: 'tec-only', icon: 'fa-building' },
            { value: 'Em branco', label: '📄 Em branco', class: 'tec-only', icon: 'fa-file' }
        ];
        
        let botoes = '';
        
        statusOptions.forEach(status => {
            // Verificar se o usuário tem permissão
            const podeUsar = status.class === 'all' || 
                           (status.class === 'tec-only' && this.currentUser.role === 'TÉCNICO');
            
            if (podeUsar) {
                const ativo = os.statusOS === status.value ? 'active' : '';
                botoes += `
                    <button class="status-action-btn ${status.class} ${ativo}" 
                            onclick="app.atualizarStatusOS(${os.id}, '${status.value}')"
                            title="${status.value}">
                        <i class="fas ${status.icon}"></i> ${status.label}
                    </button>
                `;
            }
        });
        
        return botoes;
    },

    // 🆕 FUNÇÕES AUXILIARES PARA STATUS
    getClasseStatusOS(status) {
        const classes = {
            'Resolvida': 'os-status-resolvida',
            'Técnico resolveu remotamente': 'os-status-remotamente',
            'Em espera': 'os-status-espera',
            'Técnico compareceu ao local': 'os-status-compareceu',
            'Manutenção por conta do condomínio - em espera': 'os-status-condominio',
            'Em branco': 'os-status-branco'
        };
        return classes[status] || 'os-status-branco';
    },

    getIconeStatusOS(status) {
        const icones = {
            'Resolvida': '✅',
            'Técnico resolveu remotamente': '🖥️',
            'Em espera': '⏳',
            'Técnico compareceu ao local': '📍',
            'Manutenção por conta do condomínio - em espera': '🏢',
            'Em branco': '📄'
        };
        return icones[status] || '📄';
    },

    // 🔧 FIX 1: Função para renderizar OS buscando do Firebase
    renderOS() {
        // Primeiro tentar carregar do Firebase, depois do localStorage como fallback
        const osList = JSON.parse(localStorage.getItem('porter_os') || '[]');
        this.renderOSList(osList);
    },

    deleteOS(id) {
        let osList = JSON.parse(localStorage.getItem('porter_os') || '[]');
        const os = osList.find(o => o.id === id);
        
        if (!os) {
            alert('Ordem de Serviço não encontrada.');
            return;
        }
        
        const ehAutor = os.user === this.currentUser.user;
        const ehAdmin = this.currentUser.role === 'ADMIN';
        const ehTecnico = this.currentUser.role === 'TÉCNICO';
        
        if (!ehAdmin && !ehAutor && !ehTecnico) {
            alert('Apenas o autor, técnicos ou administradores podem excluir esta Ordem de Serviço.');
            return;
        }
        
        if (confirm('Tem certeza que deseja excluir esta Ordem de Serviço?')) {
            osList = osList.filter(os => os.id !== id);
            localStorage.setItem('porter_os', JSON.stringify(osList));
            this.renderOS();
            this.showMessage('Ordem de Serviço excluída!', 'success');
        }
    },

    deleteAta(id) {
        let atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
        const ata = atas.find(a => a.id === id);
        
        if (!ata) {
            alert('Registro não encontrado.');
            return;
        }
        
        const ehAutor = ata.user === this.currentUser.user;
        const ehAdmin = this.currentUser.role === 'ADMIN';
    const ehTecnico = this.currentUser.role === 'TÉCNICO';
        if (!ehAdmin && !ehAutor && !ehTecnico) {
            alert('Apenas o autor, técnicos ou administradores podem excluir este registro.');
            return;
        }
        
        if (confirm('Tem certeza que deseja excluir este registro permanentemente?')) {
            let remocoes = JSON.parse(localStorage.getItem('porter_remocoes') || '[]');
            remocoes.unshift({
                id: Date.now(),
                tipo: ata.fixa ? 'Ata Fixa' : 'Ata',
                dados: ata,
                removidoPor: this.currentUser.nome,
                data: new Date().toLocaleDateString('pt-BR'),
                hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
                timestamp: new Date().toISOString()
            });
            
            localStorage.setItem('porter_remocoes', JSON.stringify(remocoes));
            
            atas = atas.filter(a => a.id !== id);
            localStorage.setItem('porter_atas', JSON.stringify(atas));
            
            this.renderAll();
            this.showMessage('Registro excluído com sucesso!', 'success');
        }
    },

    openReportModal() {
        document.getElementById('report-modal').classList.add('show');
    },

    closeReportModal() {
        document.getElementById('report-modal').classList.remove('show');
    },

    openAdminPanel() {
        const modalContent = document.getElementById('admin-modal-content');
        const sessions = JSON.parse(localStorage.getItem('porter_last_session') ? 
            [JSON.parse(localStorage.getItem('porter_last_session'))] : []);
        
        const operadoresLogados = DATA.funcionarios.filter(f => 
            sessions.some(s => s.user === f.user &&
                (new Date() - new Date(s.lastActivity)) < 300000));
        
        // 🆕 ADICIONAR TÉCNICOS LOGADOS
        const tecnicosLogados = DATA.tecnicos.filter(t => {
            const tecUser = t.nome.split(' - ')[0].toLowerCase().replace(/\s+/g, '.');
            return sessions.some(s => s.user === tecUser &&
                (new Date() - new Date(s.lastActivity)) < 300000);
        });
        
        const todosLogados = [...operadoresLogados, ...tecnicosLogados.map(t => ({
            nome: t.nome,
            user: t.nome.split(' - ')[0].toLowerCase().replace(/\s+/g, '.'),
            role: 'TÉCNICO'
        }))];
        
        modalContent.innerHTML = `
            <h4><i class="fas fa-users"></i> Operadores Logados</h4>
            <div style="margin: 1rem 0; max-height: 200px; overflow-y: auto;">
                ${todosLogados.length > 0 ?
                    todosLogados.map(op => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                            <div>
                                <strong>${op.nome}</strong>
                                <div style="font-size: 0.8rem; color: #666;">${op.role} ${op.role === 'TÉCNICO' ? '🔧' : ''}</div>
                            </div>
                            <button class="btn btn-danger btn-sm" onclick="app.forceLogoff('${op.user}')">
                                <i class="fas fa-sign-out-alt"></i> Deslogar
                            </button>
                        </div>
                    `).join('') :
                    '<p style="text-align: center; color: #888; padding: 2rem;">Nenhum operador logado</p>'
                }
            </div>
            <h4 style="margin-top: 2rem;"><i class="fas fa-history"></i> Histórico de Remoções</h4>
            <div style="margin: 1rem 0; max-height: 200px; overflow-y: auto;">
                ${this.renderHistoricoRemocoes()}
            </div>
            <!-- 🆕 HISTÓRICO DE EXCLUSÕES DE OS -->
            <h4 style="margin-top: 2rem;"><i class="fas fa-trash"></i> Histórico de Exclusões de OS</h4>
            <div style="margin: 1rem 0; max-height: 200px; overflow-y: auto;">
                ${this.renderHistoricoExclusoesOS()}
            </div>
            <h4 style="margin-top: 2rem;"><i class="fas fa-envelope"></i> Histórico de Envios de E-mail</h4>
            <div style="margin: 1rem 0; max-height: 200px; overflow-y: auto;">
                ${this.renderHistoricoEmails()}
            </div>
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee;">
                <button class="btn btn-warning" onclick="app.exportBackup()">
                    <i class="fas fa-download"></i> Exportar Backup
                </button>
                <button class="btn btn-danger" onclick="app.clearAllData()" style="margin-left: 10px;">
                    <i class="fas fa-trash"></i> Limpar Todos os Dados
                </button>
            </div>
        `;
        
        document.getElementById('admin-modal').classList.add('show');
    },

    // 🆕 FUNÇÃO PARA RENDERIZAR HISTÓRICO DE EXCLUSÕES DE OS
    renderHistoricoExclusoesOS() {
        const exclusoes = JSON.parse(localStorage.getItem('porter_exclusoes_os') || '[]');
        
        if (exclusoes.length === 0) {
            return '<p style="text-align: center; color: #888; padding: 1rem;">Nenhuma exclusão de OS registrada</p>';
        }
        
        return exclusoes.slice(0, 10).map(e => `
            <div style="padding: 8px; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; background: #f8d7da;">
                <div><strong>OS ${e.osId}</strong> - ${e.condo || 'N/A'}</div>
                <div style="color: #666;">Excluído por: ${e.excluidoPor} | ${e.data} ${e.hora}</div>
            </div>
        `).join('');
    },

    closeAdminModal() {
        document.getElementById('admin-modal').classList.remove('show');
    },

    renderHistoricoRemocoes() {
        const remocoes = JSON.parse(localStorage.getItem('porter_remocoes') || '[]');
        
        if (remocoes.length === 0) {
            return '<p style="text-align: center; color: #888; padding: 1rem;">Nenhuma remoção registrada</p>';
        }
        
        return remocoes.slice(0, 10).map(r => `
            <div style="padding: 8px; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem;">
                <div><strong>${r.tipo}</strong> - ${r.dados.condo || 'N/A'}</div>
                <div style="color: #666;">Removido por: ${r.removidoPor} | ${r.data} ${r.hora}</div>
            </div>
        `).join('');
    },

    renderHistoricoEmails() {
        const historico = JSON.parse(localStorage.getItem('porter_os_emails') || '[]');
        
        if (historico.length === 0) {
            return '<p style="text-align: center; color: #888; padding: 1rem;">Nenhum envio de e-mail registrado</p>';
        }
        
        return historico.slice(0, 10).map(r => `
            <div style="padding: 8px; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem;
                background: ${r.sucesso ? '#d4edda' : '#f8d7da'}">
                <div>
                    <strong>${r.condo}</strong> - ${r.gravidade}
                    <span style="float: right; color: ${r.sucesso ? '#155724' : '#721c24'}">
                        <i class="fas fa-${r.sucesso ? 'check-circle' : 'times-circle'}"></i>
                    </span>
                </div>
                <div style="color: #666;">
                    ${r.destinatarios.length} destinatário(s) | ${r.data}
                </div>
                ${r.erro ? `<div style="color: #dc3545; font-size: 0.8em;">Erro: ${r.erro}</div>` : ''}
            </div>
        `).join('');
    },

    forceLogoff(user) {
        if (confirm(`Tem certeza que deseja deslogar este usuário?`)) {
            let usuario = DATA.funcionarios.find(f => f.user === user);
            if (!usuario) {
                // Verificar se é um técnico
                usuario = DATA.tecnicos.find(t => 
                    t.nome.split(' - ')[0].toLowerCase().replace(/\s+/g, '.') === user
                );
                if (usuario) {
                    usuario = {
                        nome: usuario.nome,
                        user: usuario.nome.split(' - ')[0].toLowerCase().replace(/\s+/g, '.'),
                        role: 'TÉCNICO'
                    };
                }
            }
            
            if (usuario) {
                const logoffs = JSON.parse(localStorage.getItem('porter_logoffs') || '[]');
                logoffs.unshift({
                    user: usuario.user,
                    nome: usuario.nome,
                    data: new Date().toLocaleDateString('pt-BR'),
                    hora: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}),
                    timestamp: new Date().toISOString(),
                    turno: 'Forçado',
                    forçado: true,
                    por: this.currentUser.nome
                });
                localStorage.setItem('porter_logoffs', JSON.stringify(logoffs));
            }
            
            localStorage.removeItem('porter_last_session');
            this.showMessage('Usuário deslogado com sucesso!', 'success');
            this.openAdminPanel();
        }
    },

    exportBackup() {
        const backup = {
            atas: JSON.parse(localStorage.getItem('porter_atas') || '[]'),
            os: JSON.parse(localStorage.getItem('porter_os') || '[]'),
            presencas: JSON.parse(localStorage.getItem('porter_presencas') || '[]'),
            logoffs: JSON.parse(localStorage.getItem('porter_logoffs') || '[]'),
            moods: JSON.parse(localStorage.getItem('porter_moods') || '[]'),
            notificacoes: JSON.parse(localStorage.getItem('porter_notificacoes') || '[]'),
            chat: JSON.parse(localStorage.getItem('porter_chat') || '[]'),
            chat_privado: JSON.parse(localStorage.getItem('porter_chat_privado') || '{}'),
            remocoes: JSON.parse(localStorage.getItem('porter_remocoes') || '[]'),
            os_emails: JSON.parse(localStorage.getItem('porter_os_emails') || '[]'),
            exclusoes_os: JSON.parse(localStorage.getItem('porter_exclusoes_os') || '[]'),
            exportDate: new Date().toISOString(),
            exportBy: this.currentUser.nome
        };
        
        const dataStr = JSON.stringify(backup, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `backup-porter-${new Date().toISOString().slice(0, 10)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showMessage('Backup exportado com sucesso!', 'success');
    },

    clearAllData() {
        if (confirm('ATENÇÃO: Esta ação irá APAGAR TODOS os dados do sistema. Tem certeza?')) {
            const dadosParaManter = {
                condominios: DATA.condominios,
                funcionarios: DATA.funcionarios,
                tecnicos: DATA.tecnicos
            };
            
            localStorage.clear();
            
            localStorage.setItem('porter_condominios', JSON.stringify(dadosParaManter.condominios));
            localStorage.setItem('porter_funcionarios', JSON.stringify(dadosParaManter.funcionarios));
            localStorage.setItem('porter_tecnicos', JSON.stringify(dadosParaManter.tecnicos));
            
            location.reload();
        }
    },

    showMessage(text, type) {
        const message = document.createElement('div');
        message.innerHTML = `
            <div style="
                position: fixed; top: 20px; right: 20px;
                padding: 1rem 1.5rem; border-radius: 8px;
                background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
                color: white; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex; align-items: center; gap: 10px; animation: fadeIn 0.3s;
            ">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                ${text}
            </div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 3000);
    },

    renderAll() {
        this.renderAta();
        this.renderFixas();
        this.renderOS();
        this.renderPresenca();
    },

    renderAta() {
        const list = document.getElementById('ata-lista');
        const info = document.getElementById('resultados-info-ata');
        
        let atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
        atas = atas.filter(a => !a.fixa);
        
        if (this.filtrosAtas.condo) {
            atas = atas.filter(a => a.condo === this.filtrosAtas.condo);
        }
        
        if (this.filtrosAtas.dataInicio) {
            atas = atas.filter(a => a.dataISO >= this.filtrosAtas.dataInicio);
        }
        
        if (this.filtrosAtas.dataFim) {
            atas = atas.filter(a => a.dataISO <= this.filtrosAtas.dataFim);
        }
        
        if (this.filtrosAtas.tipo) {
            atas = atas.filter(a => a.tipo === this.filtrosAtas.tipo);
        }
        
        if (this.filtrosAtas.status) {
            atas = atas.filter(a => a.status === this.filtrosAtas.status);
        }
        
        const totalAtas = JSON.parse(localStorage.getItem('porter_atas') || '[]').filter(a => !a.fixa).length;
        
        info.innerHTML = `
            <div class="active-filters">
                <i class="fas fa-chart-bar"></i>
                Mostrando ${atas.length} de ${totalAtas} registros
                ${this.filtrosAtas.condo ? `<span>Condomínio: ${this.filtrosAtas.condo}</span>` : ''}
                ${this.filtrosAtas.dataInicio || this.filtrosAtas.dataFim ? `<span>Período: ${this.formatarDataBR(this.filtrosAtas.dataInicio)} a ${this.formatarDataBR(this.filtrosAtas.dataFim)}</span>` : ''}
                ${this.filtrosAtas.tipo ? `<span>Tipo: ${this.filtrosAtas.tipo}</span>` : ''}
                ${this.filtrosAtas.status ? `<span>Status: ${this.filtrosAtas.status}</span>` : ''}
            </div>
        `;
        
        if (atas.length === 0) {
            list.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h3>Nenhum registro encontrado</h3>
                    <p>${totalAtas === 0 ? 'Comece criando seu primeiro registro.' : 'Nenhum registro corresponde aos filtros aplicados.'}</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = '';
        
        atas.forEach(a => {
            const podeExcluir = this.currentUser && (this.currentUser.role === 'ADMIN' || a.user === this.currentUser.user || this.currentUser.role === 'TÉCNICO');
            
            const card = document.createElement('div');
            card.className = 'ata-card fade-in';
            card.innerHTML = `
                <div class="ata-header">
                    <span><i class="far fa-calendar"></i> ${a.data} | <i class="far fa-clock"></i> ${a.hora} | <i class="fas fa-user-clock"></i> Turno: ${a.turno}</span>
                    <span class="status-badge ${a.status === 'Finalizado' ? 'status-finalizado' : 'status-andamento'}">
                        <i class="fas fa-${a.status === 'Finalizado' ? 'check-circle' : 'sync-alt'}"></i> ${a.status}
                    </span>
                </div>
                <div class="ata-condo"><i class="fas fa-building"></i> ${a.condo} (${a.cidade})</div>
                <div class="ata-type"><i class="fas fa-tag"></i> ${a.tipo}</div>
                <div style="white-space: pre-wrap; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 6px; line-height: 1.5;">
                    ${a.desc}
                </div>
                <div style="font-size: 0.85rem; color: #666; border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <i class="fas fa-user-edit"></i> Operador: ${a.operador}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-info" onclick="app.abrirComentarios(${a.id})">
                            <i class="fas fa-comments"></i> Comentários (${a.comentarios ? a.comentarios.length : 0})
                        </button>
                        ${podeExcluir ?
                            `<button class="btn btn-danger" onclick="app.deleteAta(${a.id})" title="Apenas autor, técnico ou admin pode excluir">
                                <i class="fas fa-trash"></i> Excluir
                            </button>` :
                            ''
                        }
                    </div>
                </div>
            `;
            
            list.appendChild(card);
        });
        
        this.mostrarFiltrosAtivosAtas();
    },

    // 🔧 FIX 1: Função para carregar usuários do chat privado (melhorada)
    loadPrivateChatUsers() {
        if (!this.currentUser) return;
        
        const select = document.getElementById('private-chat-target');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione um operador...</option>';
        
        // 🔧 FIX 2: Buscar usuários online do Firebase
        const onlineData = localStorage.getItem('porter_online_firebase');
        let usuariosDisponiveis = [];
        
        if (onlineData) {
            try {
                const data = JSON.parse(onlineData);
                const dataTime = new Date(data.timestamp);
                const agora = new Date();
                const diferencaSegundos = (agora - dataTime) / 1000;
                
                if (diferencaSegundos < 10) { // Dados recentes do Firebase
                    data.users.forEach(usuario => {
                        // Pular usuário atual
                        if (usuario.user === app.currentUser.user) return;
                        
                        usuariosDisponiveis.push({
                            nome: usuario.nome,
                            user: usuario.user,
                            role: usuario.role,
                            online: true
                        });
                    });
                }
            } catch (e) {
                console.error('Erro ao parsear dados online:', e);
            }
        }
        
        // 🔧 FIX 1: Se não tiver dados do Firebase, usar dados locais como fallback
        if (usuariosDisponiveis.length === 0) {
            // Adicionar funcionários (exceto o usuário atual)
            DATA.funcionarios.forEach(f => {
                if (f.user !== app.currentUser.user) {
                    usuariosDisponiveis.push({
                        nome: f.nome,
                        user: f.user,
                        role: f.role,
                        online: false
                    });
                }
            });
            
            // Adicionar técnicos (exceto o usuário atual)
            DATA.tecnicos.forEach(t => {
                const tecUser = t.nome.split(' - ')[0].toLowerCase().replace(/\s+/g, '.');
                if (tecUser !== app.currentUser.user) {
                    usuariosDisponiveis.push({
                        nome: t.nome,
                        user: tecUser,
                        role: 'TÉCNICO',
                        online: false
                    });
                }
            });
        }
        
        // Ordenar por nome
        usuariosDisponiveis.sort((a, b) => a.nome.localeCompare(b.nome));
        
        // Adicionar opções ao select
        usuariosDisponiveis.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.user;
            
            // Formatar texto da opção
            let texto = usuario.nome;
            if (usuario.role === 'ADMIN') {
                texto += ' 👑';
            } else if (usuario.role === 'TÉCNICO') {
                texto += ' 🔧';
            }
            
            // 🔧 FIX 1: Indicar status online
            if (usuario.online) {
                texto += ' 🟢';
            } else {
                texto += ' ⚫';
            }
            
            option.textContent = texto;
            select.appendChild(option);
        });
        
        console.log('✅ Chat privado: ' + usuariosDisponiveis.length + ' usuários carregados');
    },

    loadPrivateChat() {
        if (!app.currentUser || !app.currentPrivateChatTarget) return;
        
        // Chama a função do sistema de chat
        if (typeof chatSystem !== 'undefined' && chatSystem.loadPrivateChat) {
            chatSystem.loadPrivateChat();
        }
    },

    sendPrivateChatMessage() {
        if (!app.currentUser || !app.currentPrivateChatTarget) {
            alert('Selecione um destinatário primeiro.');
            return;
        }
        
        // Chama a função do sistema de chat
        if (typeof chatSystem !== 'undefined' && chatSystem.sendPrivateChatMessage) {
            chatSystem.sendPrivateChatMessage();
        }
    },

    // 🔧 FIX 1: Função para carregar chat
    loadChat() {
        if (typeof chatSystem !== 'undefined' && chatSystem.loadChat) {
            chatSystem.loadChat();
        }
    },

    // 🔧 FIX 1: Função para enviar mensagem no chat
    sendChatMessage() {
        if (!app.currentUser) {
            alert('Você precisa estar logado para enviar mensagens.');
            return;
        }
        
        if (typeof chatSystem !== 'undefined' && chatSystem.sendChatMessage) {
            chatSystem.sendChatMessage();
        }
    },

    // FIX: HISTÓRICO DE LOGIN/LOGOFF - MOSTRAR JUNTOS
    renderPresenca() {
        const list = document.getElementById('presenca-lista');
        let presencas = JSON.parse(localStorage.getItem('porter_presencas') || '[]');
        let logoffs = JSON.parse(localStorage.getItem('porter_logoffs') || '[]');
        
        // Combinar logins e logoffs
        let historicoCombinado = [];
        
        presencas.forEach(login => {
            const loginDate = login.dataISO || login.data;
            const loginTime = new Date(login.timestamp).getTime();
            
            // Procurar logoff correspondente
            const logoffCorrespondente = logoffs.find(logoff => 
                logoff.user === login.user && 
                (logoff.dataISO || logoff.data) === loginDate &&
                new Date(logoff.timestamp).getTime() > loginTime
            );
            
            historicoCombinado.push({
                nome: login.nome,
                turno: login.turno,
                data: login.data,
                horaLogin: login.hora,
                horaLogoff: logoffCorrespondente ? logoffCorrespondente.hora : '—',
                timestampLogin: login.timestamp,
                timestampLogoff: logoffCorrespondente ? logoffCorrespondente.timestamp : null
            });
        });
        
        // Adicionar logoffs sem login correspondente (se houver)
        logoffs.forEach(logoff => {
            const jaExiste = historicoCombinado.some(item => 
                item.nome === logoff.nome && 
                item.data === logoff.data &&
                item.horaLogoff === logoff.hora
            );
            
            if (!jaExiste) {
                historicoCombinado.push({
                    nome: logoff.nome,
                    turno: logoff.turno || '—',
                    data: logoff.data,
                    horaLogin: '—',
                    horaLogoff: logoff.hora,
                    timestampLogin: null,
                    timestampLogoff: logoff.timestamp
                });
            }
        });
        
        historicoCombinado.sort((a, b) => {
            const timeA = a.timestampLogoff || a.timestampLogin || 0;
            const timeB = b.timestampLogoff || b.timestampLogin || 0;
            return new Date(timeB) - new Date(timeA);
        });
        
        // Aplicar filtros
        if (this.filtrosPresenca.operador) {
            historicoCombinado = historicoCombinado.filter(p => p.nome === this.filtrosPresenca.operador);
        }
        
        if (this.filtrosPresenca.dataInicio) {
            historicoCombinado = historicoCombinado.filter(p => p.data >= this.filtrosPresenca.dataInicio);
        }
        
        if (this.filtrosPresenca.dataFim) {
            historicoCombinado = historicoCombinado.filter(p => p.data <= this.filtrosPresenca.dataFim);
        }
        
        if (this.filtrosPresenca.turno) {
            historicoCombinado = historicoCombinado.filter(p => p.turno === this.filtrosPresenca.turno);
        }
        
        historicoCombinado = historicoCombinado.slice(0, 100);
        
        if (historicoCombinado.length === 0) {
            list.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 3rem; color: #888;">
                        <i class="fas fa-history" style="font-size: 2rem; display: block; margin-bottom: 1rem; color: #ddd;"></i>
                        Nenhum registro de histórico encontrado
                    </td>
                </tr>
            `;
            return;
        }
        
        list.innerHTML = historicoCombinado.map(p => `
            <tr>
                <td><i class="fas fa-user-circle"></i> ${p.nome}</td>
                <td><span style="padding: 4px 10px; background: ${p.turno === 'Diurno' ? '#fff3cd' : '#e8f4fc'}; border-radius: 4px;">${p.turno}</span></td>
                <td>${p.data}</td>
                <td><i class="fas fa-sign-in-alt" style="color: #27ae60;"></i> ${p.horaLogin}</td>
                <td><i class="fas fa-sign-out-alt" style="color: #e74c3c;"></i> ${p.horaLogoff}</td>
            </tr>
        `).join('');
    }
};
