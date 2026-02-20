// Sistema de geração de PDF
const pdfGenerator = {
    generatePDF() {
        const condo = document.getElementById('report-condo').value;
        const dataInicio = document.getElementById('report-data-inicio').value;
        const dataFim = document.getElementById('report-data-fim').value;
        const tipo = document.getElementById('report-tipo').value;
        
        let dados = [];
        let titulo = '';
        
        if (tipo === 'atas' || tipo === 'all') {
            let atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
            if (condo) atas = atas.filter(a => a.condo === condo);
            if (dataInicio) atas = atas.filter(a => a.dataISO >= dataInicio);
            if (dataFim) atas = atas.filter(a => a.dataISO <= dataFim);
            
            if (tipo === 'atas') {
                dados = atas;
                titulo = 'Relatório de Ocorrências';
            } else {
                dados = dados.concat(atas.map(a => ({...a, tipoRegistro: 'Ocorrência'})));
            }
        }
        
        if (tipo === 'fixas' || tipo === 'all') {
            let atas = JSON.parse(localStorage.getItem('porter_atas') || '[]');
            let fixas = atas.filter(a => a.fixa);
            if (condo) fixas = fixas.filter(a => a.condo === condo);
            if (dataInicio) fixas = fixas.filter(a => a.dataISO >= dataInicio);
            if (dataFim) fixas = fixas.filter(a => a.dataISO <= dataFim);
            
            if (tipo === 'fixas') {
                dados = fixas;
                titulo = 'Relatório de Informações Fixas';
            } else {
                dados = dados.concat(fixas.map(a => ({...a, tipoRegistro: 'Informação Fixa'})));
            }
        }
        
        if (tipo === 'os' || tipo === 'all') {
            let osList = JSON.parse(localStorage.getItem('porter_os') || '[]');
            if (condo) osList = osList.filter(os => os.condo === condo);
            if (dataInicio) osList = osList.filter(os => os.dataISO >= dataInicio);
            if (dataFim) osList = osList.filter(os => os.dataISO <= dataFim);
            
            if (tipo === 'os') {
                dados = osList;
                titulo = 'Relatório de Ordens de Serviço';
            } else {
                dados = dados.concat(osList.map(os => ({...os, tipoRegistro: 'Ordem de Serviço'})));
            }
        }
        
        if (tipo === 'all') {
            titulo = 'Relatório Completo';
        }
        
        if (dados.length === 0) {
            alert('Nenhum registro encontrado para os filtros selecionados.');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Cabeçalho
        doc.setFillColor(26, 58, 95);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text('PORTER', 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Ata Operacional - 2026', 105, 22, { align: 'center' });
        
        // Título do relatório
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text(titulo, 105, 40, { align: 'center' });
        
        // Filtros aplicados
        doc.setFontSize(10);
        let filtrosTexto = `Condomínio: ${condo || 'Todos'} | Período: ${dataInicio || 'Início'} a ${dataFim || 'Fim'}`;
        doc.text(filtrosTexto, 105, 50, { align: 'center' });
        
        // Data de geração
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 105, 55, { align: 'center' });
        
        // Conteúdo
        let y = 70;
        
        dados.forEach((item, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`${index + 1}. ${item.condo || ''}`, 10, y);
            doc.setFont(undefined, 'normal');
            y += 7;
            
            doc.setFontSize(10);
            doc.text(`Data: ${item.data} ${item.hora} | Tipo: ${item.tipoRegistro || item.tipo || ''}`, 10, y);
            y += 5;
            
            if (item.gravidade) {
                doc.text(`Gravidade: ${item.gravidade} | Prazo: ${item.prazoResposta || ''}`, 10, y);
                y += 5;
            }
            
            if (item.statusOS) {
                doc.text(`Status: ${item.statusOS}`, 10, y);
                y += 5;
            }
            
            doc.text(`Operador: ${item.operador} | Status: ${item.status || ''}`, 10, y);
            y += 5;
            
            const desc = item.desc || '';
            const descLines = doc.splitTextToSize(desc, 190);
            
            doc.text('Descrição:', 10, y);
            y += 5;
            
            descLines.forEach(line => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 15, y);
                y += 5;
            });
            
            y += 10;
            
            if (index < dados.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.line(10, y, 200, y);
                y += 5;
            }
        });
        
        // Rodapé
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Total de registros: ${dados.length}`, 105, 285, { align: 'center' });
        doc.text('Porter - Ata Operacional 2026', 105, 290, { align: 'center' });
        
        doc.save(`relatorio-porter-${new Date().toISOString().slice(0, 10)}.pdf`);
        app.closeReportModal();
        app.showMessage('Relatório gerado com sucesso!', 'success');
    }
};
