// Função para notificações modernas (Toasts)
function mostrarAviso(mensagem, cor = "var(--dourado)") {
    const toast = document.createElement("div");
    toast.innerText = mensagem;
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; 
        background: var(--bg-card); color: ${cor}; 
        padding: 15px 25px; border-radius: 8px; 
        border: 1px solid ${cor}; z-index: 9999; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.5); 
        font-family: 'Poppins', sans-serif;
        transition: opacity 0.5s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 500); }, 3500);
}

// ==========================================
// 2. MUDANÇAS NO MENU & AUTO-PREENCHIMENTO
// ==========================================
auth.onAuthStateChanged(user => {
    const navConta = document.getElementById('nav-conta');
    const navLogout = document.getElementById('nav-logout');

    if (user) {
        if (navConta) { navConta.innerText = "Meu Perfil"; navConta.href = "perfil.html"; }
        if (navLogout) navLogout.style.display = "inline-block";

        database.ref('clientes/' + user.uid).once('value').then(snapshot => {
            const dados = snapshot.val();
            if (dados) {
                const inputNome = document.getElementById('nome');
                const inputZap = document.getElementById('whatsapp');
                if (inputNome) { inputNome.value = dados.nome; inputNome.readOnly = true; }
                if (inputZap) { inputZap.value = dados.whatsapp; inputZap.readOnly = true; }
            }
        });
    } else {
        if (navConta) { navConta.innerText = "Minha Conta"; navConta.href = "login.html"; }
        if (navLogout) navLogout.style.display = "none";
    }
});

function fazerLogout() { auth.signOut().then(() => { window.location.href = "index.html"; }); }

const menuToggle = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');
if(menuToggle && navLinks) menuToggle.addEventListener('click', () => { navLinks.classList.toggle('active'); });

// ==========================================
// 3. MOTOR DE ETAPAS (WIZARD - TIPO TINDER)
// ==========================================
window.avancarPasso = function(passoAtual) {
    if(passoAtual === 1) {
        const nome = document.getElementById('nome').value;
        const zap = document.getElementById('whatsapp').value;
        if(nome.trim() === "" || zap.trim() === "") return mostrarAviso("⚠️ Preencha o seu nome e WhatsApp!", "var(--perigo)");
        trocarTela(1, 2, "Profissional & Serviço");
    }
    else if(passoAtual === 2) {
        if(!window.barbeiroSelecionado) return mostrarAviso("⚠️ Clique no profissional desejado!", "var(--perigo)");
        if(window.servicosSelecionados.length === 0) return mostrarAviso("⚠️ Escolha pelo menos um serviço!", "var(--perigo)");
        trocarTela(2, 3, "Data & Hora");
    }
    else if(passoAtual === 3) {
        const data = document.getElementById('data').value;
        if(!data || !horarioSelecionado) return mostrarAviso("⚠️ Escolha uma data e um horário disponível!", "var(--perigo)");
        trocarTela(3, 4, "Pronto para Confirmar");
    }
};

window.voltarPasso = function(passoAtual) {
    if(passoAtual === 2) trocarTela(2, 1, "Seus Dados", true);
    if(passoAtual === 3) trocarTela(3, 2, "Profissional & Serviço", true);
    if(passoAtual === 4) trocarTela(4, 3, "Data & Hora", true);
};

function trocarTela(atual, proxima, texto, voltando = false) {
    const blocoAtual = document.getElementById(`bloco-passo-${atual}`);
    const blocoProximo = document.getElementById(`bloco-passo-${proxima}`);
    
    blocoAtual.classList.remove('ativo');
    blocoProximo.style.animation = voltando ? "deslizarEsquerda 0.4s ease forwards" : "deslizarDireita 0.4s ease forwards";
    blocoProximo.classList.add('ativo');

    document.getElementById('progress-text').innerText = texto;
    for(let i = 1; i <= 4; i++) {
        document.getElementById(`step-${i}`).className = i <= proxima ? 'progress-step active' : 'progress-step';
    }
}

// ==========================================
// 4. MOTOR DE SELEÇÃO VISUAL (BARBEIROS E SERVIÇOS)
// ==========================================
const listaHorarios = document.getElementById('lista-horarios');
const inputData = document.getElementById('data');
const horariosDisponiveis = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

let horarioSelecionado = "";
window.barbeiroSelecionado = "";
window.servicosSelecionados = [];
window.servicosDetalhes = [];

