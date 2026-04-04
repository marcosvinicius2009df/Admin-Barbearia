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
        initCRMAdmin(); // NOVO: Inicia a gestão de clientes
        
        // navegar('view-dashboard', document.querySelectorAll('.nav-item')[4], 'Visão Estratégica');
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
                let btnEditar = isAdmin ? `<button class="action-btn" style="color:#60a5fa; background:rgba(96,165,250,0.1);" onclick="abrirEdicao('${ag.key}', '${ag.barbeiro}', '${ag.data}', '${ag.horario}')"><i class="fa-solid fa-pen"></i></button>` : '';

                // NOVO: Mostra a tag de pagamento se existir
                let tagPagamento = ag.pagamento ? `<br><span style="color:#10b981; font-size:0.8rem; font-weight:bold;">Pago: ${ag.pagamento}</span>` : '';

                if(tbody) {
                    tbody.innerHTML += `
                    <tr>
                        <td><strong>${ag.data}</strong><br><span style="color:var(--text-muted);font-size:0.8rem;">${ag.horario}</span></td>
                        <td>${ag.cliente || 'Anônimo'}<br><span style="color:var(--primary);font-size:0.8rem;">Com: ${ag.barbeiro}</span></td>
                        <td>${ag.servico} ${tagPagamento}</td>
                        <td><span class="badge ${badge}">${ag.status || 'Pendente'}</span></td>
                        <td style="white-space: nowrap;">
                            <button class="action-btn btn-green" onclick="atualizarStatus('${ag.key}', 'Concluído')"><i class="fa-solid fa-check"></i></button>
                            <button class="action-btn btn-red" onclick="atualizarStatus('${ag.key}', 'Cancelado')"><i class="fa-solid fa-xmark"></i></button>
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

function extrairNumeros(texto) {
    if(!texto) return 0;
    const m = texto.match(/R\$ (\d+,\d{2})/);
    return m ? parseFloat(m[1].replace(',','.')) : 0;
}

// ==========================================
// NOVO: FORMA DE PAGAMENTO AO CONCLUIR
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
// MÓDULOS ADMIN (DASHBOARD, LOJA, EQUIPE)
// ==========================================
function initDashboardGlobal() {
    database.ref('clientes').on('value', snap => {
        if(document.getElementById('dash-cli')) document.getElementById('dash-cli').innerText = snap.exists() ? snap.numChildren() : 0;
    });
    database.ref('agendamentos').on('value', snap => {
        let pendentes = 0, concluidos = 0, fatRealizado = 0, fatEstimado = 0;
        if(snap.exists()) {
            snap.forEach(x => { const ag = x.val(); const preco = extrairNumeros(ag.servico); if(ag.status === 'Pendente') { pendentes++; fatEstimado += preco; } if(ag.status === 'Concluído') { concluidos++; fatRealizado += preco; } });
        }
        if(document.getElementById('dash-fat')) document.getElementById('dash-fat').innerText = "R$ " + fatRealizado.toFixed(2).replace('.',','); 
        if(document.getElementById('dash-projecao')) document.getElementById('dash-projecao').innerText = "R$ " + fatEstimado.toFixed(2).replace('.',',');
        if(document.getElementById('dash-ticket')) document.getElementById('dash-ticket').innerText = "R$ " + (concluidos > 0 ? (fatRealizado / concluidos) : 0).toFixed(2).replace('.',',');
        
        if(document.getElementById('chartFinanceiro')){
            const ctxFin = document.getElementById('chartFinanceiro').getContext('2d'); if(chartFinanceiro) chartFinanceiro.destroy(); chartFinanceiro = new Chart(ctxFin, { type: 'bar', data: { labels: ['Faturamento Real', 'Estimativa'], datasets: [{ data: [fatRealizado, fatEstimado], backgroundColor: ['#10b981', '#d4af37'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }, x: { grid: { display: false }, ticks: { color: '#64748b' } } } } });
        }
        if(document.getElementById('chartVolume')){
            const ctxVol = document.getElementById('chartVolume').getContext('2d'); if(chartVolume) chartVolume.destroy(); chartVolume = new Chart(ctxVol, { type: 'doughnut', data: { labels: ['Concluídos', 'Pendentes'], datasets: [{ data: [concluidos, pendentes], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 0, cutout: '75%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } } } });
        }
    });
}

function cadastrarBarbeiro() { const n = document.getElementById('add-barb-nome').value, e = document.getElementById('add-barb-email').value, f = document.getElementById('add-barb-foto').value || "https://ui-avatars.com/api/?name="+n; if(n && e) database.ref('barbeiros').push({ nome: n, email: e, foto: f }).then(() => { alert("Barbeiro registado!"); document.getElementById('add-barb-nome').value=''; document.getElementById('add-barb-email').value=''; document.getElementById('add-barb-foto').value=''; }); }
function initEquipeAdmin() { database.ref('barbeiros').on('value', snap => { const div = document.getElementById('lista-equipe-admin'); if(!div) return; div.innerHTML = ""; if(!snap.exists()) return; snap.forEach(c => { const b = c.val(); div.innerHTML += `<div class="list-item" style="background: rgba(0,0,0,0.2); border-radius: 10px;"><div class="user-card"><img src="${b.foto}"><div><h4 style="color:white;">${b.nome}</h4><span style="color:var(--primary);font-size:0.8rem;">${b.email}</span></div></div><button class="action-btn btn-red" onclick="database.ref('barbeiros/${c.key}').remove()"><i class="fa-solid fa-trash"></i></button></div>`; }); }); }
function cadastrarServico() { const n=document.getElementById('add-serv-nome').value, p=document.getElementById('add-serv-preco').value, d=document.getElementById('add-serv-desc').value, i=document.getElementById('add-serv-img').value; if(n&&p) database.ref('servicos').push({nome:n, preco:parseFloat(p), descricao:d, imagem:i}).then(() => alert("Serviço Salvo!")); }
function initServicosAdmin() { database.ref('servicos').on('value', snap => { const tb = document.getElementById('tb-servicos'); if(!tb) return; tb.innerHTML=""; snap.forEach(c => tb.innerHTML += `<tr><td>${c.val().nome}</td><td style="color:var(--primary)">R$ ${parseFloat(c.val().preco).toFixed(2).replace('.',',')}</td><td><button class="action-btn btn-red" onclick="database.ref('servicos/${c.key}').remove()"><i class="fa-solid fa-trash"></i></button></td></tr>`); }); }
function cadastrarProduto() { const n = document.getElementById('add-prod-nome').value, p = document.getElementById('add-prod-preco').value, i = document.getElementById('add-prod-img').value; if(n && p && i) { database.ref('produtos').push({nome: n, preco: parseFloat(p), imagem: i}).then(() => alert("Adicionado à Loja!")); } }
function initLojaAdmin() { database.ref('produtos').on('value', snap => { const tb = document.getElementById('tb-produtos'); if(!tb) return; tb.innerHTML = ""; snap.forEach(c => { const p = c.val(); tb.innerHTML += `<tr><td><img src="${p.imagem}" style="width:30px; height:30px; border-radius:4px; vertical-align:middle; margin-right:10px; object-fit:cover;"> ${p.nome}</td><td style="color:var(--primary)">R$ ${parseFloat(p.preco).toFixed(2).replace('.',',')}</td><td><button class="action-btn btn-red" onclick="database.ref('produtos/${c.key}').remove()"><i class="fa-solid fa-trash"></i></button></td></tr>`; }); }); }
function salvarConfigComissao() { const val = document.getElementById('config-comissao').value; database.ref('configuracoes/comissao').set(parseInt(val)).then(()=>alert("Nova comissão em vigor!")); }
function bloquearData() { const d = document.getElementById('config-data-block').value; if(d) database.ref('bloqueios').push({data:d}).then(()=>alert("Dia fechado!")); }
function initFeriadosAdmin() { database.ref('bloqueios').on('value', snap => { const div = document.getElementById('lista-datas-bloqueadas'); if(!div) return; div.innerHTML=""; snap.forEach(c => div.innerHTML += `<div class="list-item"><span><i class="fa-solid fa-calendar-xmark" style="color:var(--danger)"></i> ${c.val().data.split('-').reverse().join('/')}</span><button class="action-btn btn-red" onclick="database.ref('bloqueios/${c.key}').remove()"><i class="fa-solid fa-trash"></i></button></div>`); }); }
function initAvaliacoesAdmin() { database.ref('avaliacoes').on('value', snap => { const div = document.getElementById('lista-avaliacoes'); if(!div) return; div.innerHTML=""; snap.forEach(c => { const f = c.val(); div.innerHTML += `<div class="card" style="background:rgba(0,0,0,0.2);"><p style="color:var(--warning);font-size:1.2rem;margin-bottom:10px;">${"⭐".repeat(f.nota)}</p><p style="font-style:italic;font-size:0.9rem;">"${f.comentario}"</p><hr style="border-color:var(--border);margin:15px 0;"><small style="color:var(--text-muted)">Cliente: <span style="color:white">${f.cliente}</span><br>Barbeiro: <span style="color:var(--primary)">${f.barbeiro}</span></small></div>`; }); }); }

// ==========================================
// NOVO: CRM (BASE DE CLIENTES)
// ==========================================
function initCRMAdmin() {
    database.ref('clientes').on('value', snap => {
        // Tenta achar a tabela pelo ID (ajuste conforme o seu HTML do CRM)
        const tb = document.getElementById('tb-clientes') || document.getElementById('tabela-clientes'); 
        if(!tb) return;
        
        tb.innerHTML = "";
        if(!snap.exists()) { tb.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Nenhum cliente cadastrado.</td></tr>"; return; }
        
        snap.forEach(child => {
            const cli = child.val();
            const zap = cli.whatsapp || '';
            const linkZap = zap ? `https://api.whatsapp.com/send?phone=55${zap.replace(/\D/g, '')}` : '#';
            
            tb.innerHTML += `
            <tr>
                <td><strong>${cli.nome || 'N/A'}</strong></td>
                <td>${zap}</td>
                <td>${cli.dataCadastro || 'N/A'}</td>
                <td>
                    <a href="${linkZap}" target="_blank" style="color: #10b981; text-decoration: none; display:flex; align-items:center; gap:5px;"><i class="fa-brands fa-whatsapp"></i> Chamar</a>
                </td>
            </tr>`;
        });
    });
}