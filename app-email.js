// Sistema de e-mail e envio de OS
const appEmail = {
    setupOSPreview() {
        const gravidadeSelect = document.getElementById('os-gravidade');
        if (gravidadeSelect) {
            gravidadeSelect.addEventListener('change', function() {
                appEmail.atualizarPreviewGravidade(this.value);
            });
            this.atualizarPreviewGravidade(gravidadeSelect.value);
        }
    },

    atualizarPreviewGravidade(gravidade) {
        const previewDiv = document.getElementById('os-preview-prioridade');
        const previewTexto = document.getElementById('os-preview-gravidade');
        const previewIcone = document.getElementById('os-preview-icone');
        const previewPrazo = document.getElementById('os-preview-prazo');
        
        if (!previewDiv) return;
        
        const configs = {
            'Baixa': {
                texto: '🟢 GRAVIDADE BAIXA',
                icone: 'fa-info-circle',
                cor: '#27ae60',
                prazo: 'Prazo: 7 dias úteis'
            },
            'Média': {
                texto: '🟡 GRAVIDADE MÉDIA',
                icone: 'fa-exclamation-circle',
                cor: '#f39c12',
                prazo: 'Prazo: 3 dias úteis'
            },
            'Alta': {
                texto: '🔴 GRAVIDADE ALTA',
                icone: 'fa-exclamation-triangle',
                cor: '#e74c3c',
                prazo: 'Prazo: 24 horas'
            },
            'Emergência': {
                texto: '🚨 EMERGÊNCIA',
                icone: 'fa-bell',
                cor: '#8b0000',
                prazo: 'Prazo: 4 horas - ATENÇÃO MÁXIMA'
            }
        };
        
        const config = configs[gravidade] || configs['Média'];
        
        previewTexto.textContent = config.texto;
        previewTexto.style.color = config.cor;
        previewIcone.innerHTML = `<i class="fas ${config.icone}" style="color: ${config.cor}"></i>`;
        previewPrazo.textContent = config.prazo;
        previewDiv.style.display = 'block';
        previewDiv.style.borderLeft = `4px solid ${config.cor}`;
    },

    calcularPrazoPorGravidade(gravidade) {
        const prazos = {
            'Baixa': '7 dias úteis',
            'Média': '3 dias úteis',
            'Alta': '24 horas',
            'Emergência': '4 horas'
        };
        return prazos[gravidade] || '3 dias úteis';
    },

    getCorGravidade(gravidade) {
        const cores = {
            'Baixa': '#27ae60',
            'Média': '#f39c12',
            'Alta': '#e74c3c',
            'Emergência': '#8b0000'
        };
        return cores[gravidade] || '#666';
    },

    getIconeGravidade(gravidade) {
        const icones = {
            'Baixa': 'fa-info-circle',
            'Média': 'fa-exclamation-circle',
            'Alta': 'fa-exclamation-triangle',
            'Emergência': 'fa-bell'
        };
        return icones[gravidade] || 'fa-circle';
    },

    adicionarCamposOcultosForm(osId, dataHora, prazoResposta) {
        const form = document.getElementById('os-form-email');
        
        // Remover campos ocultos anteriores (se houver)
        ['os-id', 'data-hora', 'prazo-resposta'].forEach(name => {
            const existing = form.querySelector(`input[name="${name}"]`);
            if (existing) existing.remove();
        });
        
        // Adicionar campos ocultos com informações adicionais
        const camposOcultos = [
            { name: 'os-id', value: osId },
            { name: 'data-hora', value: dataHora },
            { name: 'prazo-resposta', value: prazoResposta },
            { name: 'sistema', value: 'Porter OS System' },
            { name: 'prioridade', value: document.getElementById('os-gravidade').value }
        ];
        
        camposOcultos.forEach(campo => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = campo.name;
            input.value = campo.value;
            form.appendChild(input);
        });
    },

    mostrarConfirmacaoOS(osData) {
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
        
        // Registrar envio no histórico
        this.registrarEnvioDetalhadoOS(osData);
    },

    voltarParaFormOS() {
        // Mostrar formulário
        document.getElementById('os-form-container').classList.remove('hidden');
        
        // Ocultar tela de confirmação
        document.getElementById('os-confirmation-screen').classList.add('hidden');
        
        // Limpar formulário
        document.getElementById('os-form-email').reset();
        
        // Restaurar cidade
        if (typeof app !== 'undefined' && app.updateCityOS) {
            app.updateCityOS();
        }
        
        // Auto-preenche campos do funcionário se estiver logado
        if (typeof app !== 'undefined' && app.currentUser) {
            document.getElementById('os-funcionario').value = app.currentUser.nome;
            document.getElementById('os-email').value = `${app.currentUser.user}@porter.com.br`;
        }
    },

    registrarEnvioDetalhadoOS(osData) {
        let historico = JSON.parse(localStorage.getItem('porter_os_emails') || '[]');
        
        const registro = {
            id: Date.now(),
            os_id: osData.id,
            os_number: osData.osId,
            data: new Date().toLocaleString('pt-BR'),
            destinatarios: ['londrina.tecnica1@porter.com.br', 'londrina.tecnicaplantao@porter.com.br', 'londrina.tenicaplantão1@porter.com.br'],
            condo: osData.condo,
            gravidade: osData.gravidade,
            funcionario: osData.funcionario,
            setor: osData.setor,
            email: osData.email,
            assunto: `[NOVA O.S] - ${osData.setor} - ${osData.funcionario}`,
            sucesso: true,
            data_envio: new Date().toISOString()
        };
        
        historico.unshift(registro);
        if (historico.length > 50) historico.pop();
        localStorage.setItem('porter_os_emails', JSON.stringify(historico));
    },

    gerarCorpoEmailOS(osData) {
        return `========================================
ORDEM DE SERVIÇO - PORTER 2026
========================================

📋 INFORMAÇÕES DA OS
----------------------------------------
• Número: ${osData.osId}
• Condomínio: ${osData.condo}
• Cidade: ${osData.cidade}
• Setor: ${osData.setor}
• Gravidade: ${osData.gravidade}
• Prazo: ${osData.prazoResposta || '3 dias úteis'}
• Data OS: ${new Date(osData.dataOS).toLocaleDateString('pt-BR')}
• Técnico responsável: ${osData.tecnicoResponsavel || 'Não definido'}

👤 INFORMAÇÕES DO SOLICITANTE
----------------------------------------
• Funcionário: ${osData.funcionario}
• E-mail: ${osData.email}
• Operador: ${osData.operador}

📅 DATAS E HORÁRIOS
----------------------------------------
• Aberta em: ${osData.data} às ${osData.hora}
• Turno: ${osData.turno}
• Status: ${osData.statusOS || 'Em branco'}

📝 DESCRIÇÃO DO PROBLEMA/SERVIÇO
----------------------------------------
${osData.desc}

========================================
ATA OPERACIONAL PORTER - 2026
E-mail automático - Não responda
========================================`;
    },

    mostrarDetalhesEmailOS(osData, emails) {
        const corpoEmail = this.gerarCorpoEmailOS(osData);
        
        const modalContent = `
            <div style="padding: 20px; max-width: 800px;">
                <h3><i class="fas fa-envelope"></i> Detalhes do E-mail da OS</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <strong><i class="fas fa-paper-plane"></i> De:</strong> sistema@porter.com.br<br>
                    <strong><i class="fas fa-users"></i> Para:</strong> ${emails.join(', ')}<br>
                    <strong><i class="fas fa-tag"></i> Assunto:</strong> [PORTER OS] ${osData.gravidade} - ${osData.condo}
                </div>
                <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px;
                    margin: 15px 0; font-family: monospace; white-space: pre-wrap;
                    max-height: 300px; overflow-y: auto;">
                    ${corpoEmail}
                </div>
                <div style="background: #e8f4fc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <i class="fas fa-info-circle"></i> <strong>Nota:</strong>
                    Em produção, este e-mail seria enviado automaticamente para todos os destinatários.
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="app.copiarConteudoEmail()">
                        <i class="fas fa-copy"></i> Copiar Conteúdo
                    </button>
                    <button class="btn btn-success" onclick="app.abrirClienteEmail('${osData.condo}', '${emails.join(',')}')">
                        <i class="fas fa-envelope-open"></i> Abrir no Cliente de E-mail
                    </button>
                    <button class="btn btn-clear" onclick="app.fecharModalEmail()">
                        Fechar
                    </button>
                </div>
            </div>
        `;
        
        this.criarModal('Detalhes do E-mail', modalContent);
    },

    criarModal(titulo, conteudo) {
        this.fecharModalEmail();
        
        const modal = document.createElement('div');
        modal.id = 'modal-email-detalhes';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 9999; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 900px;
                width: 100%; max-height: 90vh; overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div style="padding: 20px; border-bottom: 1px solid #eee;">
                    <h3 style="margin: 0; display: flex; justify-content: space-between; align-items: center;">
                        ${titulo}
                        <button onclick="app.fecharModalEmail()" style="background: none; border: none;
                        font-size: 1.5rem; cursor: pointer; color: #666;">&times;</button>
                    </h3>
                </div>
                <div>${conteudo}</div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },

    fecharModalEmail() {
        const modal = document.getElementById('modal-email-detalhes');
        if (modal) modal.remove();
    },

    copiarConteudoEmail() {
        const modal = document.getElementById('modal-email-detalhes');
        const conteudo = modal?.querySelector('pre, .conteudo-email')?.innerText || '';
        
        if (conteudo) {
            navigator.clipboard.writeText(conteudo)
                .then(() => app.showMessage('Conteúdo copiado!', 'success'))
                .catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = conteudo;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    app.showMessage('Conteúdo copiado!', 'success');
                });
        }
    },

    abrirClienteEmail(condo, emails) {
        const assunto = encodeURIComponent(`[PORTER OS] ${condo}`);
        const corpo = encodeURIComponent(`Prezado,\n\nSegue Ordem de Serviço do condomínio ${condo}.\n\nAtenciosamente,\nSistema Porter`);
        
        window.open(`mailto:${emails}?subject=${assunto}&body=${corpo}`, '_blank');
        app.showMessage('Cliente de e-mail aberto! Preencha o corpo com os detalhes da OS.', 'info');
    },

    verDetalhesEmailOS(osId) {
        let osList = JSON.parse(localStorage.getItem('porter_os') || '[]');
        let historico = JSON.parse(localStorage.getItem('porter_os_emails') || '[]');
        
        const os = osList.find(o => o.id === osId);
        const envio = historico.find(h => h.os_id === osId);
        
        if (!os) return;
        
        const corpoEmail = this.gerarCorpoEmailOS(os);
        const emails = os.emails || [];
        
        const modalContent = `
            <div style="padding: 20px;">
                <h3><i class="fas fa-envelope"></i> E-mail da OS - ${os.condo}</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <h4><i class="fas fa-info-circle"></i> Informações</h4>
                        <p><strong>Destinatários:</strong> ${emails.length}</p>
                        <p><strong>Gravidade:</strong> ${os.gravidade}</p>
                        <p><strong>Data:</strong> ${os.data} ${os.hora}</p>
                        ${envio ? `<p><strong>Registrado em:</strong> ${envio.data}</p>` : ''}
                    </div>
                    <div style="background: #e8f4fc; padding: 15px; border-radius: 8px;">
                        <h4><i class="fas fa-users"></i> Destinatários</h4>
                        <div style="max-height: 100px; overflow-y: auto;">
                            ${emails.map(email => `<div>📧 ${email}</div>`).join('')}
                        </div>
                    </div>
                </div>
                <div style="margin: 20px 0;">
                    <h4><i class="fas fa-file-alt"></i> Conteúdo do E-mail</h4>
                    <div style="background: white; border: 1px solid #ddd; padding: 15px;
                        border-radius: 6px; font-family: monospace; white-space: pre-wrap;
                        max-height: 300px; overflow-y: auto; margin-top: 10px;">
                        ${corpoEmail}
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="appEmail.copiarConteudoEmail()">
                        <i class="fas fa-copy"></i> Copiar Conteúdo
                    </button>
                    <button class="btn btn-success" onclick="appEmail.abrirClienteEmail('${os.condo}', '${emails.join(',')}')">
                        <i class="fas fa-envelope-open"></i> Abrir no Cliente de E-mail
                    </button>
                    <button class="btn btn-clear" onclick="appEmail.fecharModalEmail()">
                        Fechar
                    </button>
                </div>
            </div>
        `;
        
        this.criarModal(`E-mail da OS - ${os.condo}`, modalContent);
    }
};
