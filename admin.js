// CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDy1-E_o45AuAbfyzNd8Qg6qS-d-pCFExM",
    authDomain: "barbearia-do-marcos.firebaseapp.com",
    databaseURL: "https://barbearia-do-marcos-default-rtdb.firebaseio.com",
    projectId: "barbearia-do-marcos"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const database = firebase.database();
const auth = firebase.auth();

const EMAIL_DONO = "donobarbearia@gmail.com"; 
let comissaoAtual = 50;
let meuNomeBarbeiro = "";

// Variáveis dos Gráficos
let chartFinanceiro = null;
let chartVolume = null;

// Tenta atualizar a data do painel (se o elemento existir)
const elData = document.getElementById('data-atual');
if(elData) elData.innerText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

// ==========================================
// SISTEMA DE LOGIN INTELIGENTE
// ==========================================
auth.onAuthStateChanged(user => {
    if (user) {
        database.ref('configuracoes/comissao').once('value').then(snap => {
            if(snap.exists()) comissaoAtual = snap.val();
            if(document.getElementById('txt-taxa-comissao')) document.getElementById('txt-taxa-comissao').innerText = comissaoAtual + "%";
            if(document.getElementById('config-comissao')) document.getElementById('config-comissao').value = comissaoAtual;
        });

        if (user.email === EMAIL_DONO) {
            liberarAcesso('Dono', 'Administrador', user.email);
        } else {
            database.ref('barbeiros').orderByChild('email').equalTo(user.email).once('value').then(snap => {
                if (snap.exists()) {
                    const dadosBarbeiro = Object.values(snap.val())[0];
                    liberarAcesso(dadosBarbeiro.nome, 'Barbeiro', user.email);
                } else {
                    document.getElementById('tela-login').style.display = 'flex';
                    document.getElementById('sidebar').style.display = 'none';
                    document.getElementById('main-content').style.display = 'none';
                    alert("⚠️ Acesso restrito à equipe.");
                }
            });
        }
    } else {
        document.getElementById('tela-login').style.display = 'flex';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }
});

function fazerLogin() {
    const e = document.getElementById('email-login').value;
    const s = document.getElementById('senha-login').value;
    auth.signInWithEmailAndPassword(e, s).catch(err => alert("Erro: Verifique e-mail e senha."));
}

function logoutAdmin() { auth.signOut().then(() => window.location.reload()); }

function navegar(idView, elClicado, tituloDaPagina) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(idView).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    elClicado.classList.add('active');
    document.getElementById('page-title').innerText = tituloDaPagina;
}

function liberarAcesso(nome, cargo, emailReal) {
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('main-content').style.display = 'flex';
    
    if(document.getElementById('txt-nome-usuario')) document.getElementById('txt-nome-usuario').innerText = nome;
    if(document.getElementById('txt-cargo-usuario')) document.getElementById('txt-cargo-usuario').innerText = cargo;
    if(document.getElementById('avatar-letra')) document.getElementById('avatar-letra').innerText = nome.charAt(0).toUpperCase();

    const isAdmin = (cargo === 'Administrador');

    if (isAdmin) {
        document.querySelectorAll('.role-admin').forEach(el => el.style.display = 'block');
        meuNomeBarbeiro = "TODOS";
        initDashboardGlobal();
        initEquipeAdmin();
        initServicosAdmin();
        initLojaAdmin(); 
        initFeriadosAdmin();
        initAvaliacoesAdmin();
        initCRMAdmin(); 
    } else {
        document.querySelectorAll('.role-admin').forEach(el => el.style.display = 'none');
        meuNomeBarbeiro = nome;
    }

    initAgendaFinanceiro(isAdmin);
}

