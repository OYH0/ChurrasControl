// Configuração do banco de dados
const DB_NAME = 'ChurrasControlDB';
const DB_VERSION = 1;
const STORE_MEATS = 'meats';
const STORE_HISTORY = 'history';

// Variáveis globais
let db = null;
let stockChart = null;
let topProductsChart = null;

// Verificação de autenticação
function checkAuth() {
    return localStorage.getItem('authenticated') === 'true';
}

// Redirecionar se não autenticado
if (!checkAuth() && !window.location.pathname.includes('login.html')) {
    window.location.href = 'login.html';
}

// Mostrar conteúdo apenas quando autenticado
document.addEventListener('DOMContentLoaded', function() {
    const authContent = document.querySelector('.authenticated-content');
    const currentUserElement = document.getElementById('currentUser');
    
    if (checkAuth()) {
        if (authContent) authContent.style.display = 'block';
        if (currentUserElement) {
            currentUserElement.textContent = localStorage.getItem('username') || '';
        }
    }
});

// Ajustar altura dos gráficos baseado no tamanho da tela
function adjustChartHeights() {
    const isMobile = window.innerWidth <= 768;
    const stockChartContainer = document.getElementById('stockChartContainer');
    const topProductsChartContainer = document.getElementById('topProductsChartContainer');
    
    if (stockChartContainer) {
        stockChartContainer.style.height = isMobile ? '250px' : '400px';
    }
    
    if (topProductsChartContainer) {
        topProductsChartContainer.style.height = isMobile ? '250px' : '350px';
    }
    
    if (stockChart) stockChart.resize();
    if (topProductsChart) topProductsChart.resize();
}

// Inicializa o banco de dados
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('Erro ao abrir o banco de dados:', event.target.error);
            reject('Erro ao abrir o banco de dados');
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            
            db.transaction(STORE_MEATS, 'readonly').objectStore(STORE_MEATS).count().onsuccess = (e) => {
                if (e.target.result === 0) {
                    populateInitialData().then(resolve).catch(reject);
                } else {
                    resolve(db);
                }
            };
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_MEATS)) {
                const meatStore = db.createObjectStore(STORE_MEATS, { keyPath: 'name' });
                meatStore.createIndex('quantity', 'quantity', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(STORE_HISTORY)) {
                const historyStore = db.createObjectStore(STORE_HISTORY, { keyPath: 'id', autoIncrement: true });
                historyStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Função para adicionar ou atualizar carne no estoque
function saveMeat(meat) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEATS, 'readwrite');
        const store = tx.objectStore(STORE_MEATS);
        
        const request = store.put(meat);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Erro ao salvar carne:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Função para obter todas as carnes do estoque
function getAllMeats() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEATS, 'readonly');
        const store = tx.objectStore(STORE_MEATS);
        
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            console.error('Erro ao obter carnes:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Função para remover carne do estoque
function deleteMeat(meatName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEATS, 'readwrite');
        const store = tx.objectStore(STORE_MEATS);
        
        const request = store.delete(meatName);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Erro ao remover carne:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Função para adicionar registro ao histórico
function addHistoryRecord(record) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_HISTORY, 'readwrite');
        const store = tx.objectStore(STORE_HISTORY);
        
        record.timestamp = new Date().getTime();
        
        const request = store.add(record);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Erro ao adicionar histórico:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Função para obter histórico de movimentações
