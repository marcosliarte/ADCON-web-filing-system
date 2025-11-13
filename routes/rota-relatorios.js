const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const Empresa = require('../models/model-empresa');
const Mensalidade = require('../models/model-mensalidade'); // CORREÇÃO: Aponta para o arquivo correto na pasta models
const ConfiguracaoEmpresa = require('../models/model-configuracao'); // Importa o modelo de configuração

// --- DEFINIÇÃO DOS SCHEMAS E MODELOS DIRETAMENTE NO ARQUIVO ---
const DespesaSchema = new mongoose.Schema({
    descricao: { type: String, required: true, trim: true },
    valor: { type: Number, required: true },
    tipo: {
        type: String,
        required: true,
        enum: ['unica', 'fixa', 'parcelada'],
        default: 'unica'
    },
    data: { type: Date }, // Usado para despesa 'unica'
    dataInicio: { type: Date }, // Usado para despesa 'fixa' e 'parcelada'
    diaVencimento: { type: Number, min: 1, max: 31 }, // Dia do mês para recorrência
    totalParcelas: { type: Number }, // Apenas para tipo 'parcelada'
    status: { // Apenas para tipo 'fixa'
        type: String,
        enum: ['ativa', 'cancelada'],
        default: 'ativa'
    }
}, {
    timestamps: true // Adiciona createdAt e updatedAt
});

const ReceitaSchema = new mongoose.Schema({
    descricao: { type: String, required: true, trim: true },
    valor: { type: Number, required: true },
    data: { type: Date, default: Date.now }
});

const Despesa = mongoose.model('Despesa', DespesaSchema);
const Receita = mongoose.model('Receita', ReceitaSchema);