// ==========================================
// AGENDA E DASHBOARD DO COLABORADOR
// ==========================================
function initAgendaFinanceiro(isAdmin) {
    database.ref('agendamentos').on('value', snap => {
        const tbody = document.getElementById('tb-agenda') || document.getElementById('tabela-agendamentos');
        const tbClientes = document.getElementById('tb-meus-clientes');
        if(tbody) tbody.innerHTML = "";
        if(tbClientes) tbClientes.innerHTML = "";
        
        let faturamentoBrutoMeu = 0;
        let cortesHoje = 0;
        let estimativaGanhoHoje = 0;
        let proximoEncontrado = false;
        
        const hojeStr = new Date().toISOString().split('T')[0];

        if(!snap.exists()) { 
            if(tbody) tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Nenhum agendamento.</td></tr>"; 
            return; 
        }

        let lista = [];
        snap.forEach(c => lista.push({ key: c.key, ...c.val() }));
        
        const nomeDoLogado = meuNomeBarbeiro ? meuNomeBarbeiro.toLowerCase().trim() : "";

        lista.reverse().forEach(ag => {
            const nomeAgendamentoStr = ag.barbeiro ? ag.barbeiro.toLowerCase().trim() : "";
            const pertenceAMim = isAdmin || nomeAgendamentoStr === nomeDoLogado || nomeAgendamentoStr.includes(nomeDoLogado);

            if (pertenceAMim) {
                const preco = extrairNumeros(ag.servico);
                const éMeuCorte = nomeAgendamentoStr === nomeDoLogado || nomeAgendamentoStr.includes(nomeDoLogado);
                
                if(!isAdmin && éMeuCorte) {
                    if(tbClientes) tbClientes.innerHTML += `<tr><td><i class="fa-solid fa-user" style="color:var(--text-muted); margin-right:10px;"></i> ${ag.cliente || 'Anônimo'}</td><td>${ag.servico}</td><td style="color:var(--primary);">${ag.data}</td></tr>`;

                    if(ag.data === hojeStr || ag.data.includes(new Date().toLocaleDateString('pt-BR').substring(0,5))) {
                        cortesHoje++;
                        if(ag.status === "Pendente") estimativaGanhoHoje += preco * (comissaoAtual/100);
                        
                        if(ag.status === "Pendente" && !proximoEncontrado) {
                            if(document.getElementById('next-nome')) document.getElementById('next-nome').innerText = ag.cliente || "Cliente";
                            if(document.getElementById('next-hora')) document.getElementById('next-hora').innerText = "Hoje às " + ag.horario;
                            if(document.getElementById('next-servico')) document.getElementById('next-servico').innerText = ag.servico.split("(")[0];
                            proximoEncontrado = true;
                        }
                    }
                }

                if (ag.status === "Concluído" && éMeuCorte) { faturamentoBrutoMeu += preco; }

                let badge = 'badge-pendente';
                if(ag.status==='Concluído') badge = 'badge-concluido';
                if(ag.status==='Cancelado') badge = 'badge-cancelado';
                
                // Botões de Ação
                let btnEditar = isAdmin ? `<button class="action-btn" style="color:#60a5fa; background:rgba(96,165,250,0.1);" onclick="abrirEdicao('${ag.key}', '${ag.barbeiro}', '${ag.data}', '${ag.horario}')" title="Editar"><i class="fa-solid fa-pen"></i></button>` : '';
                
                // NOVO: Botão de Lembrete via WhatsApp (Apenas para Pendentes)
                let btnLembrete = '';
                if(ag.status === 'Pendente') {
                    btnLembrete = `<button class="action-btn" style="color:#10b981; background:rgba(16,185,129,0.1); margin-right: 5px;" onclick="enviarLembrete('${ag.cliente}', '${ag.data}', '${ag.horario}', '${ag.servico}')" title="Enviar Lembrete"><i class="fa-brands fa-whatsapp"></i></button>`;
                }

                let tagPagamento = ag.pagamento ? `<br><span style="color:#10b981; font-size:0.8rem; font-weight:bold;">Pago: ${ag.pagamento}</span>` : '';

                if(tbody) {
                    tbody.innerHTML += `
                    <tr>
                        <td><strong>${ag.data}</strong><br><span style="color:var(--text-muted);font-size:0.8rem;">${ag.horario}</span></td>
                        <td>${ag.cliente || 'Anônimo'}<br><span style="color:var(--primary);font-size:0.8rem;">Com: ${ag.barbeiro}</span></td>
                        <td>${ag.servico} ${tagPagamento}</td>
                        <td><span class="badge ${badge}">${ag.status || 'Pendente'}</span></td>
                        <td style="white-space: nowrap;">
                            ${btnLembrete}
                            <button class="action-btn btn-green" onclick="atualizarStatus('${ag.key}', 'Concluído')" title="Concluir"><i class="fa-solid fa-check"></i></button>
                            <button class="action-btn btn-red" onclick="atualizarStatus('${ag.key}', 'Cancelado')" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>
                            ${btnEditar}
                        </td>
                    </tr>`;
                }
            }
        });

        if(document.getElementById('val-prod-bruta')) document.getElementById('val-prod-bruta').innerText = "R$ " + faturamentoBrutoMeu.toFixed(2).replace('.',',');
        if(document.getElementById('val-comissao')) document.getElementById('val-comissao').innerText = "R$ " + (faturamentoBrutoMeu * (comissaoAtual/100)).toFixed(2).replace('.',',');
        
        if(!isAdmin) {
            if(document.getElementById('colab-cortes-hoje')) document.getElementById('colab-cortes-hoje').innerText = cortesHoje;
            if(document.getElementById('colab-ganho-hoje')) document.getElementById('colab-ganho-hoje').innerText = "R$ " + estimativaGanhoHoje.toFixed(2).replace('.',',');
            if(!proximoEncontrado) {
                if(document.getElementById('next-nome')) document.getElementById('next-nome').innerText = "Nenhum no momento";
                if(document.getElementById('next-hora')) document.getElementById('next-hora').innerText = "--:--";
                if(document.getElementById('next-servico')) document.getElementById('next-servico').innerText = "Agenda Livre";
            }
        }
    });
}