function getHistory(limit = 20) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_HISTORY, 'readonly');
        const store = tx.objectStore(STORE_HISTORY);
        const index = store.index('timestamp');
        
        const request = index.openCursor(null, 'prev');
        const results = [];
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && results.length < limit) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        
        request.onerror = (event) => {
            console.error('Erro ao obter histórico:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Função para destruir gráficos existentes
function destroyCharts() {
    if (stockChart) {
        stockChart.destroy();
        stockChart = null;
    }
    if (topProductsChart) {
        topProductsChart.destroy();
        topProductsChart = null;
    }
}

// Função para criar os gráficos
async function createCharts() {
    const meatStock = await getAllMeats();
    
    const stockCtx = document.getElementById('stockChart').getContext('2d');
    stockChart = new Chart(stockCtx, {
        type: 'bar',
        data: {
            labels: meatStock.map(item => item.name),
            datasets: [{
                label: 'Quantidade em estoque (kg)',
                data: meatStock.map(item => item.quantity),
                backgroundColor: meatStock.map(item => {
                    if (item.quantity >= 20) return '#2ecc71';
                    if (item.quantity >= 10) return '#f39c12';
                    return '#e74c3c';
                }),
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantidade (kg)',
                        font: { weight: 'bold' }
                    },
                    grid: { color: '#eee' }
                },
                x: {
                    ticks: {
                        autoSkip: true,
                        maxRotation: window.innerWidth <= 768 ? 0 : 45,
                        minRotation: window.innerWidth <= 768 ? 0 : 35,
                        font: { size: window.innerWidth <= 768 ? 10 : 11 }
                    },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });

    const sortedStock = [...meatStock].sort((a, b) => b.quantity - a.quantity);
    const topProducts = sortedStock.slice(0, 5);
    
    const topCtx = document.getElementById('topProductsChart').getContext('2d');
    topProductsChart = new Chart(topCtx, {
        type: 'doughnut',
        data: {
            labels: topProducts.map(item => item.name),
            datasets: [{
                data: topProducts.map(item => item.quantity),
                backgroundColor: [
                    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'
                ],
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: window.innerWidth <= 768 ? 'bottom' : 'right',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: window.innerWidth <= 768 ? 10 : 12 }
                    }
                }
            },
            cutout: window.innerWidth <= 768 ? '55%' : '65%'
        }
    });
}

// Função para atualizar os gráficos
async function updateCharts() {
    destroyCharts();
    await createCharts();
}

// Função para atualizar a exibição do histórico
async function updateHistoryDisplay() {
    const historyContainer = document.getElementById('movementHistory');
    if (!historyContainer) return;
    
    historyContainer.innerHTML = '';
    
    const historyRecords = await getHistory();
    
    historyRecords.forEach(item => {
        const historyElement = document.createElement('div');
        historyElement.className = `history-item ${item.action}`;
        
        let actionText = '';
        let iconClass = '';
        
        const date = new Date(item.timestamp);
        const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateString = date.toLocaleDateString('pt-BR');
        
        if (item.action === 'add') {
            actionText = `Adicionado ${item.quantity}kg de ${item.meatName}`;
            iconClass = 'fas fa-plus';
            if (item.oldQuantity !== null && item.oldQuantity !== undefined) {
                actionText += ` (de ${item.oldQuantity}kg para ${item.oldQuantity + item.quantity}kg)`;
            }
        } else if (item.action === 'remove') {
            actionText = `Removido ${item.quantity}kg de ${item.meatName}`;
            iconClass = 'fas fa-minus';
            if (item.oldQuantity !== null && item.oldQuantity !== undefined) {
                const newQuantity = item.oldQuantity - item.quantity;
                if (newQuantity > 0) {
                    actionText += ` (de ${item.oldQuantity}kg para ${newQuantity}kg)`;
                } else {
                    actionText += ` (item removido do estoque)`;
                }
            }
        } else if (item.action === 'delete') {
            actionText = `Removido ${item.meatName} do estoque`;
            iconClass = 'fas fa-trash';
        }
        
        if (window.innerWidth <= 768) {
            historyElement.innerHTML = `
                <div class="history-action">
                    <div class="history-icon">
                        <i class="${iconClass}"></i>
                    </div>
                    <div>
                        <div>${actionText.split(' (')[0]}</div>
                        <div class="history-time">${dateString} ${timeString}</div>
                    </div>
                </div>
            `;
        } else {
            historyElement.innerHTML = `
                <div class="history-action">
                    <div class="history-icon">
                        <i class="${iconClass}"></i>
                    </div>
                    <div>
                        <div>${actionText}</div>
                        <div class="history-time">${dateString} ${timeString}</div>
                    </div>
                </div>
                <div class="history-details">
                    ${item.action === 'delete' && item.oldQuantity !== undefined ? `Estoque: ${item.oldQuantity}kg` : ''}
                </div>
            `;
        }
        
        historyContainer.appendChild(historyElement);
    });
}

// Função auxiliar para criar botões mobile
function createMobileButton(className, icon, text = '') {
    const button = document.createElement('button');
    button.className = `${className} mobile-btn`;
    button.innerHTML = `<i class="fas ${icon}"></i>${text ? ' ' + text : ''}`;
    return button;
}

// Função para atualizar a tabela (VERSÃO ATUALIZADA)
async function updateTable() {
    const tableBody = document.getElementById('meatTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const meatStock = await getAllMeats();
    
    meatStock.forEach((meat, index) => {
        const row = document.createElement('tr');
        
        // Nome da carne
        const nameCell = document.createElement('td');
        nameCell.textContent = meat.name;
        row.appendChild(nameCell);
        
        // Quantidade atual
        const quantityCell = document.createElement('td');
        quantityCell.textContent = meat.quantity;
        row.appendChild(quantityCell);
        
        // Célula de ações
        const actionsCell = document.createElement('td');
        actionsCell.className = 'action-buttons';
        
        if (window.innerWidth <= 768) {
            // Versão mobile compacta
            const quantityInput = document.createElement('input');
            quantityInput.type = 'number';
            quantityInput.min = '1';
            quantityInput.value = '1';
            quantityInput.className = 'quantity-input compact';
            quantityInput.id = `qty-${index}`;
            
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group-mobile';
            
            // Botões com ícones menores (sem texto em mobile)
            const addButton = createMobileButton('btn-add', 'fa-plus');
            const removeButton = createMobileButton('btn-remove', 'fa-minus');
            const deleteButton = createMobileButton('btn-delete', 'fa-trash');
            
            addButton.onclick = () => adjustQuantity(index, true);
            removeButton.onclick = () => adjustQuantity(index, false);
            deleteButton.onclick = () => removeMeatByIndex(index);
            
            buttonGroup.appendChild(addButton);
            buttonGroup.appendChild(removeButton);
            buttonGroup.appendChild(deleteButton);
            
            actionsCell.appendChild(quantityInput);
            actionsCell.appendChild(buttonGroup);
        } else {
            // Versão desktop completa
            const quantityControl = document.createElement('div');
            quantityControl.className = 'quantity-control';
            
            const quantityInput = document.createElement('input');
            quantityInput.type = 'number';
            quantityInput.min = '1';
            quantityInput.value = '1';
            quantityInput.className = 'quantity-input';
            quantityInput.id = `qty-${index}`;
            
            const addButton = createMobileButton('btn-add', 'fa-plus', 'Adicionar');
            const removeButton = createMobileButton('btn-remove', 'fa-minus', 'Remover');
            const deleteButton = createMobileButton('btn-delete', 'fa-trash', 'Remover Item');
            
            addButton.onclick = () => adjustQuantity(index, true);
            removeButton.onclick = () => adjustQuantity(index, false);
            deleteButton.onclick = () => removeMeatByIndex(index);
            
            quantityControl.appendChild(quantityInput);
            quantityControl.appendChild(addButton);
            quantityControl.appendChild(removeButton);
            
            actionsCell.appendChild(quantityControl);
            actionsCell.appendChild(deleteButton);
        }
        
        row.appendChild(actionsCell);
        tableBody.appendChild(row);
    });
    
    await updateCharts();
}

// Função para ajustar a quantidade
async function adjustQuantity(index, isAdd) {
    const quantityInput = document.getElementById(`qty-${index}`);
    const quantity = parseFloat(quantityInput.value) || 1;
    
    if (quantity <= 0) {
        alert('Por favor, insira uma quantidade válida maior que zero.');
        return;
    }
    
    const meatStock = await getAllMeats();
    const meat = meatStock[index];
    
    if (isAdd) {
        const oldQuantity = meat.quantity;
        meat.quantity += quantity;
        
        await saveMeat(meat);
        await addHistoryRecord({
            action: 'add',
            meatName: meat.name,
            quantity: quantity,
            oldQuantity: oldQuantity
        });
        
        quantityInput.parentElement.classList.add('pulse');
        setTimeout(() => {
            quantityInput.parentElement.classList.remove('pulse');
        }, 1500);
    } else {
        if (meat.quantity >= quantity) {
            const oldQuantity = meat.quantity;
            meat.quantity -= quantity;
            
            await addHistoryRecord({
                action: 'remove',
                meatName: meat.name,
                quantity: quantity,
                oldQuantity: oldQuantity
            });
            
            if (meat.quantity <= 0) {
                await deleteMeat(meat.name);
            } else {
                await saveMeat(meat);
            }
        } else {
            alert('Quantidade insuficiente em estoque.');
            return;
        }
    }
    
    await updateTable();
    await updateHistoryDisplay();
}

// Função para remover carne pelo índice
async function removeMeatByIndex(index) {
    const meatStock = await getAllMeats();
    const meat = meatStock[index];
    
    if (confirm(`Tem certeza que deseja remover ${meat.name} do estoque?`)) {
        await addHistoryRecord({
            action: 'delete',
            meatName: meat.name,
            quantity: 0,
            oldQuantity: meat.quantity
        });
        
        await deleteMeat(meat.name);
        await updateTable();
        await updateHistoryDisplay();
    }
}

// Função para popular o banco de dados com dados iniciais
async function populateInitialData() {
    const initialData = [
        { name: 'Alcatra com maminha', quantity: 10 },
        { name: 'Capa de Filé', quantity: 62 },
        { name: 'Contra Filé', quantity: 4 },
        { name: 'Costelão bovino', quantity: 10 },
        { name: 'Costela suína', quantity: 8 },
        { name: 'Picanha bovina', quantity: 29 },
        { name: 'Picanha suína', quantity: 4 },
        { name: 'Coxão mole', quantity: 5 },
        { name: 'Fraldinha', quantity: 13 },
        { name: 'Cupim', quantity: 10 },
        { name: 'Coração', quantity: 19 },
        { name: 'Coxa com sobrecoxa', quantity: 54 },
        { name: 'Filé de frango', quantity: 26 },
        { name: 'Maminha da alcatra', quantity: 16 },
        { name: 'Linguiça apimentada', quantity: 3 },
        { name: 'Linguiça de frango', quantity: 1 },
        { name: 'Linguiça mista', quantity: 3 }
    ];
    
    const tx = db.transaction(STORE_MEATS, 'readwrite');
    const store = tx.objectStore(STORE_MEATS);
    
    initialData.forEach(meat => {
        store.put(meat);
    });
    
    await addHistoryRecord({
        action: 'add',
        meatName: 'Estoque Inicial',
        quantity: 0,
        oldQuantity: null
    });
    
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
}

// Inicializa a aplicação quando a página carrega
async function initializeApp() {
    try {
        if (!checkAuth()) {
            window.location.href = 'login.html';
            return;
        }

        const currentUserElement = document.getElementById('currentUser');
        if (currentUserElement) {
            currentUserElement.textContent = localStorage.getItem('username') || '';
        }

        const hamburger = document.querySelector('.hamburger-menu');
        const mobileNav = document.getElementById('mobileNav');
        const menuOverlay = document.getElementById('menuOverlay');

        if (hamburger && mobileNav && menuOverlay) {
            hamburger.addEventListener('click', function() {
                mobileNav.classList.toggle('active');
                menuOverlay.classList.toggle('active');
            });

            menuOverlay.addEventListener('click', function() {
                mobileNav.classList.remove('active');
                this.classList.remove('active');
            });
        }

        document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);

        await initDB();
        adjustChartHeights();
        await updateTable();
        await updateHistoryDisplay();
    } catch (error) {
        console.error('Erro ao inicializar a aplicação:', error);
        alert('Ocorreu um erro ao carregar a aplicação. Por favor, recarregue a página.');
    }
}

// Redimensiona os gráficos quando a janela é redimensionada
window.addEventListener('resize', function() {
    adjustChartHeights();
    if (stockChart) stockChart.resize();
    if (topProductsChart) topProductsChart.resize();
});

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', initializeApp);