// @route   GET api/relatorios/geral
// @desc    Obter um relatório geral (total de clientes, etc.)
// @access  Private (Admin, Gerente)
router.get('/geral', [auth, adminAuth], async (req, res) => {
    try {
        const totalClientes = await Empresa.countDocuments();

        // Conta como "cliente pagante" qualquer empresa que já teve ao menos uma mensalidade com status "Pago".
        const clientesPagantes = await Mensalidade.distinct('empresaId', {
            status: 'Pago'
        });

        res.json({
            totalClientes,
            clientesPagantes: clientesPagantes.length,
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// --- NOVAS ROTAS PARA LANÇAMENTOS (DENTRO DE /api/relatorios) ---

// @route   POST api/relatorios/despesas
// @desc    Lançar uma nova despesa
router.post('/despesas', [auth, adminAuth], async (req, res) => {
    try {
        const { descricao, valor, tipo, data, dataInicio, diaVencimento, totalParcelas } = req.body;
        if (!descricao || !valor) return res.status(400).json({ msg: 'Descrição e valor são obrigatórios.' });

        const dadosDespesa = { descricao, valor, tipo };

        if (tipo === 'unica') {
            dadosDespesa.data = data ? new Date(data) : new Date();
        } else { // 'fixa' ou 'parcelada'
            dadosDespesa.dataInicio = dataInicio ? new Date(dataInicio) : new Date();
            dadosDespesa.diaVencimento = diaVencimento;
            if (tipo === 'parcelada') dadosDespesa.totalParcelas = totalParcelas;
        }

        const novaDespesa = new Despesa(dadosDespesa);
        await novaDespesa.save();
        res.status(201).json(novaDespesa);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao salvar despesa.' });
    }
});

// @route   POST api/relatorios/receitas
// @desc    Lançar uma nova receita
router.post('/receitas', [auth, adminAuth], async (req, res) => {
    try {
        const { descricao, valor, data } = req.body;
        if (!descricao || !valor) return res.status(400).json({ msg: 'Descrição e valor são obrigatórios.' });
        const novaReceita = new Receita({ descricao, valor, data: data ? new Date(data) : new Date() });
        await novaReceita.save();
        res.status(201).json(novaReceita);
    } catch (err) {
        console.error('Erro ao salvar receita:', err.message);
        res.status(500).send('Erro no servidor ao salvar receita.');
    }
});

// @route   GET api/relatorios/despesas/:id
// @desc    Obter uma despesa específica
router.get('/despesas/:id', [auth, adminAuth], async (req, res) => {
    try {
        const despesa = await Despesa.findById(req.params.id);
        if (!despesa) return res.status(404).json({ msg: 'Despesa não encontrada.' });
        res.json(despesa);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor.' });
    }
});

// @route   GET api/relatorios/receitas/:id
// @desc    Obter uma receita específica
router.get('/receitas/:id', [auth, adminAuth], async (req, res) => {
    try {
        const receita = await Receita.findById(req.params.id);
        if (!receita) return res.status(404).json({ msg: 'Receita não encontrada.' });
        res.json(receita);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor.' });
    }
});

// @route   PUT api/relatorios/despesas/:id
// @desc    Atualizar uma despesa
router.put('/despesas/:id', [auth, adminAuth], async (req, res) => {
    try {
        const despesa = await Despesa.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(despesa);
    } catch (err) { res.status(500).json({ msg: 'Erro no servidor.' }); }
});

// @route   PUT api/relatorios/receitas/:id
// @desc    Atualizar uma receita
router.put('/receitas/:id', [auth, adminAuth], async (req, res) => {
    try {
        const receita = await Receita.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(receita);
    } catch (err) { res.status(500).json({ msg: 'Erro no servidor.' }); }
});

// @route   DELETE api/relatorios/despesas/:id
// @desc    Excluir uma despesa
router.delete('/despesas/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Despesa.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Despesa excluída com sucesso.' });
    } catch (err) { res.status(500).json({ msg: 'Erro no servidor.' }); }
});

// @route   PUT api/relatorios/despesas/:id/cancelar
// @desc    Cancela uma despesa fixa (muda o status para 'cancelada')
router.put('/despesas/:id/cancelar', [auth, adminAuth], async (req, res) => {
    try {
        const despesa = await Despesa.findById(req.params.id);
        if (!despesa) {
            return res.status(404).json({ msg: 'Despesa não encontrada.' });
        }
        if (despesa.tipo !== 'fixa') {
            return res.status(400).json({ msg: 'Apenas despesas fixas podem ser canceladas.' });
        }

        despesa.status = 'cancelada';
        await despesa.save();

        res.json({ msg: 'Despesa fixa cancelada com sucesso.', despesa });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao cancelar despesa.' });
    }
});

// @route   DELETE api/relatorios/receitas/:id
router.delete('/receitas/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Receita.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Receita excluída com sucesso.' });
    } catch (err) { res.status(500).json({ msg: 'Erro no servidor.' }); }
});