// ==========================================
// NOVO: FUNÇÃO DE LEMBRETE WHATSAPP 1-CLICK
// ==========================================
window.enviarLembrete = function(nomeCliente, data, horario, servico) {
    if(!nomeCliente || nomeCliente === 'Anônimo') return alert("⚠️ Cliente não identificado. Impossível enviar lembrete.");

    // Procura o cliente na base de dados para pegar o número
    database.ref('clientes').orderByChild('nome').equalTo(nomeCliente).once('value').then(snap => {
        let telefone = "";
        
        if(snap.exists()) {
            const dados = Object.values(snap.val())[0];
            telefone = dados.whatsapp ? dados.whatsapp.replace(/\D/g, '') : "";
        }

        // Se não encontrar o número automaticamente, pede para o barbeiro digitar
        if(!telefone) {
            telefone = prompt(`Não encontramos o WhatsApp de ${nomeCliente} no banco de dados.\nDigite o número com o indicativo (Ex: 351999999999 ou 5511999999999):`);
            if(!telefone) return; // Cancelou
            telefone = telefone.replace(/\D/g, '');
        }

        // Monta a mensagem profissional
        const texto = `Olá, *${nomeCliente}*! 💈\n\nPassando aqui pela *JLukas Barber Shop* para confirmar o seu agendamento connosco:\n\n📅 *Data:* ${data}\n⏰ *Hora:* ${horario}\n✂️ *Serviço:* ${servico.split('(')[0].trim()}\n\nPodemos confirmar a sua presença?`;
        
        // Abre o WhatsApp
        const link = `https://api.whatsapp.com/send?phone=${telefone.startsWith('55') || telefone.startsWith('351') ? telefone : '55'+telefone}&text=${encodeURIComponent(texto)}`;
        window.open(link, '_blank');
    });
};

// ==========================================
// FORMA DE PAGAMENTO AO CONCLUIR
// ==========================================
function atualizarStatus(id, status) { 
    if(status === 'Concluído') {
        const forma = prompt("Como o cliente pagou?\nDigite: 1 para PIX, 2 para Cartão, 3 para Dinheiro");
        let metodo = "";
        if (forma === "1") metodo = "PIX";
        else if (forma === "2") metodo = "Cartão";
        else if (forma === "3") metodo = "Dinheiro";
        else return alert("Ação cancelada. O agendamento continua Pendente.");

        database.ref('agendamentos/'+id).update({ status: status, pagamento: metodo });
    } else {
        database.ref('agendamentos/'+id).update({ status: status }); 
    }
}

