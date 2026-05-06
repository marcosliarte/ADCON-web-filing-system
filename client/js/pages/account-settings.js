// account-settings.js - Configurações de Conta

let usuario;

async function getUsuarioConta() {
  try {
    const response = await fetchWithAuth('/api/auth');
    if (response && response.ok) {
      usuario = await response.json();
      await createHeader('header-placeholder', usuario);
    }
  } catch (e) {
    localStorage.removeItem('token');
    window.location.replace('login.html');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await getUsuarioConta();

  // Pré-preenche o campo de nome com o nome atual
  if (usuario && usuario.nome) {
    const novoNomeInput = document.getElementById('novoNome');
    if (novoNomeInput) novoNomeInput.value = usuario.nome;
  }

  // Se hash indicar uma seção, rola até ela
  const hash = (location.hash || '').replace('#','');
  if (hash === 'nome') {
    document.getElementById('sec-nome')?.scrollIntoView({behavior:'smooth'});
  } else if (hash === 'senha') {
    document.getElementById('sec-senha')?.scrollIntoView({behavior:'smooth'});
  } else if (hash === 'email') {
    document.getElementById('sec-email')?.scrollIntoView({behavior:'smooth'});
  }

  // ===== Alterar Nome =====
  document.getElementById('changeNameForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const novoNome = document.getElementById('novoNome').value.trim();
    const btn = document.getElementById('btnSubmitNome');

    if (!novoNome) {
      showToast('O nome não pode estar vazio.', 'error');
      return;
    }

    btn.disabled = true;
    try {
      const response = await fetchWithAuth('/api/auth/change-name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome })
      });

      if (response && response.ok) {
        const data = await response.json();
        showToast(data.msg || 'Nome alterado com sucesso!', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const data = response ? await response.json().catch(() => ({msg:'Erro'})) : {msg:'Erro'};
        showToast(data.msg || 'Erro ao alterar o nome.', 'error');
        btn.disabled = false;
      }
    } catch (err) {
      showToast(err.message || 'Erro ao alterar o nome.', 'error');
      btn.disabled = false;
    }
  });

  // ===== Validação Senha =====
  const hasUpper = (s) => /[A-Z]/.test(s);
  const hasLower = (s) => /[a-z]/.test(s);
  const hasDigit = (s) => /\d/.test(s);
  const hasSpecial = (s) => /[^\w\s]/.test(s);
  const pwRulesEl = document.getElementById('pw-rules');
  const pwMatchEl = document.getElementById('pw-match');
  const pwBarsParent = document.querySelector('.strength-meter');
  const btnSubmitSenha = document.getElementById('btnSubmitSenha');

  function updatePwUI() {
    const atual = document.getElementById('senhaAtual').value || '';
    const nova = document.getElementById('novaSenha').value || '';
    const conf = document.getElementById('confirmarNovaSenha').value || '';

    const rules = {
      len: nova.length >= 8,
      upper: hasUpper(nova),
      lower: hasLower(nova),
      digit: hasDigit(nova),
      special: hasSpecial(nova)
    };

    if (pwRulesEl) {
      Array.from(pwRulesEl.querySelectorAll('li')).forEach((li) => {
        const rule = li.getAttribute('data-rule');
        const ok = !!rules[rule];
        li.classList.remove('valid', 'invalid');
        li.classList.add(ok ? 'valid' : 'invalid');
      });
    }

    let score = 0;
    score += rules.len ? 1 : 0;
    score += rules.upper ? 1 : 0;
    score += rules.lower ? 1 : 0;
    score += (rules.digit || rules.special) ? 1 : 0;
    score = Math.min(score, 4);
    if (pwBarsParent) {
      pwBarsParent.classList.remove('strength-1','strength-2','strength-3','strength-4');
      if (score > 0) pwBarsParent.classList.add(`strength-${score}`);
    }

    const matches = nova.length > 0 && nova === conf;
    if (pwMatchEl) {
      pwMatchEl.textContent = matches ? 'As senhas coincidem.' : (conf.length ? 'As senhas não coincidem.' : '');
      pwMatchEl.style.color = matches ? '#0f766e' : '#b91c1c';
    }

    const allOk = Object.values(rules).every(Boolean) && matches && (atual && nova && conf) && atual !== nova;
    btnSubmitSenha.disabled = !allOk;
  }

  document.querySelectorAll('.toggle-visibility').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.textContent = isPwd ? 'Ocultar' : 'Mostrar';
    });
  });

  ['senhaAtual','novaSenha','confirmarNovaSenha'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePwUI);
  });

  document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const senhaAtual = document.getElementById('senhaAtual').value;
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarNovaSenha = document.getElementById('confirmarNovaSenha').value;

    if (btnSubmitSenha.disabled) {
      showToast('Verifique os requisitos da senha e a confirmação.', 'error');
      return;
    }

    try {
      const response = await fetchWithAuth('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha })
      });
      if (response && response.ok) {
        const data = await response.json();
        showToast(data.msg || 'Senha alterada com sucesso!', 'success');
        this.reset();
        updatePwUI();
      } else {
        const data = response ? await response.json().catch(() => ({msg:'Erro'})) : {msg:'Erro'};
        showToast(data.msg || 'Erro ao alterar a senha.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Erro ao alterar a senha.', 'error');
    }
  });

  // ===== Validação Email =====
  const emailFormatMsg = document.getElementById('emailFormatMsg');
  const emailMatchMsg = document.getElementById('emailMatchMsg');
  const btnSubmitEmail = document.getElementById('btnSubmitEmail');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  function updateEmailUI() {
    const novoEmail = document.getElementById('novoEmail').value.trim();
    const confirmarNovoEmail = document.getElementById('confirmarNovoEmail').value.trim();
    const formatOk = emailRegex.test(novoEmail);
    const matchOk = novoEmail.length > 0 && novoEmail === confirmarNovoEmail;

    if (emailFormatMsg) {
      emailFormatMsg.textContent = formatOk || !novoEmail ? '' : 'Formato de email inválido.';
      emailFormatMsg.style.color = '#b91c1c';
    }
    if (emailMatchMsg) {
      emailMatchMsg.textContent = matchOk || !confirmarNovoEmail ? '' : 'Emails não coincidem.';
      emailMatchMsg.style.color = '#b91c1c';
    }
    btnSubmitEmail.disabled = !(formatOk && matchOk);
  }

  ['novoEmail','confirmarNovoEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateEmailUI);
  });

  document.getElementById('changeEmailForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const novoEmail = document.getElementById('novoEmail').value;
    const confirmarNovoEmail = document.getElementById('confirmarNovoEmail').value;

    if (btnSubmitEmail.disabled) {
      showToast('Verifique o formato e a confirmação do email.', 'error');
      return;
    }

    try {
      const response = await fetchWithAuth('/api/auth/change-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novoEmail })
      });

      if (response.ok) {
        const data = await response.json();
        showToast(data.msg || 'Email alterado com sucesso!', 'success');
        this.reset();
        updateEmailUI();
      } else {
        const data = await response.json();
        showToast(data.msg || 'Erro ao alterar o email.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Erro ao alterar o email.', 'error');
    }
  });

  // Inicializar estados
  updatePwUI();
  updateEmailUI();
});
