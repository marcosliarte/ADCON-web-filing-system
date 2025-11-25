const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Empresa = require('../models/model-empresa');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// @route   POST api/compartilhamento/empresas/:id/gerar-zip
// @desc    Gera arquivo ZIP com documentos selecionados da empresa
// @access  Private
router.post('/empresas/:id/gerar-zip', auth, async (req, res) => {
  try {
    const { documentos } = req.body; // Array de caminhos de documentos
    const empresaId = req.params.id;

    if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
      return res.status(400).json({ msg: 'Nenhum documento selecionado.' });
    }

    const empresa = await Empresa.findById(empresaId);
    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada.' });
    }

    // Configurar headers para download
    const nomeEmpresa = (empresa.nomeFantasia || empresa.razaoSocial || empresa.nome || 'empresa').replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const nomeArquivo = `${nomeEmpresa}_documentos_${timestamp}.zip`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);

    // Criar arquivo ZIP
    const archive = archiver('zip', {
      zlib: { level: 9 } // Máxima compressão
    });

    // Tratar erros do archiver
    archive.on('error', (err) => {
      console.error('Erro no archiver:', err);
      if (!res.headersSent) {
        res.status(500).json({ msg: 'Erro ao criar arquivo ZIP.' });
      }
    });

    // Pipe do arquivo para a resposta
    archive.pipe(res);

    // Adicionar cada documento ao ZIP
    let arquivosAdicionados = 0;
    for (const docPath of documentos) {
      // Remover barra inicial se houver
      const cleanPath = docPath.startsWith('/') ? docPath.substring(1) : docPath;
      const fullPath = path.join(__dirname, '..', cleanPath);
      
      // Verificar se arquivo existe
      if (fs.existsSync(fullPath)) {
        const fileName = path.basename(fullPath);
        archive.file(fullPath, { name: fileName });
        arquivosAdicionados++;
        console.log('Adicionado ao ZIP:', fileName);
      } else {
        console.warn('Arquivo não encontrado:', fullPath);
      }
    }

    if (arquivosAdicionados === 0) {
      // Se nenhum arquivo foi encontrado, cancelar o ZIP
      archive.abort();
      return res.status(404).json({ msg: 'Nenhum documento válido foi encontrado.' });
    }

    console.log(`Total de arquivos adicionados ao ZIP: ${arquivosAdicionados}`);

    // Finalizar o arquivo ZIP
    await archive.finalize();

  } catch (err) {
    console.error('Erro ao gerar ZIP:', err);
    if (!res.headersSent) {
      res.status(500).json({ msg: 'Erro ao gerar arquivo ZIP.', error: err.message });
    }
  }
});

// @route   POST api/compartilhamento/empresas/:id/gerar-relatorio-pdf
// @desc    Gera relatório completo em PDF da empresa
// @access  Private
router.post('/empresas/:id/gerar-relatorio-pdf', auth, async (req, res) => {
  try {
    const empresaId = req.params.id;
    const empresa = await Empresa.findById(empresaId).populate('matriz').lean();
    
    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada.' });
    }

    // Aqui você pode usar uma biblioteca como PDFKit ou Puppeteer para gerar PDF
    // Por enquanto, vamos retornar os dados formatados
    
    res.json({
      msg: 'Funcionalidade de PDF será implementada com biblioteca específica',
      empresa
    });

  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    res.status(500).json({ msg: 'Erro ao gerar relatório PDF.' });
  }
});

module.exports = router;