function abrirEdicao(id, barbeiroAtual, dataAtual, horarioAtual) {
    document.getElementById('edit-id').value = id; document.getElementById('edit-data').value = dataAtual; document.getElementById('edit-horario').value = horarioAtual;
    database.ref('barbeiros').once('value').then(snap => {
        const select = document.getElementById('edit-barbeiro'); select.innerHTML = "";
        if(snap.exists()) { snap.forEach(c => { const nomeBarb = c.val().nome; const selecionado = nomeBarb === barbeiroAtual ? 'selected' : ''; select.innerHTML += `<option value="${nomeBarb}" ${selecionado}>${nomeBarb}</option>`; }); }
    });
    document.getElementById('modal-editar').style.display = 'flex';
}

function salvarEdicao() {
    database.ref('agendamentos/' + document.getElementById('edit-id').value).update({ barbeiro: document.getElementById('edit-barbeiro').value, data: document.getElementById('edit-data').value, horario: document.getElementById('edit-horario').value }).then(() => {
        document.getElementById('modal-editar').style.display = 'none'; alert("Transferência Concluída!");
    });
}

// ==========================================
// MÓDULOS ADMIN (DASHBOARD FINANCEIRO GLOBAL)
// ==========================================
function initDashboardGlobal() {
    database.ref('clientes').on('value', snap => {
        if(document.getElementById('dash-cli')) document.getElementById('dash-cli').innerText = snap.exists() ? snap.numChildren() : 0;
    });

    // Escutar Despesas e Agendamentos juntos para calcular o Lucro
    let totalDespesas = 0;
    
    database.ref('despesas').on('value', snapDesp => {
        totalDespesas = 0;
        const divDespesas = document.getElementById('lista-despesas');
        if(divDespesas) divDespesas.innerHTML = "";

        if(snapDesp.exists()) {
            let lista = [];
            snapDesp.forEach(d => lista.push({ key: d.key, ...d.val() }));
            
            // Inverter para mostrar as mais recentes primeiro
            lista.reverse().forEach(d => {
                totalDespesas += d.valor;
                if(divDespesas) {
                    divDespesas.innerHTML += `
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom: 1px solid var(--border);">
                        <span style="color:white;">${d.descricao}</span>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <span style="color:var(--danger)">R$ ${d.valor.toFixed(2).replace('.',',')}</span>
                            <i class="fa-solid fa-trash" style="color:var(--danger); cursor:pointer;" onclick="database.ref('despesas/${d.key}').remove()"></i>
                        </div>
                    </div>`;
                }
            });
        }
        if(document.getElementById('dash-despesas')) document.getElementById('dash-despesas').innerText = "R$ " + totalDespesas.toFixed(2).replace('.',',');

        // Agora escuta os agendamentos para cruzar os dados
        database.ref('agendamentos').on('value', snapAg => {
            let pendentes = 0, concluidos = 0, fatRealizado = 0;
            if(snapAg.exists()) {
                snapAg.forEach(x => { 
                    const ag = x.val(); 
                    const preco = extrairNumeros(ag.servico); 
                    if(ag.status === 'Concluído') { concluidos++; fatRealizado += preco; } 
                });
            }
            
            let lucroLiquido = fatRealizado - totalDespesas;
            
            if(document.getElementById('dash-fat')) document.getElementById('dash-fat').innerText = "R$ " + fatRealizado.toFixed(2).replace('.',','); 
            if(document.getElementById('dash-lucro')) document.getElementById('dash-lucro').innerText = "R$ " + lucroLiquido.toFixed(2).replace('.',',');
            
            // Atualizar Gráfico (Receitas vs Despesas)
            if(document.getElementById('chartFinanceiro')){
                const ctxFin = document.getElementById('chartFinanceiro').getContext('2d'); 
                if(chartFinanceiro) chartFinanceiro.destroy(); 
                chartFinanceiro = new Chart(ctxFin, { 
                    type: 'bar', 
                    data: { 
                        labels: ['Receitas (Faturamento)', 'Despesas (Custos)'], 
                        datasets: [{ 
                            data: [fatRealizado, totalDespesas], 
                            backgroundColor: ['#10b981', '#ef4444'], 
                            borderRadius: 6 
                        }] 
                    }, 
                    options: { 
                        responsive: true, maintainAspectRatio: false, 
                        plugins: { legend: { display: false } }, 
                        scales: { 
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }, 
                            x: { grid: { display: false }, ticks: { color: '#64748b' } } 
                        } 
                    } 
                });
            }
        });
    });
}