const divBarbeiros = document.getElementById('lista-barbeiros-agendar');
if (divBarbeiros) {
    database.ref('barbeiros').on('value', snap => {
        divBarbeiros.innerHTML = "";
        if (!snap.exists()) { divBarbeiros.innerHTML = "<p style='color:var(--texto-cinza);'>Sem profissionais.</p>"; return; }
        snap.forEach(child => {
            const b = child.val();
            const img = b.imagem || "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=150&auto=format&fit=crop"; 
            const div = document.createElement('div');
            div.className = "card-selecao";
            div.innerHTML = `<img src="${img}" alt="${b.nome}"><p>${b.nome}</p>`;
            div.onclick = () => {
                document.querySelectorAll('#lista-barbeiros-agendar .card-selecao').forEach(el => el.classList.remove('ativo'));
                div.classList.add('ativo');
                window.barbeiroSelecionado = b.nome;
                window.buscarHorariosOcupados(); 
            };
            divBarbeiros.appendChild(div);
        });
    });
}

const divServicos = document.getElementById('lista-servicos-agendar');
if (divServicos) {
    database.ref('servicos').on('value', snap => {
        divServicos.innerHTML = "";
        if (!snap.exists()) { divServicos.innerHTML = "<p style='color:var(--texto-cinza);'>Sem serviços cadastrados.</p>"; return; }
        snap.forEach(child => {
            const s = child.val();
            const div = document.createElement('div');
            div.className = "card-servico";
            div.innerHTML = `
                <div><h4>${s.nome}</h4><p>${s.descricao}</p></div>
                <span class="preco">R$ ${parseFloat(s.preco).toFixed(2).replace('.', ',')}</span>
            `;
            div.onclick = () => {
                div.classList.toggle('ativo');
                const textoServico = `${s.nome} (R$ ${parseFloat(s.preco).toFixed(2).replace('.', ',')})`;
                if (div.classList.contains('ativo')) {
                    window.servicosSelecionados.push(s.nome);
                    window.servicosDetalhes.push(textoServico);
                } else {
                    window.servicosSelecionados = window.servicosSelecionados.filter(item => item !== s.nome);
                    window.servicosDetalhes = window.servicosDetalhes.filter(item => item !== textoServico);
                }
            };
            divServicos.appendChild(div);
        });
    });
}

window.buscarHorariosOcupados = function() {
    if (!listaHorarios) return;
    const dataEscolhida = inputData?.value;
    const barbeiroEscolhido = window.barbeiroSelecionado;

    // Se não escolheu data ou barbeiro, pede para escolher
    if (!dataEscolhida || !barbeiroEscolhido) {
        listaHorarios.innerHTML = "<p style='color: var(--dourado); grid-column: span 3; text-align: center; font-size: 0.9rem;'>📅 Escolha a data.</p>";
        return;
    }

    // Mostra mensagem de carregamento
    listaHorarios.innerHTML = "<p style='color: var(--texto-cinza); grid-column: span 3; text-align: center;'>Verificando...</p>";

    // 1. VERIFICA BLOQUEIO DE AGENDA (A nossa Ideia 3)
    database.ref('bloqueios').orderByChild('data').equalTo(dataEscolhida).once('value').then(snapBloqueio => {
        if (snapBloqueio.exists()) {
            listaHorarios.innerHTML = "<p style='color: var(--perigo); grid-column: span 3; text-align: center; font-weight: bold;'>❌ Fechado neste dia.</p>";
            return;
        }

        // 2. SE NÃO ESTIVER BLOQUEADO, BUSCA OS HORÁRIOS OCUPADOS
        database.ref('agendamentos').once('value').then(snapshot => {
            const agendamentos = snapshot.val();
            let horariosOcupados = [];
            
            if (agendamentos) {
                Object.values(agendamentos).forEach(ag => {
                    // Pega os horários apenas se a data bater, o barbeiro for o mesmo, e o status NÃO for cancelado
                    if (ag.data === dataEscolhida && ag.barbeiro === barbeiroEscolhido && ag.status !== "Cancelado") {
                        horariosOcupados.push(ag.horario);
                    }
                });
            }
            
            // Chama a função que desenha os botões na tela
            renderizarHorarios(horariosOcupados);
        });
    });
}

function renderizarHorarios(horariosOcupados = []) {
    listaHorarios.innerHTML = "";
    horarioSelecionado = ""; 

    horariosDisponiveis.forEach(hora => {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "btn-horario";
        
        if (horariosOcupados.includes(hora)) {
            btn.innerText = hora + " (Ocupado)";
            btn.disabled = true;
            btn.style.opacity = "0.2";
            btn.style.cursor = "not-allowed";
        } else {
            btn.innerText = hora;
            btn.onclick = () => {
                document.querySelectorAll('.btn-horario:not([disabled])').forEach(b => {
                    b.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    b.style.color = 'var(--texto-cinza)';
                    b.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                });
                btn.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
                btn.style.color = 'var(--dourado)';
                btn.style.borderColor = 'var(--dourado)';
                horarioSelecionado = hora;
            };
        }
        listaHorarios.appendChild(btn);
    });
}

