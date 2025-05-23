function isAdmin() {
  return localStorage.getItem('isAdmin') === 'true';
}

(function() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.error('Firebase não foi inicializado corretamente');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    const APP_CONSTANTS = {
        MIN_QUANTITY: 1,
        MAX_QUANTITY: 1000,
        HISTORY_LIMIT: 20
    };

    const appState = {
        stockChart: null,
        topProductsChart: null,
        meatsUnsubscribe: null,
        historyUnsubscribe: null,
        isInitialized: false
    };

    // =======================
    // Autenticação
    // =======================

    function checkAuth() {
        return localStorage.getItem('authenticated') === 'true';
    }

    function redirectToLogin() {
        window.location.replace('login.html');
    }

    function handleLogout(e) {
        if (e) e.preventDefault();
        firebase.auth().signOut().then(() => {
            cleanupFirestoreListeners();
            clearUserData();
            redirectToLogin();
        }).catch(error => {
            console.error('Erro ao fazer logout:', error);
            alert('Erro ao sair. Tente novamente.');
        });
    }

    function clearUserData() {
        localStorage.removeItem('authenticated');
        localStorage.removeItem('userEmail');
    }

    // =======================
    // Inicialização
    // =======================

    function initializeApp() {
        if (!checkAuth()) {
            redirectToLogin();
            return;
        }

        try {
            setupUI();
            setupEventListeners();
            initializeFirestoreListeners();
            adjustChartHeights();
            appState.isInitialized = true;
        } catch (error) {
            console.error("Erro ao inicializar aplicação:", error);
            alert("Erro ao carregar o aplicativo");
        }
    }

    function setupUI() {
        const authContent = document.querySelector('.authenticated-content');
        const currentUserElement = document.getElementById('currentUser');
        const addMeatBtn = document.getElementById('addMeatBtn');
        const meatTable = document.getElementById('meatTable');
        
        if (authContent) authContent.style.display = 'block';
        if (currentUserElement) {
            currentUserElement.textContent = localStorage.getItem('userEmail') || '';
            if (isAdmin()) {
                currentUserElement.classList.add('admin');
                currentUserElement.title = "Usuário Administrador";
                meatTable.classList.add('admin-view');
            }
        }
        
        if (addMeatBtn) {
            addMeatBtn.style.display = isAdmin() ? 'inline-block' : 'none';
        }
    }

    function setupEventListeners() {
        window.addEventListener('resize', handleWindowResize);

        const hamburger = document.querySelector('.hamburger-menu');
        const mobileNav = document.getElementById('mobileNav');
        const menuOverlay = document.getElementById('menuOverlay');

        if (hamburger && mobileNav && menuOverlay) {
            hamburger.addEventListener('click', toggleMobileMenu);
            menuOverlay.addEventListener('click', closeMobileMenu);
        }

        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('mobileLogoutBtn')?.addEventListener('click', handleLogout);

        setupAddMeatModal();
    }

    // =======================
    // Firestore
    // =======================

    function initializeFirestoreListeners() {
        cleanupFirestoreListeners();

        appState.meatsUnsubscribe = db.collection("meats")
            .onSnapshot(handleMeatsUpdate, error => handleFirestoreError("estoque", error));

        appState.historyUnsubscribe = db.collection("history")
            .orderBy("timestamp", "desc")
            .limit(APP_CONSTANTS.HISTORY_LIMIT)
            .onSnapshot(handleHistoryUpdate, error => handleFirestoreError("histórico", error));

        checkInitialData();
    }

    function cleanupFirestoreListeners() {
        if (appState.meatsUnsubscribe) appState.meatsUnsubscribe();
        if (appState.historyUnsubscribe) appState.historyUnsubscribe();
        appState.meatsUnsubscribe = null;
        appState.historyUnsubscribe = null;
    }

    async function checkInitialData() {
        const snapshot = await db.collection("meats").limit(1).get();
        if (snapshot.empty) await populateInitialData();
    }
/*
    async function populateInitialData() {
        const initialMeats = [
            { name: 'Picanha', quantity: 20 },
            { name: 'Costela', quantity: 30 },
            { name: 'Fraldinha', quantity: 15 },
            { name: 'Linguiça', quantity: 25 },
            { name: 'Coxa de Frango', quantity: 40 }
        ];

        const batch = db.batch();
        initialMeats.forEach(meat => {
            const docRef = db.collection('meats').doc();
            batch.set(docRef, meat);
        });

        await batch.commit();
    }
*/
    async function getAllMeats() {
        const snapshot = await db.collection("meats").get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async function handleMeatsUpdate() {
        await updateTable();
        await updateCharts();
    }

    async function updateTable() {
        const tableBody = document.getElementById('meatTableBody');
        if (!tableBody) return;
    
        const meats = await getAllMeats();
        tableBody.innerHTML = '';
    
        meats.forEach((meat, index) => {
            const row = document.createElement('tr');
    
            const nameCell = document.createElement('td');
            nameCell.textContent = meat.name;
            row.appendChild(nameCell);
    
            const quantityCell = document.createElement('td');
            if (isAdmin()) {
                quantityCell.textContent = meat.quantity;
            } else {
                const quantityDisplay = document.createElement('span');
                quantityDisplay.className = 'quantity-display';
                quantityDisplay.textContent = meat.quantity;
                quantityCell.appendChild(quantityDisplay);
            }
            row.appendChild(quantityCell);
    
            const actionsCell = document.createElement('td');
            actionsCell.className = 'action-buttons';
            actionsCell.appendChild(createActionButtons(index));
            row.appendChild(actionsCell);
    
            tableBody.appendChild(row);
        });
    }

    function createActionButtons(index) {
        const isMobile = window.innerWidth <= 768;
        const container = document.createElement('div');
        container.className = isMobile ? 'button-group-mobile' : 'quantity-control';
    
        if (!isAdmin()) {
            // Para usuários não-admin, apenas mostre a quantidade
            const quantitySpan = document.createElement('span');
            quantitySpan.className = 'quantity-display';
            quantitySpan.id = `qty-display-${index}`;
            container.appendChild(quantitySpan);
            return container;
        }
    
        // Código original para admin continua aqui...
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = APP_CONSTANTS.MIN_QUANTITY.toString();
        quantityInput.step = '1';
        quantityInput.value = '1';
        quantityInput.className = isMobile ? 'quantity-input compact' : 'quantity-input';
        quantityInput.id = `qty-${index}`;
        container.appendChild(quantityInput);
    
        const addButton = createActionButton('add', 'fa-plus', isMobile ? '' : 'Adicionar', () => adjustQuantity(index, true));
        const removeButton = createActionButton('remove', 'fa-minus', isMobile ? '' : 'Remover', () => adjustQuantity(index, false));
        const deleteButton = createActionButton('delete', 'fa-trash', isMobile ? '' : 'Excluir', () => removeMeatByIndex(index));
    
        container.append(addButton, removeButton, deleteButton);
    
        return container;
    }

    function createActionButton(action, icon, text, onClick) {
        const button = document.createElement('button');
        button.className = `btn-${action}`;
        button.innerHTML = `<i class="fas ${icon}"></i>${text ? ' ' + text : ''}`;
        button.addEventListener('click', onClick);
        return button;
    }

    async function adjustQuantity(index, isAdding) {
        const meats = await getAllMeats();
        const meat = meats[index];
        if (!meat) return;

        const input = document.getElementById(`qty-${index}`);
        const qty = parseInt(input.value);

        if (isNaN(qty) || qty < 1) {
            alert("Digite uma quantidade válida.");
            return;
        }

        const newQuantity = isAdding ? meat.quantity + qty : meat.quantity - qty;
        if (newQuantity < 0) {
            alert("Quantidade não pode ser negativa.");
            return;
        }

        await db.collection('meats').doc(meat.id).update({ quantity: newQuantity });
        await db.collection('history').add({
            name: meat.name,
            action: isAdding ? 'add' : 'remove',
            quantity: qty,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function removeMeatByIndex(index) {
        const meats = await getAllMeats();
        const meat = meats[index];
        if (!meat) return;

        await db.collection('meats').doc(meat.id).delete();
        await db.collection('history').add({
            name: meat.name,
            action: 'delete',
            quantity: meat.quantity,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    function handleHistoryUpdate(snapshot) {
        const historyContainer = document.getElementById('movementHistory');
        if (!historyContainer) return;

        historyContainer.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = `history-item ${data.action}`;

            item.innerHTML = `
                <div>
                    <strong>${data.name}</strong> - ${data.quantity} peças
                    <div class="history-details">${data.action === 'add' ? 'Adicionado' : data.action === 'remove' ? 'Removido' : 'Excluído'}</div>
                </div>
                <div class="history-time">${data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString() : ''}</div>
            `;

            historyContainer.appendChild(item);
        });
    }

    // =======================
    // Modal de Adicionar Corte
    // =======================

    function setupAddMeatModal() {
        const addBtn = document.getElementById('addMeatBtn');
        const modal = document.getElementById('addMeatModal');
        const confirm = document.getElementById('confirmAddMeat');
        const cancel = document.getElementById('cancelAddMeat');

        if (!addBtn || !modal) return;

        addBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });

        cancel.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        confirm.addEventListener('click', async () => {
            const name = document.getElementById('newMeatName').value.trim();
            const quantity = parseInt(document.getElementById('newMeatQuantity').value);

            if (!name || isNaN(quantity) || quantity < 1) {
                alert('Preencha todos os campos corretamente');
                return;
            }

            try {
                await db.collection('meats').add({
                    name,
                    quantity
                });

                await db.collection('history').add({
                    name,
                    action: 'add',
                    quantity,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                modal.style.display = 'none';
                document.getElementById('newMeatName').value = '';
                document.getElementById('newMeatQuantity').value = '';
            } catch (error) {
                console.error('Erro ao adicionar novo corte:', error);
                alert('Erro ao adicionar corte');
            }
        });
    }

    // =======================
    // Gráficos
    // =======================

    function handleWindowResize() {
        const chartContainer = document.getElementById('stockChartContainer');
        if (chartContainer) {
            const isMobile = window.innerWidth <= 768;
            chartContainer.style.height = isMobile ? '400px' : '600px';
            chartContainer.style.width = isMobile ? '95%' : '90%';
        }
        
        if (appState.stockChart) {
            appState.stockChart.options.scales.x.ticks.font.size = window.innerWidth <= 768 ? 10 : 12;
            appState.stockChart.update();
        }
    }
    
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
    }

    async function updateCharts() {
        destroyCharts();
        await createCharts();
    }

    function destroyCharts() {
        if (appState.stockChart) {
            appState.stockChart.destroy();
            appState.stockChart = null;
        }
        if (appState.topProductsChart) {
            appState.topProductsChart.destroy();
            appState.topProductsChart = null;
        }
    }

    async function createCharts() {
        const meats = (await getAllMeats()).sort((a, b) => b.quantity - a.quantity);

        const stockCtx = document.getElementById('stockChart')?.getContext('2d');
        if (stockCtx) {
            appState.stockChart = new Chart(stockCtx, {
                type: 'bar',
                data: {
                    labels: meats.map(m => m.name),
                    datasets: [{
                        label: 'Estoque (peças)',
                        data: meats.map(m => m.quantity),
                        backgroundColor: meats.map(m => {
                            if (m.quantity >= 30) return '#2ecc71';
                            if (m.quantity >= 10) return '#f39c12';
                            return '#e74c3c';
                        }),
                        barThickness: 'flex',
                        maxBarThickness: 50,
                        minBarLength: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false,
                            align: 'center',
                            labels: {
                                boxWidth: 12,
                                padding: 20,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            bodyFont: { size: 14 },
                            titleFont: { size: 16 },
                            displayColors: false,
                            callbacks: {
                                label: function(context) {
                                    return `${context.parsed.y} peças`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                autoSkip: false,
                                maxRotation: 45,
                                minRotation: 45,
                                align: 'center',
                                font: {
                                    size: window.innerWidth <= 768 ? 10 : 12
                                }
                            },
                            grid: {
                                display: false,
                                offset: true
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                font: {
                                    size: 12
                                },
                                precision: 0,
                                callback: function(value) {
                                    if (value % 1 === 0) return value;
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)',
                                drawBorder: false
                            }
                        }
                    },
                    layout: {
                        padding: {
                            left: 20,
                            right: 20,
                            top: 20,
                            bottom: 40
                        }
                    }
                }
            });
        }

        
    const historySnapshot = await db.collection("history")
        .where("action", "==", "remove")
        .get();

    const removalTotals = {};
    historySnapshot.forEach(doc => {
        const { name, quantity } = doc.data();
        removalTotals[name] = (removalTotals[name] || 0) + quantity;
    });

    const sortedRemovals = Object.entries(removalTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const topCtx = document.getElementById('topProductsChart')?.getContext('2d');
    if (topCtx) {
        appState.topProductsChart = new Chart(topCtx, {
            type: 'doughnut',
            data: {
                labels: sortedRemovals.map(entry => entry[0]),
                datasets: [{
                    label: 'Mais consumidas',
                    data: sortedRemovals.map(entry => entry[1]),
                    backgroundColor: [
                        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
                        '#1abc9c', '#d35400', '#34495e', '#7f8c8d', '#c0392b'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2,
                    hoverOffset: 10,
                    borderRadius: 6,
                    spacing: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        display: false, // Vamos usar legenda customizada
                    },
                    tooltip: {
                        bodyFont: { size: 14 },
                        titleFont: { size: 16 },
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 20,
                        right: 20,
                        bottom: 20,
                        left: 20
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });

        // Atualizar legenda customizada
        updatePieChartLegend();
    }
}

// Função para criar legenda customizada
function updatePieChartLegend() {
    if (!appState.topProductsChart) return;
    
    const legendContainer = document.getElementById('pieChartLegend');
    if (!legendContainer) return;
    
    const legendItems = [];
    const data = appState.topProductsChart.data;
    
    data.datasets.forEach((dataset, i) => {
        dataset.data.forEach((value, j) => {
            const label = data.labels[j];
            const color = dataset.backgroundColor[j];
            const percentage = Math.round((value / dataset.data.reduce((a, b) => a + b, 0)) * 100);
            
            legendItems.push(`
                <div class="pie-legend-item">
                    <span class="pie-legend-color" style="background-color: ${color};"></span>
                    ${label} (${value} - ${percentage}%)
                </div>
            `);
        });
    });
    
    legendContainer.innerHTML = legendItems.join('');
}

    function toggleMobileMenu() {
        const mobileNav = document.getElementById('mobileNav');
        const menuOverlay = document.getElementById('menuOverlay');
        if (mobileNav && menuOverlay) {
            mobileNav.classList.toggle('active');
            menuOverlay.classList.toggle('active');
        }
    }

    function closeMobileMenu() {
        const mobileNav = document.getElementById('mobileNav');
        const menuOverlay = document.getElementById('menuOverlay');
        if (mobileNav && menuOverlay) {
            mobileNav.classList.remove('active');
            menuOverlay.classList.remove('active');
        }
    }

    function handleFirestoreError(context, error) {
        console.error(`Erro no listener de ${context}:`, error);
        alert(`Erro ao atualizar ${context}. Tente recarregar a página.`);
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

    window.ChurrasControl = {
        adjustQuantity,
        removeMeatByIndex,
        updateCharts
    };
})();