function cadastrarDespesa() {
    const desc = document.getElementById('add-desp-desc').value;
    const valor = parseFloat(document.getElementById('add-desp-valor').value);

    if(!desc || isNaN(valor)) return alert("Preenche a descrição e o valor da despesa!");

    database.ref('despesas').push({
        descricao: desc,
        valor: valor,
        data: new Date().toLocaleDateString('pt-BR')
    }).then(() => {
        document.getElementById('add-desp-desc').value = "";
        document.getElementById('add-desp-valor').value = "";
    });
}

function cadastrarBarbeiro() { const n = document.getElementById('add-barb-nome').value, e = document.getElementById('add-barb-email').value, f = document.getElementById('add-barb-foto').value || "https://ui-avatars.com/api/?name="+n; if(n && e) database.ref('barbeiros').push({ nome: n, email: e, foto: f }).then(() => { alert("Barbeiro registado!"); document.getElementById('add-barb-nome').value=''; document.getElementById('add-barb-email').value=''; document.getElementById('add-barb-foto').value=''; }); }
function initEquipeAdmin() { database.ref('barbeiros').on('value', snap => { const div = document.getElementById('lista-equipe-admin'); if(!div) return; div.innerHTML = ""; if(!snap.exists()) return; snap.forEach(c => { const b = c.val(); div.innerHTML += `<div class="list-item" style="background: rgba(0,0,0,0.2); border-radius: 10px;"><div class="user-card"><img src="${b.foto}"><div><h4 style="color:white;">${b.nome}</h4><span style="color:var(--primary);font-size:0.8rem;">${b.email}</span></div></div><button class="action-btn btn-red" onclick="database.ref('barbeiros/${c.key}').remove()"><i class="fa-solid fa-trash"></i></button></div>`; }); }); }
function cadastrarServico() { const n=document.getElementById('add-serv-nome').value, p=document.getElementById('add-serv-preco').value, d=document.getElementById('add-serv-desc').value, i=document.getElementById('add-serv-img').value; if(n&&p) database.ref('servicos').push({nome:n, preco:parseFloat(p), descricao:d, imagem:i}).then(() => alert("Serviço Salvo!")); }
function initServicosAdmin() { database.ref('servicos').on('value', snap => { const tb = document.getElementById('tb-servicos'); if(!tb) return; tb.innerHTML=""; snap.forEach(c => tb.innerHTML += `<tr><td>${c.val().nome}</td><td style="color:var(--primary)">R$ ${parseFloat(c.val().preco).toFixed(2).replace('.',',')}</td><td><button class="action-btn btn-red" onclick="database.ref('servicos/${c.key}').remove()"><i class="fa-solid fa-trash"></i></button></td></tr>`); }); }

// ==========================================
// MÓDULO: LOJA E CONTROLE DE ESTOQUE (INVENTÁRIO)
// ==========================================
function cadastrarProduto() { 
    const n = document.getElementById('add-prod-nome').value; 
    const p = document.getElementById('add-prod-preco').value; 
    const e = document.getElementById('add-prod-estoque') ? document.getElementById('add-prod-estoque').value : 0; 
    const i = document.getElementById('add-prod-img').value; 
    
    if(n && p && i) { 
        database.ref('produtos').push({
            nome: n, 
            preco: parseFloat(p), 
            estoque: parseInt(e) || 0, // Salva o estoque
            imagem: i
        }).then(() => {
            alert("Produto adicionado à Loja!");
            document.getElementById('add-prod-nome').value = '';
            document.getElementById('add-prod-preco').value = '';
            if(document.getElementById('add-prod-estoque')) document.getElementById('add-prod-estoque').value = '0';
            document.getElementById('add-prod-img').value = '';
        }); 
    } 
}

