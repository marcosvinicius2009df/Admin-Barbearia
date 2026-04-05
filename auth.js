// Função para criar notificações modernas (Toasts)
function mostrarAviso(mensagem, cor = "var(--dourado)") {
    const toast = document.createElement("div");
    toast.innerText = mensagem;

    // Estilo do aviso (parecido com o design da sua barbearia)
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

    // Faz o aviso sumir sozinho depois de 3.5 segundos
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

const formAuth = document.getElementById('form-auth');
const btnAuth = document.getElementById('btn-auth');
const tituloAuth = document.getElementById('titulo-auth');
const linkAlternar = document.getElementById('link-alternar');
const trocarTexto = document.getElementById('trocar-texto');

// Elementos novos do cadastro
const divNome = document.getElementById('campo-nome');
const divZap = document.getElementById('campo-whatsapp');
const inputNome = document.getElementById('nome-cadastro');
const inputZap = document.getElementById('zap-cadastro');

let modoLogin = true;

// LÓGICA: Alternar entre Login e Cadastro
linkAlternar.onclick = (e) => {
    e.preventDefault();
    modoLogin = !modoLogin;
    
    if (modoLogin) {
        // TELA DE LOGIN
        tituloAuth.innerText = "Entrar na Conta";
        btnAuth.innerText = "ENTRAR";
        trocarTexto.innerText = "Ainda não tem conta?";
        linkAlternar.innerText = "Cadastre-se";
        
        // Esconde campos extras
        divNome.style.display = "none";
        divZap.style.display = "none";
        inputNome.required = false;
        inputZap.required = false;
    } else {
        // TELA DE CADASTRO
        tituloAuth.innerText = "Criar Nova Conta";
        btnAuth.innerText = "CADASTRAR";
        trocarTexto.innerText = "Já tem uma conta?";
        linkAlternar.innerText = "Fazer Login";
        
        // Mostra campos extras
        divNome.style.display = "block";
        divZap.style.display = "block";
        inputNome.required = true;
        inputZap.required = true;
    }
};

// LÓGICA: Envio do Formulário
formAuth.onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    if (modoLogin) {
        // FAZER LOGIN
        auth.signInWithEmailAndPassword(email, senha)
            .then(() => {
                window.location.href = "index.html";
            })
            .catch(error => {
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    mostrarAviso("⚠️ E-mail ou senha incorretos.");
                } else {
                    mostrarAviso("Erro ao entrar: " + error.message);
                }
            });
    } else {
        // FAZER CADASTRO
        const nome = inputNome.value;
        const zap = inputZap.value;

        // Limpa o número de WhatsApp (deixa só os números)
        let numLimpo = zap.replace(/\D/g, "");

        auth.createUserWithEmailAndPassword(email, senha)
            .then((credencial) => {
                const usuarioUID = credencial.user.uid;

                // Salva o Nome e WhatsApp no Banco de Dados atrelado ao UID do cliente
                return database.ref('clientes/' + usuarioUID).set({
                    nome: nome,
                    whatsapp: numLimpo,
                    email: email,
                    dataCadastro: new Date().toLocaleDateString('pt-BR')
                });
            })
            .then(() => {
                mostrarAviso("🎉 Conta criada com sucesso! Bem-vindo(a).");
                window.location.href = "index.html";
            })
            .catch(error => {
                if (error.code === 'auth/email-already-in-use') {
                    mostrarAviso("⚠️ Este e-mail já está cadastrado.");
                } else if (error.code === 'auth/weak-password') {
                    mostrarAviso("⚠️ A senha deve ter pelo menos 6 caracteres.");
                } else {
                    mostrarAviso("Erro ao cadastrar: " + error.message);
                }
            });
    }
};