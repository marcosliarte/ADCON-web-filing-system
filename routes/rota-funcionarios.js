const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Usuario = require('../models/model-usuario');
const Funcionario = require('../models/model-funcionario');
const Notificacao = require('../models/model-notificacao');

// Middleware para verificar se o usuário é Admin ou Gerente
const checkAdminGerente = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('role');
    if (!['admin', 'gerente'].includes(usuario.role)) {
      return res.status(403).json({ msg: 'Acesso negado. Permissão de Admin ou Gerente necessária.' });
    }
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
};

// @route   POST api/funcionarios
// @desc    Cadastrar um novo funcionário
// @access  Private (Admin/Gerente)
router.post(
  '/',
  [
    auth,
    checkAdminGerente,
    check('nome', 'O nome é obrigatório').not().isEmpty(),
    check('cargo', 'O cargo é obrigatório').not().isEmpty(),
    check('salarioBruto', 'O salário bruto é obrigatório').isNumeric(),
    check('usuario', 'É obrigatório vincular a um usuário').isMongoId()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { nome, cargo, salarioBruto, chavePix, descontos, usuario } = req.body;

    try {
      const funcionarioExistente = await Funcionario.findOne({ usuario });
      if (funcionarioExistente) {
        return res.status(400).json({ msg: 'Este usuário já está vinculado a um funcionário.' });
      }

      const novoFuncionario = new Funcionario({ nome, cargo, salarioBruto, chavePix, descontos: descontos || [], usuario });
      await novoFuncionario.save();
      res.status(201).json(novoFuncionario);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' });
    }
  }
);