function initLojaAdmin() { 
    database.ref('produtos').on('value', snap => { 
        const tb = document.getElementById('tb-produtos'); 
        if(!tb) return; 
        tb.innerHTML = ""; 
        
        snap.forEach(c => { 
            const p = c.val(); 
            const estoqueAtual = p.estoque || 0;
            
            // Alerta visual de stock baixo
            let alertaEstoque = "";
            if(estoqueAtual <= 2) {
                alertaEstoque = `<br><span style="color: var(--danger); font-size: 0.75rem;"><i class="fa-solid fa-triangle-exclamation"></i> Estoque Baixo!</span>`;
            }

            tb.innerHTML += `
            <tr>
                <td><img src="${p.imagem}" style="width:30px; height:30px; border-radius:4px; vertical-align:middle; margin-right:10px; object-fit:cover;"> ${p.nome} ${alertaEstoque}</td>
                <td style="color:var(--primary)">R$ ${parseFloat(p.preco).toFixed(2).replace('.',',')}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="action-btn" style="width: 25px; height: 25px; background: rgba(255,255,255,0.1);" onclick="mudarEstoque('${c.key}', -1)">-</button>
                        <span style="font-weight: bold; width: 25px; text-align: center;">${estoqueAtual}</span>
                        <button class="action-btn" style="width: 25px; height: 25px; background: rgba(16, 185, 129, 0.2); color: var(--success);" onclick="mudarEstoque('${c.key}', 1)">+</button>
                    </div>
                </td>
                <td><button class="action-btn btn-red" onclick="database.ref('produtos/${c.key}').remove()"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`; 
        }); 
    }); 
}

function mudarEstoque(id, valor) {
    database.ref('produtos/' + id + '/estoque').once('value').then(snap => {
        let atual = snap.val() || 0;
        let novoEstoque = atual + valor;
        if(novoEstoque < 0) novoEstoque = 0; 
        database.ref('produtos/' + id).update({ estoque: novoEstoque });
    });
}

function salvarConfigComissao() { const val = document.getElementById('config-comissao').value; database.ref('configuracoes/comissao').set(parseInt(val)).then(()=>alert("Nova comissão em vigor!")); }
function bloquearData() { const d = document.getElementById('config-data-block').value; if(d) database.ref('bloqueios').push({data:d}).then(()=>alert("Dia fechado!")); }
function initFeriadosAdmin() { database.ref('bloqueios').on('value', snap => { const div = document.getElementById('lista-datas-bloqueadas'); if(!div) return; div.innerHTML=""; snap.forEach(c => div.innerHTML += `<div class="list-item"><span><i class="fa-solid fa-calendar-xmark" style="color:var(--danger)"></i> ${c.val().data.split('-').reverse().join('/')}</span><button class="action-btn btn-red" onclick="database.ref('bloqueios/${c.key}').remove()"><i class="fa-solid fa-trash"></i></button></div>`); }); }
function initAvaliacoesAdmin() { database.ref('avaliacoes').on('value', snap => { const div = document.getElementById('lista-avaliacoes'); if(!div) return; div.innerHTML=""; snap.forEach(c => { const f = c.val(); div.innerHTML += `<div class="card" style="background:rgba(0,0,0,0.2);"><p style="color:var(--warning);font-size:1.2rem;margin-bottom:10px;">${"⭐".repeat(f.nota)}</p><p style="font-style:italic;font-size:0.9rem;">"${f.comentario}"</p><hr style="border-color:var(--border);margin:15px 0;"><small style="color:var(--text-muted)">Cliente: <span style="color:white">${f.cliente}</span><br>Barbeiro: <span style="color:var(--primary)">${f.barbeiro}</span></small></div>`; }); }); }