// @route   GET api/relatorios/mensal
// @desc    Obter relatório financeiro de um mês/ano específico
// @access  Private (Admin, Gerente)
router.get('/mensal', [auth, adminAuth], async (req, res) => {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ msg: 'Ano e mês são obrigatórios.' });
    }

    try {
        const anoInt = parseInt(ano);
        const mesInt = parseInt(mes);
        const inicioMes = new Date(anoInt, mesInt - 1, 1);
        const fimMes = new Date(anoInt, mesInt, 0, 23, 59, 59);

        // REESTRUTURAÇÃO COMPLETA DA LÓGICA
        // 1. Busca as mensalidades do período e já popula os dados da empresa.
        //    Usa .lean() para retornar objetos JS puros, o que é mais rápido e seguro.
        const mensalidades = await Mensalidade.find({
            ano: parseInt(ano),
            mes: parseInt(mes)
        }).populate('empresaId', 'nome cnpj').lean();

        const totalMensalidades = mensalidades.length;
        const pagas = mensalidades.filter(m => m.status === 'Pago');
        
        // 2. Lógica de classificação precisa baseada na data de hoje.
        //    Normaliza 'hoje' para o início do dia para evitar problemas com fuso horário.
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const pendentes = mensalidades.filter(m => 
            m.status === 'Pendente' && m.dataVencimento && new Date(m.dataVencimento) >= hoje
        );
        const atrasadas = mensalidades.filter(m => 
            m.status !== 'Pago' && m.dataVencimento && new Date(m.dataVencimento) < hoje
        );

        // 3. Formata a lista para o front-end, renomeando 'empresaId' para 'empresa'.
        const formatarLista = (lista) => lista.map(item => ({ ...item, empresa: item.empresaId, empresaId: undefined }));

        const listaPagas = formatarLista(pagas);
        const listaPendentes = formatarLista(pendentes);
        const listaAtrasadas = formatarLista(atrasadas);

        const receitaMensalidades = pagas.reduce((acc, m) => acc + m.valor, 0);

        // --- CÁLCULO DE OUTRAS RECEITAS E DESPESAS ---
        const outrasReceitas = await Receita.find({ data: { $gte: inicioMes, $lte: fimMes } }).lean();
        
        // NOVA LÓGICA PARA BUSCAR DESPESAS
        const despesasUnicas = await Despesa.find({
            tipo: 'unica',
            data: { $gte: inicioMes, $lte: fimMes }
        }).lean();

        const despesasRecorrentes = await Despesa.find({
            tipo: { $in: ['fixa', 'parcelada'] },
            dataInicio: { $lte: fimMes }, // A despesa deve ter começado antes do fim do mês
        }).lean();

        const despesasDoMes = despesasRecorrentes.filter(d => {
            if (d.tipo === 'fixa' && d.status === 'cancelada' && d.updatedAt < inicioMes) {
                return false; // Ignora despesas fixas canceladas antes do mês atual
            }
            if (d.tipo === 'parcelada') {
                const dataFimParcelas = new Date(d.dataInicio);
                dataFimParcelas.setMonth(dataFimParcelas.getMonth() + d.totalParcelas);
                return dataFimParcelas > inicioMes; // Inclui se o período de parcelamento ainda não terminou
            }
            return true; // Inclui despesas fixas ativas
        });

        const despesasManuais = [...despesasUnicas, ...despesasDoMes];

        const totalOutrasReceitas = outrasReceitas.reduce((acc, r) => acc + r.valor, 0);
        const totalDespesasManuais = despesasManuais.reduce((acc, d) => acc + d.valor, 0);

        // --- CÁLCULO DE DESPESAS (FOLHA DE PAGAMENTO) ---
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' }).lean();
        let despesasFolha = 0;
        let detalheDespesasFolha = []; // Array para guardar a descrição das despesas

        // Lógica simplificada para somar o salário bruto de todos os funcionários cadastrados.
        if (config && config.funcionarios) {
            despesasFolha = config.funcionarios.reduce((total, func) => total + (func.salarioBruto || 0), 0);
            // Cria a lista detalhada para o frontend
            detalheDespesasFolha = config.funcionarios.map(func => ({
                descricao: `Salário: ${func.nome}`,
                valor: func.salarioBruto || 0
            }));
        }

        const receitaTotal = receitaMensalidades + totalOutrasReceitas;
        const totalDespesas = despesasFolha + totalDespesasManuais;
        const lucroLiquido = receitaTotal - totalDespesas;
        
        // Adiciona os detalhes da folha de pagamento à lista de despesas manuais
        const despesasUnificadas = [...despesasManuais, ...detalheDespesasFolha];

        res.json({
            periodo: { ano, mes },
            totalMensalidades,
            receita: receitaTotal,
            totalDespesas,
            lucroLiquido,
            pagas: { quantidade: pagas.length, lista: listaPagas },
            pendentes: { quantidade: pendentes.length, lista: listaPendentes },
            atrasadas: { quantidade: atrasadas.length, lista: listaAtrasadas },
            outrasReceitas: outrasReceitas,
            despesasManuais: despesasUnificadas // Mantém o nome original do campo esperado pelo frontend
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   GET api/relatorios/anual
// @desc    Obter relatório financeiro anual (receita por mês)
// @access  Private (Admin, Gerente)
router.get('/anual', [auth, adminAuth], async (req, res) => {
    const { ano } = req.query;

    if (!ano) {
        return res.status(400).json({ msg: 'O ano é obrigatório.' });
    }

    try {
        const receitaAnual = await Mensalidade.aggregate([
            // 1. Filtrar mensalidades pagas do ano especificado
            { $match: { ano: parseInt(ano), status: 'Pago' } },
            // 2. Agrupar por mês e somar os valores
            { $group: { _id: '$mes', receitaTotal: { $sum: '$valor' } } },
            // 3. Ordenar pelo mês
            { $sort: { _id: 1 } }
        ]);

        // Agrega as despesas e receitas manuais
        const outrasReceitasAnual = await Receita.aggregate([
            { $match: { data: { $gte: new Date(parseInt(ano), 0, 1), $lt: new Date(parseInt(ano) + 1, 0, 1) } } },
            { $group: { _id: { $month: '$data' }, total: { $sum: '$valor' } } },
            { $sort: { _id: 1 } }
        ]);

        const despesasManuaisAnual = await Despesa.aggregate([
            { $match: { data: { $gte: new Date(parseInt(ano), 0, 1), $lt: new Date(parseInt(ano) + 1, 0, 1) } } },
            { $group: { _id: { $month: '$data' }, total: { $sum: '$valor' } } },
            { $sort: { _id: 1 } }
        ]);

        // Agrega as despesas anuais da folha de pagamento
        const despesasAnuais = await ConfiguracaoEmpresa.aggregate([
            { $match: { identificador: 'adcon_config' } },
            { $unwind: '$funcionarios' },
            { $unwind: '$funcionarios.historicoPagamentos' },
            { $match: { 'funcionarios.historicoPagamentos.ano': parseInt(ano) } },
            { $group: {
                _id: '$funcionarios.historicoPagamentos.mes',
                despesaTotal: { $sum: '$funcionarios.historicoPagamentos.salarioLiquido' }
            }},
            { $sort: { _id: 1 } }
        ]);

        res.json({
            receitaMensalidades: receitaAnual,
            outrasReceitas: outrasReceitasAnual,
            despesasFolha: despesasAnuais,
            despesasManuais: despesasManuaisAnual
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao gerar relatório anual' });
    }
});

// @route   GET api/relatorios/folha-pagamento
// @desc    Obter relatório da folha de pagamento de um mês/ano específico
// @access  Private (Admin, Gerente)
router.get('/folha-pagamento', [auth, adminAuth], async (req, res) => {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ msg: 'Ano e mês são obrigatórios.' });
    }

    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' }).lean();
        if (!config || !config.funcionarios) {
            return res.json({
                periodo: { ano, mes },
                totalFuncionariosPagos: 0,
                totalSalarioBase: 0,
                totalAdicionais: 0,
                totalDescontos: 0,
                totalLiquido: 0,
                pagamentos: []
            });
        }

        const pagamentosDoMes = config.funcionarios
            .map(func => {
                const pagamento = (func.historicoPagamentos || []).find(p => p.ano == ano && p.mes == mes);
                return pagamento ? { ...pagamento, nomeFuncionario: func.nome } : null;
            })
            .filter(p => p !== null);

        const relatorio = {
            periodo: { ano, mes },
            totalFuncionariosPagos: pagamentosDoMes.length,
            totalSalarioBase: pagamentosDoMes.reduce((acc, p) => acc + p.salarioBase, 0),
            totalAdicionais: pagamentosDoMes.reduce((acc, p) => acc + p.adicionais.reduce((subAcc, item) => subAcc + item.valor, 0), 0),
            totalDescontos: pagamentosDoMes.reduce((acc, p) => acc + p.totalDescontos, 0),
            totalLiquido: pagamentosDoMes.reduce((acc, p) => acc + p.salarioLiquido, 0),
            pagamentos: pagamentosDoMes
        };

        res.json(relatorio);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao gerar relatório da folha de pagamento.' });
    }
});

module.exports = router;