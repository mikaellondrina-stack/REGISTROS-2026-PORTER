// Configuração do Firebase (sua configuração)
const firebaseConfig = {
    apiKey: "AIzaSyDma392hveHDF6NShluBGbmGc3FYxc7ogA",
    authDomain: "porter-ata-2026-v2.firebaseapp.com",
    projectId: "porter-ata-2026-v2",
    storageBucket: "porter-ata-2026-v2.firebasestorage.app",
    messagingSenderId: "474353492973",
    appId: "1:474353492973:web:a0409eeabf13cb201ffde4"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

window.db = firebase.firestore();
window.auth = firebase.auth();

const firebaseHelper = {
    // 🔧 Funções de OS (mantenha essas)
    salvarOSNoFirebase(os) {
        if (!window.db) return Promise.resolve(false);
        
        return window.db.collection('ordens_servico').doc(os.id.toString()).set(os)
            .then(() => {
                console.log('✅ OS salva no Firebase:', os.id);
                return true;
            })
            .catch(error => {
                console.error('❌ Erro ao salvar OS:', error);
                return false;
            });
    },

    configurarOSFirebase() {
        if (!window.db) return;
        
        window.db.collection('ordens_servico')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .onSnapshot(snapshot => {
                const osList = [];
                snapshot.forEach(doc => {
                    osList.push(doc.data());
                });
                
                console.log('📋 OS recebidas do Firebase:', osList.length);
                
                localStorage.setItem('porter_os_firebase', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    data: osList
                }));
                
            }, error => {
                console.error('❌ Erro listener OS:', error);
            });
    },

    // 🔧 Funções de Online (mantenha essas)
    sincronizarStatusOnlineComFirebase() {
        if (!window.db || !app || !app.currentUser) return;
        
        const statusOnline = {
            user: app.currentUser.user,
            nome: app.currentUser.nome,
            role: app.currentUser.role,
            mood: app.getMoodAtual(),
            lastActivity: new Date().toISOString(),
            online: true,
            turno: app.currentUser.turno || 'Diurno'
        };
        
        window.db.collection('online_users').doc(app.currentUser.user).set(statusOnline)
            .then(() => {
                console.log('✅ Status online atualizado');
            })
            .catch(error => {
                console.error('❌ Erro status online:', error);
            });
    },

    configurarMonitoramentoOnlineFirebase() {
        if (!window.db) return;
        
        window.db.collection('online_users')
            .where('online', '==', true)
            .onSnapshot(snapshot => {
                const usuariosOnlineFirebase = [];
                const agora = new Date();
                
                snapshot.forEach(doc => {
                    const usuario = doc.data();
                    const ultimaAtividade = new Date(usuario.lastActivity);
                    const diferencaMinutos = (agora - ultimaAtividade) / (1000 * 60);
                    
                    if (diferencaMinutos < 2) {
                        usuariosOnlineFirebase.push(usuario);
                    } else {
                        window.db.collection('online_users').doc(doc.id).update({
                            online: false
                        }).catch(() => {});
                    }
                });
                
                localStorage.setItem('porter_online_firebase', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    users: usuariosOnlineFirebase
                }));
                
                if (app.currentUser && app.updateOnlineUsers) {
                    app.updateOnlineUsers();
                }
                
                console.log('👥 Usuários online:', usuariosOnlineFirebase.length);
            }, error => {
                console.error('❌ Erro monitoramento online:', error);
            });
    },

    inicializarFirebase() {
        if (!window.db) {
            console.log('⚠️ Firebase não inicializado');
            return;
        }
        
        console.log('✅ Firebase inicializado');
        
        // 🔧 Configurar OS
        this.configurarOSFirebase();
        
        // 🔧 Configurar Online
        this.configurarMonitoramentoOnlineFirebase();
        
        // 🔧 Atualizar status online periodicamente
        setInterval(() => {
            if (app && app.currentUser) {
                this.sincronizarStatusOnlineComFirebase();
            }
        }, 10000);
    }
};

// Inicializar Firebase
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        firebaseHelper.inicializarFirebase();
    });
} else {
    firebaseHelper.inicializarFirebase();
}