// ==========================================
// 5. ENVIO DO AGENDAMENTO (COM RECORRÊNCIA E UID)
// ==========================================
const formAgendamentoObj = document.getElementById('form-agendamento');
if (formAgendamentoObj) {
    formAgendamentoObj.onsubmit = (e) => {
        e.preventDefault();

        const btnConfirma = document.getElementById('btn-submit-agendar');
        if(btnConfirma) { btnConfirma.innerText = "A PROCESSAR..."; btnConfirma.style.opacity = "0.6"; btnConfirma.style.pointerEvents = "none"; }

        const nome = document.getElementById('nome').value;
        const whatsapp = document.getElementById('whatsapp').value;
        const dataCorte = document.getElementById('data').value;
        const recorrencia = document.getElementById('recorrencia').value;
        
        let servicoTexto = window.servicosDetalhes.join(' + ');
        const upsellPomada = document.getElementById('upsell-pomada');
        if(upsellPomada && upsellPomada.checked) { servicoTexto += " + 📦 Pomada Matte (R$ 45,00)"; }

        let numLimpo = whatsapp.replace(/\D/g, "");
        if (numLimpo.length === 11) { numLimpo = "55" + numLimpo; }

        const novoAgendamento = {
            cliente: nome, whatsapp: numLimpo, barbeiro: window.barbeiroSelecionado, servico: servicoTexto,
            data: dataCorte, horario: horarioSelecionado, status: "Pendente", timestamp: Date.now()
        };
        
        // ✨ A MÁGICA ACONTECE AQUI: Salvando Email e UID! ✨
        if (auth.currentUser) { 
            novoAgendamento.cliente_email = auth.currentUser.email; 
            novoAgendamento.cliente_uid = auth.currentUser.uid; 
        }

        const promessasDeEnvio = [];
        promessasDeEnvio.push(database.ref('agendamentos').push(novoAgendamento));

        let dataFuturaFormatada = "";
        if (recorrencia !== "nenhuma") {
            const diasAdicionais = parseInt(recorrencia);
            const dataOriginal = new Date(dataCorte + "T12:00:00");
            dataOriginal.setDate(dataOriginal.getDate() + diasAdicionais);
            dataFuturaFormatada = dataOriginal.toISOString().split('T')[0];
            const agendamentoFuturo = { ...novoAgendamento }; 
            agendamentoFuturo.data = dataFuturaFormatada;
            agendamentoFuturo.servico += " (Automático)";
            promessasDeEnvio.push(database.ref('agendamentos').push(agendamentoFuturo));
        }

       Promise.all(promessasDeEnvio).then(() => {
            let msg = `✅ *AGENDAMENTO CONFIRMADO!*%0A%0AOlá *${nome}*, o seu horário na *JLukas Barber Shop* foi reservado.%0A%0A✂️ *Serviço:* ${servicoTexto}%0A📅 *Data:* ${dataCorte.split('-').reverse().join('/')}%0A⏰ *Hora:* ${horarioSelecionado}%0A👤 *Barbeiro:* ${window.barbeiroSelecionado}`;
            if (recorrencia !== "nenhuma") { msg += `%0A%0A🔄 *AGENDAMENTO INTELIGENTE:*%0AGarantimos também o mesmo horário para daqui a ${recorrencia} dias (Dia ${dataFuturaFormatada.split('-').reverse().join('/')}).`; }
            
            // ⚠️ LEMBRETE: Troque para o seu WhatsApp se ainda não tiver feito
            const seuNumeroFixo = "5561999999999"; 
            
            window.location.href = `https://api.whatsapp.com/send?phone=${seuNumeroFixo}&text=${msg}`;
        }).catch(error => { 
            mostrarAviso("❌ Erro ao agendar: " + error.message, "var(--perigo)"); 
            if(btnConfirma) { btnConfirma.innerText = "CONFIRMAR"; btnConfirma.style.opacity = "1"; btnConfirma.style.pointerEvents = "auto"; } 
        });
    };
}

window.entrarListaEspera = function() {
    const nome = document.getElementById('nome')?.value; const zap = document.getElementById('whatsapp')?.value; const dataCorte = document.getElementById('data')?.value;
    if(!nome || !zap || !dataCorte) return mostrarAviso("⚠️ Escolha a data no passo anterior.", "var(--perigo)");
    let numLimpo = zap.replace(/\D/g, ""); if (numLimpo.length === 11) numLimpo = "55" + numLimpo;
    database.ref('lista_espera').push({ cliente: nome, whatsapp: numLimpo, data: dataCorte, timestamp: Date.now() }).then(() => mostrarAviso("✅ Entrou na Lista de Espera!"));
};