// @route   GET api/funcionarios
// @desc    Listar todos os funcionários
// @access  Private (Admin/Gerente) - **ATUALIZADO**
router.get('/', [auth, checkAdminGerente], async (req, res) => {
  try {
    const funcionarios = await Funcionario.find().populate('usuario', 'nome email').sort({ nome: 1 }).lean();
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    const funcionariosComStatus = funcionarios.map(func => {
        const pagamentoMesAtual = (func.historicoPagamentos || []).find(p => p.mes === mesAtual && p.ano === anoAtual);
        func.statusPagamentoMesAtual = pagamentoMesAtual ? 'Pago' : 'A Pagar';
        return func;
    });

    res.json(funcionariosComStatus);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   GET api/funcionarios/:id
// @desc    Obter um funcionário pelo ID - **NOVO**
// @access  Private (Admin/Gerente)
router.get('/:id', [auth, checkAdminGerente], async (req, res) => {
    try {
        const funcionario = await Funcionario.findById(req.params.id).populate('usuario', 'nome email');
        if (!funcionario) return res.status(404).json({ msg: 'Funcionário não encontrado.' });
        res.json(funcionario);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   PUT api/funcionarios/:id
// @desc    Atualizar um funcionário - **NOVO**
// @access  Private (Admin/Gerente)
router.put('/:id', [auth, checkAdminGerente], async (req, res) => {
    const { nome, cargo, salarioBruto, chavePix, descontos } = req.body;
    try {
        let funcionario = await Funcionario.findById(req.params.id);
        if (!funcionario) return res.status(404).json({ msg: 'Funcionário não encontrado.' });

        funcionario.nome = nome;
        funcionario.cargo = cargo;
        funcionario.salarioBruto = salarioBruto;
        funcionario.chavePix = chavePix;
        funcionario.descontos = descontos || [];

        await funcionario.save();
        res.json(funcionario);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   DELETE api/funcionarios/:id
// @desc    Deletar um funcionário
// @access  Private (Admin/Gerente)
router.delete('/:id', [auth, checkAdminGerente], async (req, res) => {
    try {
      const funcionario = await Funcionario.findById(req.params.id);
      if (!funcionario) return res.status(404).json({ msg: 'Funcionário não encontrado' });
      
      await Funcionario.findByIdAndDelete(req.params.id);
      res.json({ msg: 'Funcionário removido' });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' });
    }
  }
);

// @route   POST api/funcionarios/:id/pagamentos
// @desc    Registrar um novo pagamento para um funcionário - **NOVO**
// @access  Private (Admin, Gerente)
router.post('/:id/pagamentos', [auth, checkAdminGerente], async (req, res) => {
    const { mes, ano, salarioBase, adicionais, descontosFixos, descontosVariaveis, totalProventos, totalDescontos, salarioLiquido, formaPagamento, chavePix } = req.body;
    try {
        const funcionario = await Funcionario.findById(req.params.id).populate('usuario');
        if (!funcionario) return res.status(404).json({ message: 'Funcionário não encontrado.' });

        // Remove pagamento antigo para o mesmo período para evitar duplicatas
        funcionario.historicoPagamentos = funcionario.historicoPagamentos.filter(p => !(p.mes === parseInt(mes) && p.ano === parseInt(ano)));

        funcionario.historicoPagamentos.push({ mes, ano, salarioBase, adicionais, descontosFixos, descontosVariaveis, totalProventos, totalDescontos, salarioLiquido, formaPagamento, chavePix });
        await funcionario.save();

        // Criar notificação para o funcionário se houver usuário vinculado
        if (funcionario.usuario) {
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const mesNome = meses[parseInt(mes) - 1];
            
            await Notificacao.create({
                usuarioId: funcionario.usuario._id,
                tipo: 'pagamento_recebido',
                titulo: 'Pagamento Recebido',
                mensagem: `Seu pagamento referente a ${mesNome}/${ano} foi registrado. Valor líquido: R$ ${salarioLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                lida: false
            });
        }

        res.status(201).json({ message: 'Pagamento registrado com sucesso!', funcionario });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   DELETE api/funcionarios/:id/pagamentos/:pagamentoId
// @desc    Excluir um pagamento específico do histórico de um funcionário
// @access  Private (Admin, Gerente)
router.delete('/:id/pagamentos/:pagamentoId', [auth, checkAdminGerente], async (req, res) => {
    try {
        const funcionario = await Funcionario.findById(req.params.id);
        if (!funcionario) return res.status(404).json({ message: 'Funcionário não encontrado.' });

        // Usa o método 'pull' do Mongoose para remover um subdocumento de um array
        funcionario.historicoPagamentos.pull({ _id: req.params.pagamentoId });

        await funcionario.save();

        res.json({ message: 'Registro de pagamento removido com sucesso.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao excluir o pagamento.' });
    }
});


// @route   PUT api/funcionarios/:id/vincular-usuario
// @desc    Alterar o vínculo de usuário de um funcionário
// @access  Private (Admin)
router.put('/:id/vincular-usuario', [auth, check('novoUsuarioId', 'O ID do novo usuário é obrigatório').isMongoId()], async (req, res) => {
    try {
        // 1. Verifica se o usuário que está fazendo a requisição é um admin
        const requisitante = await Usuario.findById(req.usuario.id);
        if (requisitante.role !== 'admin') {
            return res.status(403).json({ msg: 'Acesso negado. Apenas administradores podem alterar o vínculo de usuários.' });
        }

        const { novoUsuarioId } = req.body;
        const funcionarioId = req.params.id;

        // 2. Verifica se o novo usuário já não está vinculado a OUTRO funcionário
        const outroFuncionario = await Funcionario.findOne({ usuario: novoUsuarioId, _id: { $ne: funcionarioId } });
        if (outroFuncionario) {
            return res.status(400).json({ msg: 'Este usuário já está vinculado a outro funcionário.' });
        }

        // 3. Atualiza o funcionário
        const funcionario = await Funcionario.findByIdAndUpdate(funcionarioId, { usuario: novoUsuarioId }, { new: true });
        if (!funcionario) return res.status(404).json({ msg: 'Funcionário não encontrado.' });

        res.json({ msg: 'Vínculo de usuário atualizado com sucesso!', funcionario });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

module.exports = router;