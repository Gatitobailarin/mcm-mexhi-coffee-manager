/**
 * ===============================================================
 * MEXHI COFFEE MANAGER - app.js COMPLETO
 * Sistema de Gestión de Inventarios de Café
 * Version: 2.0 Full Stack
 * Backend: Node.js + SQL Server
 * Frontend: HTML5 + CSS3 + Vanilla JavaScript
 * ===============================================================
 */
// ======================== CONFIGURACIÓN GLOBAL ========================
const CONFIG = {
  API_BASE_URL: 'http://localhost:4000/api',
  APP_NAME: 'Mexhi Coffee Manager',
  VERSION: '2.0',
  DEBUG: true
};

// ======================== ESTADO GLOBAL ========================
const STATE = {
  authToken: localStorage.getItem('mcm_auth_token') || null,
  currentUser: null,
  currentRole: 'admin',
  currentView: 'dashboard',
  isLoading: false,
  editingLoteId: null,
  editingProductId: null,
  editingUserId: null,
  currentPage: 1,
  itemsPerPage: 10,
  
  // Datos en memoria
  lotes: [],
  productos: [],
  usuarios: [],
  alertas: [],
  reportes: [],
  plantillaEtiquetas: [],
  
  // Filtros activos
  filtrosLotes: {},
  filtrosProductos: {},
  filtrosUsuarios: {}
};

// ======================== INICIALIZACIÓN DE LA APP ========================
document.addEventListener('DOMContentLoaded', async function() {
  console.log(`%c${CONFIG.APP_NAME} v${CONFIG.VERSION}`, 'color: #8B5E3C; font-size: 16px; font-weight: bold;');
  
  // Verificar autenticación
  if (STATE.authToken) {
    await validateToken();
  } else {
    showView('login');
  }
  
  setupEventListeners();
});

// ======================== FUNCIONES DE UTILIDAD ========================

/**
 * Llamada centralizada a la API
 */
async function apiCall(endpoint, options = {}) {
  try {
    STATE.isLoading = true;
    showLoading(true);
    
    const headers = {
      'Content-Type': 'application/json',
      ...(STATE.authToken && { 'Authorization': `Bearer ${STATE.authToken}` })
    };
    
    const config = {
      ...options,
      headers: { ...headers, ...options.headers }
    };
    
    console.log(`📤 API Request: ${options.method || 'GET'} ${endpoint}`);
    
    const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        throw new Error('Sesión expirada');
      }
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    
    console.log(`✅ API Response:`, data);
    return { success: true, data: data.data || data, pagination: data.pagination };
  } catch (error) {
    console.error('❌ API Error:', error);
    showToast(error.message, 'error');
    return { success: false, data: [], error: error.message };
  } finally {
    STATE.isLoading = false;
    showLoading(false);
  }
}

/**
 * Mostrar/ocultar loading spinner
 */
function showLoading(show = true) {
  const loaders = document.querySelectorAll('.loading-spinner, .spinner, #globalLoader');
  loaders.forEach(loader => {
    loader.style.display = show ? 'flex' : 'none';
  });
}

/**
 * Mostrar notificación toast
 */
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toastContainer');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  const colors = {
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6'
  };
  
  toast.style.cssText = `
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 280px;
    animation: slideIn 0.3s ease-out;
  `;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <span style="font-size: 18px; font-weight: bold;">${icons[type]}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Formatear fecha
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', { 
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

/**
 * Formatear fecha y hora
 */
function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Generar ID único
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validar email
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Obtener valor de input
 */
function getInputValue(id, defaultValue = '') {
  const element = document.getElementById(id);
  return element ? element.value.trim() : defaultValue;
}

/**
 * Establecer valor de input
 */
function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

// ======================== AUTENTICACIÓN ========================

/**
 * Validar token con el servidor
 */async function handleLogin(e) {
  e.preventDefault();
  
  // Obtener inputs con los IDs CORRECTOS de tu HTML
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  
  // Verificar que existen
  if (!emailInput || !passwordInput) {
    console.error('❌ HTML ERROR: No se encontraron inputs');
    alert('Error: Inputs no encontrados en HTML');
    return;
  }
  
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  // Validar campos
  if (!email || !password) {
    alert('Por favor completa email y contraseña');
    return;
  }
  
  try {
    console.log('📤 API Request: POST /auth/login');
    
    // Determinar URL base correcta
    const baseURL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:4000'
      : window.location.origin;
    
    const response = await fetch(baseURL + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    console.log('✅ API Response:', result);
    console.log('RESULTADO COMPLETO:', result);
    
    if (!result.success) {
      alert(result.message || 'Login fallido');
      return;
    }
    
    // Obtener usuario de forma segura
    const user = result.data?.user || result.user || {};
    const token = result.data?.token || result.token;
    
    if (!user || !user.rol) {
      console.error('❌ Usuario incompleto:', user);
      alert('Error: Datos de usuario incompletos');
      return;
    }
    
    // Guardar en localStorage
    localStorage.setItem('mcm_token', token);
    localStorage.setItem('mcm_user', JSON.stringify(user));
    
    console.log('✅ Login exitoso:', user);
    
    // Mostrar dashboard
    if (typeof showDashboard === 'function') {
      showDashboard();
    }
    
    alert('¡Bienvenido ' + (user.nombre || user.email) + '!');
    
    // Limpiar formulario
    emailInput.value = '';
    passwordInput.value = '';
    
  } catch (error) {
    console.error('❌ Error login:', error);
    alert('Error de conexión: ' + error.message);
  }
}

// ============================================
// FUNCIÓN showDashboard
// ============================================
function showDashboard() {
  try {
    console.log('🎯 Mostrando dashboard...');
    
    // Ocultar login
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (loginScreen) {
      loginScreen.classList.add('hidden');
      loginScreen.style.display = 'none';
    }
    
    if (mainApp) {
      mainApp.classList.remove('hidden');
      mainApp.style.display = 'flex';
      mainApp.classList.add('active');
    }
    
    // Mostrar nombre del usuario
    const user = JSON.parse(localStorage.getItem('mcm_user') || '{}');
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
      userNameElement.textContent = user.nombre || user.email || 'Usuario';
    }
    
    // Cargar datos del dashboard
    loadDashboardData();
    
    console.log('✅ Dashboard cargado correctamente');
    
  } catch (error) {
    console.error('❌ Error mostrando dashboard:', error);
    alert('Error: ' + error.message);
  }
}

