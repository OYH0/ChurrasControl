// Configuração do banco de dados para usuários
const USER_DB_NAME = 'ChurrasControlAuthDB';
const USER_DB_VERSION = 1;
const STORE_USERS = 'users';

let authDB = null;

// Verifica se é uma extensão causando o problema
if (chrome?.runtime?.lastError) {
  console.log('Ignorando erro de extensão:', chrome.runtime.lastError);
}

// Inicializa o banco de dados de autenticação
function initAuthDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(USER_DB_NAME, USER_DB_VERSION);
        
        request.onerror = (event) => {
            console.error('Erro ao abrir o banco de autenticação:', event.target.error);
            reject('Erro ao abrir o banco de autenticação');
        };
        
        request.onsuccess = (event) => {
            authDB = event.target.result;
            resolve(authDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_USERS)) {
                const store = db.createObjectStore(STORE_USERS, { 
                    keyPath: 'username' 
                });
                
                // Adiciona o usuário admin durante a criação do banco
                const adminUser = {
                    username: 'admin',
                    password: 'admin123',
                    role: 'admin',
                    createdAt: new Date().getTime()
                };
                store.add(adminUser);
            }
        };
    });
}

// Função para autenticar um usuário
function authenticateUser(username, password) {
    return new Promise((resolve, reject) => {
        const tx = authDB.transaction(STORE_USERS, 'readonly');
        const store = tx.objectStore(STORE_USERS);
        
        const request = store.get(username);
        
        request.onsuccess = (event) => {
            const user = event.target.result;
            if (user && user.password === password) {
                localStorage.setItem('authenticated', 'true');
                localStorage.setItem('username', user.username);
                localStorage.setItem('role', user.role);
                window.location.href = 'index.html';
                resolve(user);
            } else {
                reject('Credenciais inválidas');
            }
        };
        
        request.onerror = (event) => {
            reject('Erro ao autenticar usuário');
        };
    });
}

// Função para registrar um novo usuário
function registerUser(username, password) {
    return new Promise((resolve, reject) => {
        if (!username || !username.trim()) {
            reject('Nome de usuário não pode estar vazio');
            return;
        }

        if (!password || password.length < 4) {
            reject('Senha deve ter pelo menos 4 caracteres');
            return;
        }

        const tx = authDB.transaction(STORE_USERS, 'readwrite');
        const store = tx.objectStore(STORE_USERS);
        
        const newUser = {
            username: username.trim(),
            password: password,
            role: 'user',
            createdAt: new Date().getTime()
        };

        const request = store.add(newUser);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            if (event.target.error.name === 'ConstraintError') {
                reject('Nome de usuário já existe');
            } else {
                reject('Erro ao registrar usuário');
            }
        };
    });
}

// Mostrar modal de registro mobile
function showMobileRegisterModal() {
    const modal = document.getElementById('mobileRegisterModal');
    modal.style.display = 'flex';
    
    document.getElementById('confirmRegister').onclick = function() {
        const username = document.getElementById('mobileUsername').value;
        const password = document.getElementById('mobilePassword').value;
        
        if (!username || !username.trim()) {
            alert('Nome de usuário não pode estar vazio');
            return;
        }
        
        if (!password || password.length < 4) {
            alert('Senha deve ter pelo menos 4 caracteres');
            return;
        }
        
        registerUser(username, password)
            .then(() => {
                alert('Usuário registrado com sucesso!');
                modal.style.display = 'none';
                // Limpar campos
                document.getElementById('mobileUsername').value = '';
                document.getElementById('mobilePassword').value = '';
            })
            .catch(err => alert(err));
    };
    
    document.getElementById('cancelRegister').onclick = function() {
        modal.style.display = 'none';
        // Limpar campos
        document.getElementById('mobileUsername').value = '';
        document.getElementById('mobilePassword').value = '';
    };
}

// Manipulação do formulário de login
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await initAuthDB();
        
        const loginForm = document.getElementById('loginForm');
        const registerLink = document.getElementById('registerLink');
        
        if (loginForm) {
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                
                // Limpa mensagens de erro anteriores
                document.getElementById('usernameError').style.display = 'none';
                document.getElementById('passwordError').style.display = 'none';
                
                try {
                    await authenticateUser(username, password);
                } catch (error) {
                    if (error.includes('Credenciais')) {
                        document.getElementById('passwordError').textContent = error;
                        document.getElementById('passwordError').style.display = 'block';
                    } else {
                        alert(error);
                    }
                }
            });
        }
        
        if (registerLink) {
            registerLink.addEventListener('click', function(e) {
                e.preventDefault();
                
                if (window.innerWidth <= 768) {
                    // Usar modal para mobile
                    showMobileRegisterModal();
                } else {
                    // Usar prompt para desktop
                    const username = prompt('Digite um nome de usuário:');
                    if (username && username.trim()) {
                        const password = prompt('Digite uma senha (mínimo 4 caracteres):');
                        if (password && password.length >= 4) {
                            registerUser(username, password)
                                .then(() => alert('Usuário registrado com sucesso!'))
                                .catch(err => alert(err));
                        } else {
                            alert('Senha deve ter pelo menos 4 caracteres');
                        }
                    } else {
                        alert('Nome de usuário não pode estar vazio');
                    }
                }
            });
        }
        
        // Redireciona se já estiver autenticado
        if (localStorage.getItem('authenticated') === 'true' && window.location.pathname.endsWith('login.html')) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Erro ao inicializar autenticação:', error);
        alert('Erro ao inicializar sistema de autenticação');
    }
});

// Função para logout
function logout() {
    localStorage.removeItem('authenticated');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'login.html'; // Redireciona para a página de login
}

// Vincula o evento de clique ao botão de logout
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});