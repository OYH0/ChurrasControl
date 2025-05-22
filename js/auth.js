// Configuração única do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDcpiOE9L-8iASejw9i_wedhrPWCX9CG3A",
  authDomain: "churrascontrol.firebaseapp.com",
  projectId: "churrascontrol",
  storageBucket: "churrascontrol.firebasestorage.app",
  messagingSenderId: "143014612895",
  appId: "1:143014612895:web:9227477c645d7f2144f7aa",
  measurementId: "G-1VVPFK9R1G"
};

// Inicialização única do Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Referências globais
const auth = firebase.auth();
const db = firebase.firestore();

// Função para exibir mensagens de erro
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => element.style.display = 'none', 5000);
  }
}

// Gerenciamento de login
function setupLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('username')?.value.trim();
    const password = document.getElementById('password')?.value;
    
    if (!email || !password) {
      showError('loginError', 'Preencha todos os campos');
      return;
    }

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      
      // Armazena estado de autenticação
      localStorage.setItem('authenticated', 'true');
      localStorage.setItem('userEmail', userCredential.user.email);
      
      // Redirecionamento seguro
      if (window.location.pathname.includes('login.html')) {
        window.location.replace('index.html');
      }
    } catch (error) {
      showError('loginError', getFirebaseErrorMessage(error.code));
    }
  });
}

// Gerenciamento de registro
function setupRegistration() {
  const registerLink = document.getElementById('registerLink');
  const mobileModal = document.getElementById('mobileRegisterModal');
  const confirmBtn = document.getElementById('confirmRegister');
  const cancelBtn = document.getElementById('cancelRegister');

  if (registerLink) {
    registerLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobileModal) mobileModal.style.display = 'flex';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (mobileModal) mobileModal.style.display = 'none';
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const email = document.getElementById('mobileUsername')?.value.trim();
      const password = document.getElementById('mobilePassword')?.value;
      
      if (!password || password.length < 6) {
        showError('registerError', 'Senha precisa ter 6+ caracteres');
        return;
      }
      
      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        localStorage.setItem('authenticated', 'true');
        localStorage.setItem('userEmail', userCredential.user.email);
        
        if (mobileModal) mobileModal.style.display = 'none';
        window.location.replace('index.html');
      } catch (error) {
        showError('registerError', getFirebaseErrorMessage(error.code));
      }
    });
  }
}

// Monitoramento de estado de autenticação
auth.onAuthStateChanged(user => {
  const isLoginPage = window.location.pathname.includes('login.html');
  
  if (user) {
    localStorage.setItem('authenticated', 'true');
    localStorage.setItem('userEmail', user.email);
    
    if (isLoginPage) {
      window.location.replace('index.html');
    }
  } else {
    localStorage.removeItem('authenticated');
    localStorage.removeItem('userEmail');
    
    if (!isLoginPage && !window.location.pathname.includes('register.html')) {
      window.location.replace('login.html');
    }
  }
});

// Mapeamento de erros do Firebase
function getFirebaseErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Email inválido',
    'auth/user-disabled': 'Conta desativada',
    'auth/user-not-found': 'Usuário não encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/email-already-in-use': 'Email já cadastrado',
    'auth/operation-not-allowed': 'Operação não permitida',
    'auth/weak-password': 'Senha muito fraca',
    'auth/network-request-failed': 'Erro de conexão'
  };
  
  return messages[code] || "Erro desconhecido";
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  setupLoginForm();
  setupRegistration();
});