// ==========================================
// CRM (BASE DE CLIENTES E FIDELIZAÇÃO)
// ==========================================
function initCRMAdmin() {
    database.ref('clientes').on('value', snapClientes => {
        const tb = document.getElementById('tb-clientes') || document.getElementById('tabela-clientes'); 
        if(!tb) return;
        
        tb.innerHTML = "";
        if(!snapClientes.exists()) { tb.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Nenhum cliente cadastrado.</td></tr>"; return; }
        
        // Puxar todos os agendamentos para contar o número de cortes de cada cliente
        database.ref('agendamentos').once('value').then(snapAg => {
            let contagemCortes = {}; // Mapa para guardar a quantidade de cortes por cliente
            
            if(snapAg.exists()) {
                snapAg.forEach(ag => {
                    let obj = ag.val();
                    // Só conta se o serviço foi marcado como "Concluído"
                    if(obj.status === 'Concluído' && obj.cliente) {
                        let nomeCli = obj.cliente.trim();
                        contagemCortes[nomeCli] = (contagemCortes[nomeCli] || 0) + 1;
                    }
                });
            }

            snapClientes.forEach(child => {
                const cli = child.val();
                const zap = cli.whatsapp || '';
                const linkZap = zap ? `https://api.whatsapp.com/send?phone=55${zap.replace(/\D/g, '')}` : '#';
                
                // Vai procurar a quantidade de cortes deste cliente
                const cortes = contagemCortes[cli.nome ? cli.nome.trim() : ''] || 0;
                
                // Sistema de Selo VIP Automatizado
                let seloVip = "";
                if(cortes >= 5) {
                    seloVip = `<span title="Cliente VIP" style="background: rgba(245, 158, 11, 0.2); color: var(--warning); padding: 4px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 10px; font-weight: bold;"><i class="fa-solid fa-star"></i> VIP</span>`;
                }

                tb.innerHTML += `
                <tr>
                    <td><strong>${cli.nome || 'N/A'}</strong> ${seloVip}</td>
                    <td>${zap}</td>
                    <td>${cli.dataCadastro || 'N/A'}</td>
                    <td style="text-align: center; font-size: 1.1rem; font-weight: bold; color: var(--primary);">${cortes}</td>
                    <td>
                        <a href="${linkZap}" target="_blank" class="action-btn" style="width: auto; padding: 0 10px; background: rgba(16, 185, 129, 0.1); color: var(--success); text-decoration: none;">
                            <i class="fa-brands fa-whatsapp"></i> Chamar
                        </a>
                    </td>
                </tr>`;
            });
        });
    });
}

// ==========================================
// MÓDULO 5: EXPORTAÇÃO DE DADOS (FECHAMENTO)
// ==========================================
window.exportarRelatorioCSV = function() {
    database.ref('agendamentos').once('value').then(snap => {
        if(!snap.exists()) return alert("Não há dados para exportar.");

        // Cabeçalho do ficheiro CSV
        let csvContent = "\uFEFF"; // BOM para o Excel reconhecer acentos (UTF-8)
        csvContent += "Data;Horario;Cliente;Barbeiro;Servico;Preco;Status;Pagamento\n";

        snap.forEach(child => {
            const ag = child.val();
            
            // Limpeza básica dos dados para não quebrar o CSV
            const data = ag.data || "";
            const hora = ag.horario || "";
            const cliente = ag.cliente || "Anonimo";
            const barbeiro = ag.barbeiro || "";
            const servicoRaw = ag.servico || "";
            const status = ag.status || "Pendente";
            const pagamento = ag.pagamento || "N/A";

            // Extrair apenas o valor numérico do serviço para facilitar cálculos no Excel
            const preco = extrairNumeros(servicoRaw).toString().replace('.', ',');
            const nomeServico = servicoRaw.split('(')[0].trim().replace(';', '');

            // Montar a linha
            csvContent += `${data};${hora};${cliente};${barbeiro};${nomeServico};${preco};${status};${pagamento}\n`;
        });

        // Criar o link de download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_JLukas_${dataHoje}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert("📊 Relatório gerado com sucesso! Verifica a tua pasta de transferências.");
    });
};