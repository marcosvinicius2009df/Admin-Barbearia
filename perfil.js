auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('boas-vindas').innerText = `Olá, ${user.email}`;
        carregarMeusAgendamentos(user.uid);
    } else { window.location.href = "login.html"; }
});

function carregarMeusAgendamentos(uid) {
    const container = document.getElementById('meus-agendamentos');
    database.ref('agendamentos').orderByChild('cliente_uid').equalTo(uid).on('value', snap => {
        container.innerHTML = "";
        if (!snap.exists()) { container.innerHTML = "<p>Nenhum agendamento.</p>"; return; }
        
        Object.keys(snap.val()).reverse().forEach(id => {
            const ag = snap.val()[id];
            const div = document.createElement('div');
            div.className = "card-item";
            div.style = "background:#121212; padding:20px; border-radius:10px; border:1px solid #333;";
            
            let btnAvaliar = "";
            if (ag.status === "Concluído" && !ag.avaliado) {
                btnAvaliar = `
                <div id="box-${id}" style="margin-top:15px; border-top:1px solid #333; padding-top:15px;">
                    <p style="color:#d4af37; font-size:0.8rem;">Avalie seu corte:</p>
                    <select id="nota-${id}" style="background:#222; color:white; padding:5px; margin-top:5px;">
                        <option value="5">⭐⭐⭐⭐⭐</option>
                        <option value="4">⭐⭐⭐⭐</option>
                        <option value="3">⭐⭐⭐</option>
                    </select>
                    <input type="text" id="coment-${id}" placeholder="Comentário..." style="width:100%; margin-top:5px; padding:8px;">
                    <button onclick="enviarAvaliacao('${id}', '${ag.barbeiro}', '${ag.cliente}')" style="width:100%; background:#d4af37; border:none; padding:10px; margin-top:10px; cursor:pointer; font-weight:bold;">ENVIAR</button>
                </div>`;
            } else if (ag.avaliado) { btnAvaliar = "<p style='color:green; margin-top:10px;'>✅ Avaliado</p>"; }

            div.innerHTML = `<strong>${ag.data} - ${ag.horario}</strong><br><small>${ag.servico} (${ag.barbeiro})</small><br>
                             <span style="color:${ag.status === 'Concluído' ? 'green' : 'orange'}">${ag.status}</span>${btnAvaliar}`;
            container.appendChild(div);
        });
    });
}

window.enviarAvaliacao = function(agId, barbeiro, cliente) {
    const nota = document.getElementById(`nota-${agId}`).value;
    const coment = document.getElementById(`coment-${agId}`).value;
    database.ref('avaliacoes').push({ nota: parseInt(nota), comentario: coment, barbeiro: barbeiro, cliente: cliente })
    .then(() => {
        database.ref('agendamentos/' + agId).update({ avaliado: true });
        alert("Obrigado!");
    });
}

function logout() { auth.signOut().then(() => window.location.href = "index.html"); }