// ============================================
// FUNCIÓN loadDashboardData
// ============================================
async function loadDashboardData() {
  try {
    console.log('📊 Cargando datos del dashboard...');
    
    const baseURL = 'http://localhost:4000';
    const token = localStorage.getItem('mcm_token');
    
    // Cargar KPIs
    const kpisRes = await fetch(baseURL + '/api/dashboard/kpis', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const kpis = await kpisRes.json();
    
    if (kpis.success) {
      document.getElementById('activeLots').textContent = kpis.data.lotesActivos || 0;
      document.getElementById('expiringLots').textContent = kpis.data.proximosCaducar || 0;
      document.getElementById('lowStockProducts').textContent = kpis.data.stockBajo || 0;
      document.getElementById('activeAlerts').textContent = kpis.data.alertasPendientes || 0;
    }
    
    // Cargar lotes
    const lotesRes = await fetch(baseURL + '/api/lotes', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const lotes = await lotesRes.json();
    
    if (lotes.success) {
      const table = document.querySelector('#lotesTable tbody');
      if (table) {
        table.innerHTML = lotes.data.slice(0, 5).map(lote => `
          <tr>
            <td>${lote.code || lote.codigo}</td>
            <td>${lote.product || lote.producto}</td>
            <td>${lote.origin || lote.origen}</td>
            <td><span class="status">${lote.status || lote.estado}</span></td>
          </tr>
        `).join('');
      }
    }
    
    console.log('✅ Datos cargados correctamente');
    
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
  }
}

/**
 * Cerrar sesión
 */
function handleLogout() {
  if (confirm('¿Está seguro de cerrar sesión?')) {
    STATE.authToken = null;
    STATE.currentUser = null;
    localStorage.removeItem('mcm_auth_token');
    
    showToast('Sesión cerrada', 'info');
    showView('login');
    document.getElementById('loginForm')?.reset();
  }
}

// ======================== NAVEGACIÓN Y VISTAS ========================

/**
 * Cambiar vista principal
 */
function showView(viewName) {
  const views = document.querySelectorAll('.view, [data-view-content]');
  views.forEach(view => view.classList.remove('active'));
  
  const targetView = document.getElementById(viewName) || 
                     document.querySelector(`[data-view-content="${viewName}"]`);
  
  if (targetView) {
    targetView.classList.add('active');
    
    // Actualizar navegación
    document.querySelectorAll('.nav-link, .nav-item').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"], [data-nav="${viewName}"]`)?.classList.add('active');
    
    // Actualizar breadcrumb
    updateBreadcrumb(viewName);
    
    // Cargar datos específicos
    loadViewData(viewName);
    
    STATE.currentView = viewName;
  }
}

/**
 * Actualizar breadcrumb
 */
function updateBreadcrumb(viewName) {
  const breadcrumbTexts = {
    'dashboard': 'Dashboard',
    'lotes': 'Gestión de Lotes',
    'productos': 'Catálogo de Productos',
    'usuarios': 'Administración de Usuarios',
    'alertas': 'Centro de Alertas',
    'etiquetas': 'Generación de Etiquetas',
    'reportes': 'Centro de Reportes',
    'logs': 'Log de Sesiones',
    'manual': 'Manual de Usuario'
  };
  
  const breadcrumb = document.getElementById('breadcrumbText') || 
                     document.querySelector('.breadcrumb-current');
  
  if (breadcrumb) {
    breadcrumb.textContent = breadcrumbTexts[viewName] || 'Dashboard';
  }
}

/**
 * Cargar datos específicos de cada vista
 */
function loadViewData(viewName) {
  switch(viewName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'lotes':
      loadLotes();
      break;
    case 'productos':
      loadProductos();
      break;
    case 'usuarios':
      loadUsuarios();
      break;
    case 'alertas':
      loadAlertas();
      break;
    case 'etiquetas':
      loadEtiquetas();
      break;
    case 'reportes':
      loadReportes();
      break;
    case 'logs':
      loadSessionLogs();
      break;
    case 'manual':
      loadManual();
      break;
  }
}

/**
 * Actualizar UI según rol
 */
function updateRoleBasedUI() {
  const role = STATE.currentRole;
  
  // Actualizar nombre de usuario
  const userNameEl = document.getElementById('currentUserName') || 
                     document.querySelector('.user-name');
  if (userNameEl && STATE.currentUser) {
    userNameEl.textContent = STATE.currentUser.nombre;
  }
  
  // Mostrar/ocultar elementos según rol
  const roleRestrictedElements = {
    'usuarios': 'admin',
    'logs': 'admin',
    'reportes': 'admin'
  };
  
  Object.entries(roleRestrictedElements).forEach(([element, requiredRole]) => {
    const el = document.querySelector(`[data-role="${element}"], .nav-item-${element}`);
    if (el) {
      el.style.display = role === requiredRole ? 'block' : 'none';
    }
  });
}

// ======================== DASHBOARD ========================

/**
 * Cargar datos del dashboard
 */
async function loadDashboard() {
  try {
    const [kpisRes, alertasRes, lotesRes] = await Promise.all([
      // apiCall('/dashboard/kpis').catch(() => ({ success: false, data: {} })),
      apiCall('/alertas/test/?limit=6&estado=Activo').catch(() => ({ success: false, data: [] })),
      apiCall('/lotes/test/?limit=8&order=fechaTueste DESC').catch(() => ({ success: false, data: [] }))
    ]);
    
    // Actualizar KPIs
    if (kpisRes.success) {
      updateKPIs(kpisRes.data);
    }
    
    // Renderizar alertas
    if (alertasRes.success) {
      renderDashboardAlerts(alertasRes.data);
    }
    
    // Renderizar lotes recientes
    if (lotesRes.success) {
      renderRecentLots(lotesRes.data);
    }
    
    // Inicializar gráficas
    setTimeout(initializeCharts, 300);
  } catch (error) {
    console.error('Dashboard error:', error);
    showToast('Error cargando dashboard', 'error');
  }
}

/**
 * Actualizar KPIs
 */
function updateKPIs(kpis) {
  const kpiMap = {
    'lotesActivos': '.kpi-active-lots',
    'proximosCaducar': '.kpi-expiring-lots',
    'stockBajo': '.kpi-low-stock',
    'alertasActivas': '.kpi-active-alerts'
  };
  
  Object.entries(kpiMap).forEach(([key, selector]) => {
    const el = document.querySelector(selector);
    if (el) {
      el.textContent = kpis[key] || 0;
    }
  });
}

/**
 * Renderizar alertas en dashboard
 */
function renderDashboardAlerts(alertas) {
  const container = document.getElementById('dashboardAlerts') || 
                    document.querySelector('.recent-alerts-list');
  
  if (!container) return;
  
  if (!alertas || alertas.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">No hay alertas pendientes</p>';
    return;
  }
  
  container.innerHTML = alertas.slice(0, 6).map(alerta => {
    const iconMap = {
      'Caducidad': 'clock',
      'Stock Bajo': 'exclamation-triangle',
      'Sistema': 'info-circle'
    };
    
    return `
      <div class="alert-item alert-${alerta.prioridad?.toLowerCase() || 'media'}">
        <div class="alert-icon">
          <i class="fas fa-${iconMap[alerta.tipo] || 'alert-circle'}"></i>
        </div>
        <div class="alert-content">
          <strong>${alerta.tipo}</strong>
          <p>${alerta.mensaje}</p>
          <small>${formatDate(alerta.fecha)}</small>
        </div>
        <span class="priority-badge ${alerta.prioridad?.toLowerCase()}">${alerta.prioridad}</span>
      </div>
    `;
  }).join('');
}

/**
 * Renderizar lotes recientes
 */
function renderRecentLots(lotes) {
  const tbody = document.getElementById('recentLotsBody') || 
                document.querySelector('#dashboardLotsTable tbody');
  
  if (!tbody) return;
  
  if (!lotes || lotes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No hay lotes registrados</td></tr>';
    return;
  }
  
  tbody.innerHTML = lotes.slice(0, 8).map(lote => `
    <tr>
      <td><strong>${lote.codigo}</strong></td>
      <td>${lote.origen}</td>
      <td>${lote.tipoTueste}</td>
      <td>${formatDate(lote.fechaTueste)}</td>
      <td>${formatDate(lote.fechaCaducidad)}</td>
      <td>
        <span class="status-badge status-${lote.estado.toLowerCase().replace(/\s/g, '-')}">
          ${lote.estado}
        </span>
      </td>
    </tr>
  `).join('');
}

/**
 * Inicializar gráficas (Chart.js)
 */
function initializeCharts() {
  // Gráfica de Stock
  const stockCtx = document.getElementById('stockChart');
  if (stockCtx && typeof Chart !== 'undefined') {
    new Chart(stockCtx, {
      type: 'bar',
      data: {
        labels: ['Premium Chiapas', 'Orgánico Veracruz', 'Descafeinado', 'Espresso Blend', 'Colombia Supremo', 'Guatemala Antigua'],
        datasets: [{
          label: 'Stock Actual',
          data: [85, 42, 23, 67, 91, 18],
          backgroundColor: '#8B5E3C',
          borderColor: '#4B3621',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          title: { display: true, text: 'Niveles de Stock' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
  
  // Gráfica de Alertas
  const alertsCtx = document.getElementById('alertsChart');
  if (alertsCtx && typeof Chart !== 'undefined') {
    new Chart(alertsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Caducidad', 'Stock Bajo', 'Sistema'],
        datasets: [{
          data: [5, 3, 2],
          backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6'],
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Alertas por Tipo' }
        }
      }
    });
  }
}

// ======================== GESTIÓN DE LOTES ========================

/**
 * Cargar lista de lotes
 */
async function loadLotes() {
  try {
    const params = new URLSearchParams({
      ...STATE.filtrosLotes,
      pagina: STATE.currentPage,
      paginaSize: STATE.itemsPerPage
    }).toString();
    
    const result = await apiCall(`/lotes?${params}`);
    
    if (result.success) {
      STATE.lotes = result.data;
      renderLotesTable();
      updatePagination(result.pagination);
    }
  } catch (error) {
    showToast('Error cargando lotes', 'error');
  }
}

/**
 * Renderizar tabla de lotes
 */
function renderLotesTable() {
  const tbody = document.getElementById('lotesTableBody') || 
                document.querySelector('#lotesTable tbody');
  
  if (!tbody) return;
  
  if (!STATE.lotes || STATE.lotes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #999;">No hay lotes encontrados</td></tr>';
    return;
  }
  
  tbody.innerHTML = STATE.lotes.map(lote => `
    <tr>
      <td><strong>${lote.codigo}</strong></td>
      <td>${lote.producto}</td>
      <td>${lote.origen}</td>
      <td>${lote.tipoTueste}</td>
      <td>${lote.pesoActual || lote.peso}kg</td>
      <td>${formatDate(lote.fechaTueste)}</td>
      <td>${formatDate(lote.fechaCaducidad)}</td>
      <td>
        <span class="status-badge status-${lote.estado.toLowerCase().replace(/\s/g, '-')}">
          ${lote.estado}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon edit" onclick="editLote('${lote.id}')" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" onclick="deleteLote('${lote.id}')" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
          <button class="btn-icon label" onclick="generateLabel('${lote.id}')" title="Generar etiqueta">
            <i class="fas fa-tag"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Abrir modal para nuevo lote
 */
function openNewLoteModal() {
  STATE.editingLoteId = null;
  document.getElementById('loteFormTitle').textContent = 'Nuevo Lote';
  document.getElementById('loteForm').reset();
  document.getElementById('loteModal').classList.add('active');
}

/**
 * Editar lote
 */
async function editLote(loteId) {
  STATE.editingLoteId = loteId;
  
  const lote = STATE.lotes.find(l => l.id === loteId);
  if (lote) {
    document.getElementById('loteFormTitle').textContent = 'Editar Lote';
    setInputValue('codigo', lote.codigo);
    setInputValue('origen', lote.origen);
    setInputValue('tipoTueste', lote.tipoTueste);
    setInputValue('pesoInicial', lote.pesoInicial);
    setInputValue('pesoActual', lote.pesoActual);
    setInputValue('fechaTueste', lote.fechaTueste?.split('T')[0]);
    setInputValue('fechaCaducidad', lote.fechaCaducidad?.split('T')[0]);
    setInputValue('estado', lote.estado);
    
    document.getElementById('loteModal').classList.add('active');
  }
}

/**
 * Guardar lote (crear o actualizar)
 */
async function saveLote(e) {
  if (e) e.preventDefault();
  
  const loteData = {
    codigo: getInputValue('codigo'),
    origen: getInputValue('origen'),
    tipoTueste: getInputValue('tipoTueste'),
    pesoInicial: parseFloat(getInputValue('pesoInicial')),
    pesoActual: parseFloat(getInputValue('pesoActual')),
    fechaTueste: getInputValue('fechaTueste'),
    fechaCaducidad: getInputValue('fechaCaducidad'),
    estado: getInputValue('estado'),
    producto: getInputValue('producto'),
    notas: getInputValue('notas')
  };
  
  // Validaciones
  if (!loteData.codigo || !loteData.origen || !loteData.fechaTueste) {
    showToast('Por favor completa los campos obligatorios', 'warning');
    return;
  }
  
  try {
    let result;
    
    if (STATE.editingLoteId) {
      // Actualizar
      result = await apiCall(`/lotes/${STATE.editingLoteId}`, {
        method: 'PUT',
        body: JSON.stringify(loteData)
      });
    } else {
      // Crear
      result = await apiCall('/lotes', {
        method: 'POST',
        body: JSON.stringify(loteData)
      });
    }
    
    if (result.success) {
      showToast(`Lote ${STATE.editingLoteId ? 'actualizado' : 'creado'} correctamente`, 'success');
      closeLoteModal();
      loadLotes();
    }
  } catch (error) {
    showToast('Error guardando lote: ' + error.message, 'error');
  }
}

/**
 * Eliminar lote
 */
async function deleteLote(loteId) {
  if (!confirm('¿Está seguro de eliminar este lote?')) return;
  
  try {
    const result = await apiCall(`/lotes/${loteId}`, {
      method: 'DELETE'
    });
    
    if (result.success) {
      showToast('Lote eliminado correctamente', 'success');
      loadLotes();
    }
  } catch (error) {
    showToast('Error eliminando lote', 'error');
  }
}

/**
 * Cerrar modal de lote
 */
function closeLoteModal() {
  document.getElementById('loteModal').classList.remove('active');
  STATE.editingLoteId = null;
}

// ======================== GESTIÓN DE PRODUCTOS ========================

/**
 * Cargar lista de productos
 */
async function loadProductos() {
  try {
    const params = new URLSearchParams({
      ...STATE.filtrosProductos,
      pagina: STATE.currentPage,
      paginaSize: STATE.itemsPerPage
    }).toString();
    
    const result = await apiCall(`/productos?${params}`);
    
    if (result.success) {
      STATE.productos = result.data;
      renderProductosTable();
      updatePagination(result.pagination);
    }
  } catch (error) {
    showToast('Error cargando productos', 'error');
  }
}

/**
 * Renderizar tabla de productos
 */
function renderProductosTable() {
  const tbody = document.getElementById('productosTableBody') || 
                document.querySelector('#productosTable tbody');
  
  if (!tbody) return;
  
  if (!STATE.productos || STATE.productos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #999;">No hay productos registrados</td></tr>';
    return;
  }
  
  tbody.innerHTML = STATE.productos.map(producto => `
    <tr>
      <td><strong>${producto.nombre}</strong></td>
      <td>${producto.origen}</td>
      <td>${producto.tipoGrano}</td>
      <td>${producto.stockActual} / ${producto.stockMinimo}</td>
      <td>
        <span class="status-badge ${producto.stockActual < producto.stockMinimo ? 'status-bajo' : 'status-disponible'}">
          ${producto.stockActual < producto.stockMinimo ? 'Stock Bajo' : 'Disponible'}
        </span>
      </td>
      <td>$${producto.precioUnitario}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon edit" onclick="editProducto('${producto.id}')" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" onclick="deleteProducto('${producto.id}')" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Abrir modal para nuevo producto
 */
function openNewProductoModal() {
  STATE.editingProductId = null;
  document.getElementById('productoFormTitle').textContent = 'Nuevo Producto';
  document.getElementById('productoForm').reset();
  document.getElementById('productoModal').classList.add('active');
}

/**
 * Editar producto
 */
async function editProducto(productoId) {
  STATE.editingProductId = productoId;
  
  const producto = STATE.productos.find(p => p.id === productoId);
  if (producto) {
    document.getElementById('productoFormTitle').textContent = 'Editar Producto';
    setInputValue('nombreProducto', producto.nombre);
    setInputValue('origenProducto', producto.origen);
    setInputValue('tipoGranoProducto', producto.tipoGrano);
    setInputValue('stockActualProducto', producto.stockActual);
    setInputValue('stockMinimoProducto', producto.stockMinimo);
    setInputValue('precioProducto', producto.precioUnitario);
    setInputValue('descripcionProducto', producto.descripcion);
    
    document.getElementById('productoModal').classList.add('active');
  }
}

/**
 * Guardar producto
 */
async function saveProducto(e) {
  if (e) e.preventDefault();
  
  const productoData = {
    nombre: getInputValue('nombreProducto'),
    origen: getInputValue('origenProducto'),
    tipoGrano: getInputValue('tipoGranoProducto'),
    stockActual: parseFloat(getInputValue('stockActualProducto')),
    stockMinimo: parseFloat(getInputValue('stockMinimoProducto')),
    precioUnitario: parseFloat(getInputValue('precioProducto')),
    descripcion: getInputValue('descripcionProducto'),
    presentaciones: getInputValue('presentacionesProducto')?.split(',') || []
  };
  
  if (!productoData.nombre || !productoData.origen) {
    showToast('Por favor completa los campos obligatorios', 'warning');
    return;
  }
  
  try {
    let result;
    
    if (STATE.editingProductId) {
      result = await apiCall(`/productos/${STATE.editingProductId}`, {
        method: 'PUT',
        body: JSON.stringify(productoData)
      });
    } else {
      result = await apiCall('/productos', {
        method: 'POST',
        body: JSON.stringify(productoData)
      });
    }
    
    if (result.success) {
      showToast(`Producto ${STATE.editingProductId ? 'actualizado' : 'creado'} correctamente`, 'success');
      closeProductoModal();
      loadProductos();
    }
  } catch (error) {
    showToast('Error guardando producto: ' + error.message, 'error');
  }
}

/**
 * Eliminar producto
 */
async function deleteProducto(productoId) {
  if (!confirm('¿Está seguro de eliminar este producto?')) return;
  
  try {
    const result = await apiCall(`/productos/${productoId}`, {
      method: 'DELETE'
    });
    
    if (result.success) {
      showToast('Producto eliminado correctamente', 'success');
      loadProductos();
    }
  } catch (error) {
    showToast('Error eliminando producto', 'error');
  }
}

/**
 * Cerrar modal de producto
 */
function closeProductoModal() {
  document.getElementById('productoModal').classList.remove('active');
  STATE.editingProductId = null;
}

// ======================== GESTIÓN DE USUARIOS ========================

/**
 * Cargar lista de usuarios
 */
async function loadUsuarios() {
  try {
    const params = new URLSearchParams({
      ...STATE.filtrosUsuarios,
      pagina: STATE.currentPage,
      paginaSize: STATE.itemsPerPage
    }).toString();
    
    const result = await apiCall(`/usuarios?${params}`);
    
    if (result.success) {
      STATE.usuarios = result.data;
      renderUsuariosTable();
      updatePagination(result.pagination);
    }
  } catch (error) {
    showToast('Error cargando usuarios', 'error');
  }
}

/**
 * Renderizar tabla de usuarios
 */
function renderUsuariosTable() {
  const tbody = document.getElementById('usuariosTableBody') || 
                document.querySelector('#usuariosTable tbody');
  
  if (!tbody) return;
  
  if (!STATE.usuarios || STATE.usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">No hay usuarios registrados</td></tr>';
    return;
  }
  
  tbody.innerHTML = STATE.usuarios.map(usuario => `
    <tr>
      <td><strong>${usuario.nombre}</strong></td>
      <td>${usuario.email}</td>
      <td><span class="role-badge role-${usuario.rol.toLowerCase()}">${usuario.rol}</span></td>
      <td>${usuario.estado === 'activo' ? '✓ Activo' : '✗ Inactivo'}</td>
      <td>${usuario.ultimoLogin ? formatDateTime(usuario.ultimoLogin) : 'Nunca'}</td>
      <td>${formatDate(usuario.fechaCreacion)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon edit" onclick="editUsuario('${usuario.id}')" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" onclick="deleteUsuario('${usuario.id}')" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Abrir modal para nuevo usuario
 */
function openNewUsuarioModal() {
  STATE.editingUserId = null;
  document.getElementById('usuarioFormTitle').textContent = 'Nuevo Usuario';
  document.getElementById('usuarioForm').reset();
  document.getElementById('usuarioModal').classList.add('active');
}

/**
 * Editar usuario
 */
async function editUsuario(usuarioId) {
  STATE.editingUserId = usuarioId;
  
  const usuario = STATE.usuarios.find(u => u.id === usuarioId);
  if (usuario) {
    document.getElementById('usuarioFormTitle').textContent = 'Editar Usuario';
    setInputValue('nombreUsuario', usuario.nombre);
    setInputValue('emailUsuario', usuario.email);
    setInputValue('rolUsuario', usuario.rol);
    setInputValue('estadoUsuario', usuario.estado);
    
    // Ocultar contraseña si es edición
    document.getElementById('passwordUsuarioGroup').style.display = 'none';
    
    document.getElementById('usuarioModal').classList.add('active');
  }
}

/**
 * Guardar usuario
 */
async function saveUsuario(e) {
  if (e) e.preventDefault();
  
  const usuarioData = {
    nombre: getInputValue('nombreUsuario'),
    email: getInputValue('emailUsuario'),
    rol: getInputValue('rolUsuario'),
    estado: getInputValue('estadoUsuario')
  };
  
  if (!STATE.editingUserId) {
    usuarioData.password = getInputValue('passwordUsuario');
    if (!usuarioData.password) {
      showToast('Contraseña requerida para nuevo usuario', 'warning');
      return;
    }
  }
  
  if (!usuarioData.nombre || !usuarioData.email || !usuarioData.rol) {
    showToast('Por favor completa los campos obligatorios', 'warning');
    return;
  }
  
  if (!validateEmail(usuarioData.email)) {
    showToast('Email inválido', 'warning');
    return;
  }
  
  try {
    let result;
    
    if (STATE.editingUserId) {
      result = await apiCall(`/usuarios/${STATE.editingUserId}`, {
        method: 'PUT',
        body: JSON.stringify(usuarioData)
      });
    } else {
      result = await apiCall('/usuarios', {
        method: 'POST',
        body: JSON.stringify(usuarioData)
      });
    }
    
    if (result.success) {
      showToast(`Usuario ${STATE.editingUserId ? 'actualizado' : 'creado'} correctamente`, 'success');
      closeUsuarioModal();
      loadUsuarios();
    }
  } catch (error) {
    showToast('Error guardando usuario: ' + error.message, 'error');
  }
}

/**
 * Eliminar usuario
 */
async function deleteUsuario(usuarioId) {
  if (!confirm('¿Está seguro de eliminar este usuario?')) return;
  
  try {
    const result = await apiCall(`/usuarios/${usuarioId}`, {
      method: 'DELETE'
    });
    
    if (result.success) {
      showToast('Usuario eliminado correctamente', 'success');
      loadUsuarios();
    }
  } catch (error) {
    showToast('Error eliminando usuario', 'error');
  }
}

/**
 * Cerrar modal de usuario
 */
function closeUsuarioModal() {
  document.getElementById('usuarioModal').classList.remove('active');
  STATE.editingUserId = null;
  document.getElementById('passwordUsuarioGroup').style.display = 'block';
}

// ======================== GESTIÓN DE ALERTAS ========================

/**
 * Cargar alertas
 */
async function loadAlertas() {
  try {
    const result = await apiCall('/alertas');
    
    if (result.success) {
      STATE.alertas = result.data;
      renderAlertasTable();
    }
  } catch (error) {
    showToast('Error cargando alertas', 'error');
  }
}

/**
 * Renderizar tabla de alertas
 */
function renderAlertasTable() {
  const tbody = document.getElementById('alertasTableBody') || 
                document.querySelector('#alertasTable tbody');
  
  if (!tbody) return;
  
  if (!STATE.alertas || STATE.alertas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No hay alertas registradas</td></tr>';
    return;
  }
  
  tbody.innerHTML = STATE.alertas.map(alerta => `
    <tr>
      <td><strong>${alerta.tipo}</strong></td>
      <td>${alerta.mensaje}</td>
      <td><span class="priority-badge ${alerta.prioridad?.toLowerCase()}">${alerta.prioridad}</span></td>
      <td><span class="status-badge status-${alerta.estado?.toLowerCase()}">${alerta.estado}</span></td>
      <td>${formatDate(alerta.fecha)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon ${alerta.estado === 'Activo' ? 'check' : 'undo'}" onclick="toggleAlertaEstado('${alerta.id}')" title="${alerta.estado === 'Activo' ? 'Marcar como resuelta' : 'Reabrir'}">
            <i class="fas fa-${alerta.estado === 'Activo' ? 'check' : 'redo'}"></i>
          </button>
          <button class="btn-icon delete" onclick="deleteAlerta('${alerta.id}')" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Cambiar estado de alerta
 */
async function toggleAlertaEstado(alertaId) {
  try {
    const alerta = STATE.alertas.find(a => a.id === alertaId);
    const nuevoEstado = alerta.estado === 'Activo' ? 'Resuelto' : 'Activo';
    
    const result = await apiCall(`/alertas/${alertaId}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: nuevoEstado })
    });
    
    if (result.success) {
      showToast(`Alerta marcada como ${nuevoEstado.toLowerCase()}`, 'success');
      loadAlertas();
    }
  } catch (error) {
    showToast('Error actualizando alerta', 'error');
  }
}

/**
 * Eliminar alerta
 */
async function deleteAlerta(alertaId) {
  if (!confirm('¿Está seguro de eliminar esta alerta?')) return;
  
  try {
    const result = await apiCall(`/alertas/${alertaId}`, {
      method: 'DELETE'
    });
    
    if (result.success) {
      showToast('Alerta eliminada correctamente', 'success');
      loadAlertas();
    }
  } catch (error) {
    showToast('Error eliminando alerta', 'error');
  }
}

// ======================== GENERACIÓN DE ETIQUETAS ========================

/**
 * Cargar plantillas de etiquetas
 */
async function loadEtiquetas() {
  try {
    const result = await apiCall('/etiquetas/plantillas');
    
    if (result.success) {
      STATE.plantillaEtiquetas = result.data;
      renderPlantillasEtiquetas();
    }
  } catch (error) {
    showToast('Error cargando plantillas', 'error');
  }
}

/**
 * Renderizar plantillas disponibles
 */
function renderPlantillasEtiquetas() {
  const container = document.getElementById('plantillasContainer');
  if (!container) return;
  
  if (!STATE.plantillaEtiquetas || STATE.plantillaEtiquetas.length === 0) {
    container.innerHTML = '<p>No hay plantillas disponibles</p>';
    return;
  }
  
  container.innerHTML = STATE.plantillaEtiquetas.map(plantilla => `
    <div class="plantilla-card">
      <h4>${plantilla.nombre}</h4>
      <p><small>Tamaño: ${plantilla.tamaño}</small></p>
      <p><small>${plantilla.campos.length} campos</small></p>
      <p>${plantilla.descripcion}</p>
      <button onclick="selectPlantilla('${plantilla.id}')" class="btn btn-primary">
        Usar esta plantilla
      </button>
    </div>
  `).join('');
}

/**
 * Seleccionar plantilla
 */
function selectPlantilla(plantillaId) {
  const plantilla = STATE.plantillaEtiquetas.find(p => p.id === plantillaId);
  if (plantilla) {
    showToast(`Plantilla seleccionada: ${plantilla.nombre}`, 'info');
    // Mostrar formulario de generación
    document.getElementById('labelGenerationForm').style.display = 'block';
  }
}

/**
 * Generar etiquetas para un lote
 */
async function generateLabel(loteId) {
  const lote = STATE.lotes.find(l => l.id === loteId);
  if (!lote) {
    showToast('Lote no encontrado', 'error');
    return;
  }
  
  try {
    const result = await apiCall(`/etiquetas/generar`, {
      method: 'POST',
      body: JSON.stringify({
        loteId: loteId,
        cantidad: 1,
        formato: 'PDF'
      })
    });
    
    if (result.success) {
      showToast('Etiqueta generada correctamente', 'success');
      // Descargar PDF
      if (result.data.url) {
        window.open(result.data.url, '_blank');
      }
    }
  } catch (error) {
    showToast('Error generando etiqueta: ' + error.message, 'error');
  }
}

// ======================== REPORTES ========================

/**
 * Cargar reportes
 */
async function loadReportes() {
  try {
    const result = await apiCall('/reportes');
    
    if (result.success) {
      STATE.reportes = result.data;
      renderReportesTable();
    }
  } catch (error) {
    showToast('Error cargando reportes', 'error');
  }
}

/**
 * Renderizar tabla de reportes
 */
function renderReportesTable() {
  const tbody = document.getElementById('reportesTableBody') || 
                document.querySelector('#reportesTable tbody');
  
  if (!tbody) return;
  
  if (!STATE.reportes || STATE.reportes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No hay reportes disponibles</td></tr>';
    return;
  }
  
  tbody.innerHTML = STATE.reportes.map(reporte => `
    <tr>
      <td><strong>${reporte.nombre}</strong></td>
      <td>${reporte.descripcion}</td>
      <td>${reporte.frecuencia}</td>
      <td>${reporte.formato}</td>
      <td>${formatDate(reporte.ultimaGeneracion)}</td>
      <td>
        <button class="btn-icon download" onclick="downloadReporte('${reporte.id}')" title="Descargar">
          <i class="fas fa-download"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Descargar reporte
 */
async function downloadReporte(reporteId) {
  try {
    const reporte = STATE.reportes.find(r => r.id === reporteId);
    if (!reporte) return;
    
    const result = await apiCall(`/reportes/${reporteId}/descargar`, {
      method: 'GET'
    });
    
    if (result.success && result.data.url) {
      window.open(result.data.url, '_blank');
      showToast('Descargando reporte...', 'success');
    }
  } catch (error) {
    showToast('Error descargando reporte', 'error');
  }
}

/**
 * Generar nuevo reporte
 */
async function generateReporte(e) {
  if (e) e.preventDefault();
  
  const reporteData = {
    tipo: getInputValue('reporteType'),
    fechaInicio: getInputValue('reporteStartDate'),
    fechaFin: getInputValue('reporteEndDate'),
    formato: getInputValue('reporteFormat')
  };
  
  if (!reporteData.tipo || !reporteData.fechaInicio || !reporteData.fechaFin) {
    showToast('Por favor completa todos los campos', 'warning');
    return;
  }
  
  try {
    const result = await apiCall('/reportes/generar', {
      method: 'POST',
      body: JSON.stringify(reporteData)
    });
    
    if (result.success) {
      showToast('Reporte generado correctamente', 'success');
      
      // Descargar automáticamente
      if (result.data.url) {
        setTimeout(() => window.open(result.data.url, '_blank'), 500);
      }
      
      loadReportes();
    }
  } catch (error) {
    showToast('Error generando reporte: ' + error.message, 'error');
  }
}

// ======================== LOG DE SESIONES ========================

/**
 * Cargar log de sesiones
 */
async function loadSessionLogs() {
  try {
    const result = await apiCall('/logs/sesiones');
    
    if (result.success) {
      renderSessionLogs(result.data);
    }
  } catch (error) {
    showToast('Error cargando logs', 'error');
  }
}

/**
 * Renderizar log de sesiones
 */
function renderSessionLogs(logs) {
  const tbody = document.getElementById('sessionLogsBody') || 
                document.querySelector('#logsTable tbody');
  
  if (!tbody) return;
  
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">No hay registros</td></tr>';
    return;
  }
  
  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${log.usuario}</td>
      <td>${log.email}</td>
      <td>${log.accion}</td>
      <td>${formatDateTime(log.fecha)}</td>
      <td>${log.ip || '-'}</td>
      <td>${log.navegador || '-'}</td>
      <td>
        <span class="status-badge ${log.estado === 'success' ? 'status-exitoso' : 'status-fallido'}">
          ${log.estado === 'success' ? '✓ Exitoso' : '✗ Fallido'}
        </span>
      </td>
    </tr>
  `).join('');
}

// ======================== MANUAL DE USUARIO ========================

/**
 * Cargar manual
 */
function loadManual() {
  const sectionId = getInputValue('manualSection') || 'inicio';
  loadManualSection(sectionId);
}

/**
 * Cargar sección del manual
 */
function loadManualSection(sectionId) {
  const manualContent = document.getElementById('manualContent');
  if (!manualContent) return;
  
  const sections = {
    'inicio': {
      title: 'Primeros Pasos',
      content: `
        <h2>¡Bienvenido a Mexhi Coffee Manager!</h2>
        <p>Este es un sistema completo de gestión de inventarios para café tostado.</p>
        <h3>¿Cómo empezar?</h3>
        <ol>
          <li>Inicia sesión con tu cuenta</li>
          <li>Explora el menú lateral para acceder a los módulos</li>
          <li>Consulta el manual para cada sección</li>
          <li>No dudes en contactar soporte si necesitas ayuda</li>
        </ol>
      `
    },
    'lotes': {
      title: 'Gestión de Lotes',
      content: `
        <h2>Gestión de Lotes</h2>
        <p>En este módulo puedes crear, editar y dar seguimiento a los lotes de café tostado.</p>
        <h3>¿Qué es un lote?</h3>
        <p>Un lote es un conjunto de café tostado que viene del mismo origen y tiene la misma fecha de tueste.</p>
        <h3>Operaciones disponibles</h3>
        <ul>
          <li><strong>Crear lote:</strong> Haz clic en "Nuevo Lote" y completa los datos</li>
          <li><strong>Editar lote:</strong> Haz clic en el ícono de editar en la tabla</li>
          <li><strong>Eliminar lote:</strong> Haz clic en el ícono de eliminar (requiere confirmación)</li>
          <li><strong>Generar etiqueta:</strong> Haz clic en el ícono de etiqueta para imprimir</li>
        </ul>
      `
    },
    'productos': {
      title: 'Catálogo de Productos',
      content: `
        <h2>Gestión de Productos</h2>
        <p>Administra el catálogo de productos café y sus niveles de stock.</p>
        <h3>Información de producto</h3>
        <p>Cada producto incluye:</p>
        <ul>
          <li>Nombre y descripción</li>
          <li>Origen del café</li>
          <li>Tipo de grano</li>
          <li>Stock actual y stock mínimo</li>
          <li>Precio unitario</li>
          <li>Presentaciones disponibles</li>
        </ul>
      `
    },
    'usuarios': {
      title: 'Administración de Usuarios',
      content: `
        <h2>Gestión de Usuarios</h2>
        <p>Solo disponible para administradores.</p>
        <h3>Roles disponibles</h3>
        <ul>
          <li><strong>Administrador:</strong> Acceso completo al sistema</li>
          <li><strong>Almacenista:</strong> Gestión de inventario</li>
          <li><strong>Barista:</strong> Consulta de productos y alertas</li>
        </ul>
      `
    },
    'alertas': {
      title: 'Centro de Alertas',
      content: `
        <h2>Gestión de Alertas</h2>
        <p>El sistema genera alertas automáticas para:</p>
        <ul>
          <li>Lotes próximos a caducar</li>
          <li>Productos con stock bajo</li>
          <li>Eventos del sistema</li>
        </ul>
      `
    },
    'etiquetas': {
      title: 'Generación de Etiquetas',
      content: `
        <h2>Generación de Etiquetas</h2>
        <p>Genera e imprime etiquetas para cada lote.</p>
        <h3>Plantillas disponibles</h3>
        <ul>
          <li>Etiqueta Estándar (5x7cm)</li>
          <li>Etiqueta Premium (7x10cm)</li>
          <li>Etiqueta Compacta (4x5cm)</li>
          <li>Etiqueta Promocional (6x8cm)</li>
        </ul>
      `
    }
  };
  
  const section = sections[sectionId] || sections['inicio'];
  manualContent.innerHTML = section.content;
}

// ======================== FILTROS Y BÚSQUEDA ========================

/**
 * Aplicar filtros a lotes
 */
function applyLotesFilter() {
  STATE.filtrosLotes = {
    origen: getInputValue('filterOrigen'),
    estado: getInputValue('filterEstado'),
    desde: getInputValue('filterDesde'),
    hasta: getInputValue('filterHasta')
  };
  
  STATE.currentPage = 1;
  loadLotes();
}

/**
 * Limpiar filtros
 */
function clearFilters() {
  STATE.filtrosLotes = {};
  STATE.filtrosProductos = {};
  STATE.filtrosUsuarios = {};
  STATE.currentPage = 1;
  
  document.querySelectorAll('.filter-input').forEach(input => input.value = '');
  
  if (STATE.currentView === 'lotes') loadLotes();
  else if (STATE.currentView === 'productos') loadProductos();
  else if (STATE.currentView === 'usuarios') loadUsuarios();
}

// ======================== PAGINACIÓN ========================

/**
 * Actualizar controles de paginación
 */
function updatePagination(pagination) {
  if (!pagination) return;
  
  const container = document.getElementById('paginationContainer');
  if (!container) return;
  
  const totalPages = Math.ceil(pagination.total / STATE.itemsPerPage);
  
  container.innerHTML = `
    <div class="pagination-controls">
      <button onclick="previousPage()" ${STATE.currentPage === 1 ? 'disabled' : ''}>
        ← Anterior
      </button>
      <span>Página ${STATE.currentPage} de ${totalPages}</span>
      <button onclick="nextPage()" ${STATE.currentPage === totalPages ? 'disabled' : ''}>
        Siguiente →
      </button>
    </div>
  `;
}

/**
 * Página anterior
 */
function previousPage() {
  if (STATE.currentPage > 1) {
    STATE.currentPage--;
    loadViewData(STATE.currentView);
  }
}

/**
 * Página siguiente
 */
function nextPage() {
  STATE.currentPage++;
  loadViewData(STATE.currentView);
}

// ======================== EVENT LISTENERS ========================

/**
 * Configurar event listeners
 */
function setupEventListeners() {
  // Login
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  
  // Lotes
  document.getElementById('loteForm')?.addEventListener('submit', saveLote);
  document.getElementById('newLoteBtn')?.addEventListener('click', openNewLoteModal);
  document.getElementById('closeLoteModal')?.addEventListener('click', closeLoteModal);
  document.getElementById('applyLotesFilter')?.addEventListener('click', applyLotesFilter);
  
  // Productos
  document.getElementById('productoForm')?.addEventListener('submit', saveProducto);
  document.getElementById('newProductoBtn')?.addEventListener('click', openNewProductoModal);
  document.getElementById('closeProductoModal')?.addEventListener('click', closeProductoModal);
  
  // Usuarios
  document.getElementById('usuarioForm')?.addEventListener('submit', saveUsuario);
  document.getElementById('newUsuarioBtn')?.addEventListener('click', openNewUsuarioModal);
  document.getElementById('closeUsuarioModal')?.addEventListener('click', closeUsuarioModal);
  
  // Reportes
  document.getElementById('generateReporteBtn')?.addEventListener('click', generateReporte);
  
  // Navegación
  document.querySelectorAll('.nav-link, [data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const viewName = link.getAttribute('data-view');
      if (viewName) showView(viewName);
    });
  });
  
  // Cerrar modales al clickear fuera
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
  
  // Enter en inputs de filtros
  document.querySelectorAll('.filter-input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyLotesFilter();
      }
    });
  });
}

// ======================== UTILIDADES DE UI ========================

/**
 * Abrir modal genérico
 */
function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
}

/**
 * Cerrar modal genérico
 */
function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

/**
 * Copiar al portapapeles
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado al portapapeles', 'success');
  });
}

/**
 * Exportar tabla a CSV
 */
function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  let csv = [];
  const headers = [];
  
  // Obtener encabezados
  table.querySelectorAll('th').forEach(th => {
    headers.push(th.textContent.trim());
  });
  csv.push(headers.join(','));
  
  // Obtener filas
  table.querySelectorAll('tbody tr').forEach(tr => {
    const row = [];
    tr.querySelectorAll('td').forEach(td => {
      row.push(`"${td.textContent.trim()}"`);
    });
    csv.push(row.join(','));
  });
  
  // Descargar
  const csvContent = 'data:text/csv;charset=utf-8,' + csv.join('\n');
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvContent));
  link.setAttribute('download', filename || 'export.csv');
  link.click();
  
  showToast('Tabla exportada a CSV', 'success');
}

/**
 * Imprimir tabla
 */
function printTable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write('<html><head><title>Reporte</title>');
  printWindow.document.write('<link rel="stylesheet" href="style.css">');
  printWindow.document.write('</head><body>');
  printWindow.document.write(table.outerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// Animación de entrada para elementos
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes slideOut {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(20px);
      }
    }
    
    .toast {
      animation: slideIn 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);
}
console.log('%c✓ App.js cargado correctamente', 'color: #22C55E; font-weight: bold;');
