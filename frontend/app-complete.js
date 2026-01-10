

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
  authToken: localStorage.getItem('mcm_token') || null,
  currentUser: JSON.parse(localStorage.getItem('mcm_user')) || null,
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
  plantillaEtiquetas: [
    { "id": 1, "name": "Etiqueta Estándar", "size": "5x7cm", "fields": ["nombre", "origen", "tueste", "fechaCaducidad", "codigoQR"], "description": "Plantilla básica para uso general" },
    { "id": 2, "name": "Etiqueta Premium", "size": "7x10cm", "fields": ["nombre", "origen", "tueste", "peso", "fechaCaducidad", "descripcion", "codigoQR", "logo"], "description": "Plantilla completa con logo y descripción" },
    { "id": 3, "name": "Etiqueta Compacta", "size": "4x5cm", "fields": ["nombre", "fechaCaducidad", "codigoQR"], "description": "Plantilla minimalista para espacios reducidos" },
    { "id": 4, "name": "Etiqueta Promocional", "size": "6x8cm", "fields": ["nombre", "precio", "descuento", "fechaCaducidad", "codigoQR"], "description": "Plantilla para productos en oferta" }
  ],

  // Filtros activos
  filtrosLotes: {},
  filtrosProductos: {},
  filtrosUsuarios: {},

  // Estado UI
  selectedTemplateId: 1
};

// ======================== INICIALIZACIÓN DE LA APP ========================
document.addEventListener('DOMContentLoaded', async function () {
  console.log(`%c${CONFIG.APP_NAME} v${CONFIG.VERSION}`, 'color: #8B5E3C; font-size: 16px; font-weight: bold;');

  setupEventListeners();

  // Verificar autenticación
  if (STATE.authToken) {
    console.log('✅ Sesión restaurada');
    window.mcm_token = STATE.authToken;

    if (STATE.currentUser) {
      STATE.currentRole = STATE.currentUser.rol || 'admin';
    }

    updateRoleBasedUI();
    showView('dashboard');
  } else {
    showView('login');
  }

  // Logout Listener
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

// ======================== FUNCIONES DE UTILIDAD ========================

/**
 * Llamada centralizada a la API
 */

async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    console.log(`📤 API Request: ${method} ${endpoint}`);

    // 🔑 PRIMERO variable global, LUEGO localStorage
    let token = window.mcm_token || localStorage.getItem('mcm_token');

    console.log('🔐 Token fuente:', window.mcm_token ? 'window.mcm_token ✓' : 'localStorage');

    if (!token) {
      console.error('❌ NO HAY TOKEN');
      if (typeof showLogin === 'function') {
        showLogin();
      }
      throw new Error('Sesión expirada');
    }

    // ✅ RESTO DEL CÓDIGO
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const options = {
      method: method,
      headers: headers
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const baseURL = 'http://localhost:4000';
    const url = `${baseURL}/api${endpoint}`;

    const response = await fetch(url, options);

    if (response.status === 401) {
      console.error('❌ 401 - Token rechazado');
      window.mcm_token = null;
      localStorage.removeItem('mcm_token');
      if (typeof showLogin === 'function') {
        showLogin();
      }
      throw new Error('Sesión expirada');
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('❌ API Error:', error);
    throw error;
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
 * Mostrar Feedback Modal (Replaces Toast)
 */
function showToast(message, type = 'info') {
  showFeedback(message, type);
}

function showFeedback(message, type = 'info') {
  const titleEl = document.getElementById('feedbackTitle');
  const msgEl = document.getElementById('feedbackMessage');
  const iconEl = document.getElementById('feedbackIcon');

  // Config
  const config = {
    success: { icon: '<i class="fas fa-check-circle" style="color: #22C55E;"></i>', title: '¡Éxito!' },
    error: { icon: '<i class="fas fa-times-circle" style="color: #EF4444;"></i>', title: 'Error' },
    warning: { icon: '<i class="fas fa-exclamation-circle" style="color: #F59E0B;"></i>', title: 'Atención' },
    info: { icon: '<i class="fas fa-info-circle" style="color: #3B82F6;"></i>', title: 'Información' }
  };

  const cfg = config[type] || config.info;

  titleEl.textContent = cfg.title;
  msgEl.textContent = message;
  iconEl.innerHTML = cfg.icon;

  openModal('feedbackModal');
}

/**
 * Mostrar Confirmación Modal
 */
function showConfirm(message, onConfirm) {
  const msgEl = document.getElementById('confirmationMessage');
  const btnConfirm = document.getElementById('btnConfirmOk');

  msgEl.textContent = message;

  // Clear previous event listeners to avoid stacking
  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.onclick = function () {
    closeModal('confirmationModal');
    onConfirm();
  };

  openModal('confirmationModal');
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
 */

async function handleLogin(e) {
  e.preventDefault();

  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');

  if (!emailInput || !passwordInput) {
    console.error('❌ Inputs no encontrados');
    alert('Error: Inputs no encontrados en HTML');
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert('Por favor completa email y contraseña');
    return;
  }

  try {
    console.log('📤 API Request: POST /auth/login');
    console.log('Credenciales:', { email, password });

    const baseURL = 'http://localhost:4000';

    const response = await fetch(baseURL + '/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    console.log('Response Status:', response.status);

    if (response.status === 405) {
      alert('Error 405: Backend no responde correctamente');
      return;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Respuesta no es JSON');
    }

    const result = await response.json();
    console.log('✅ Login Response:', result);

    if (!result.success) {
      alert(result.message || 'Login fallido');
      return;
    }

    // ✅ CRÍTICO: Extraer token y usuario
    const token = result.data?.token || result.token;
    const user = result.data?.user || result.user || {};

    console.log('Token recibido:', token);
    console.log('Usuario recibido:', user);

    if (!token) {
      console.error('❌ No hay token en respuesta:', result);
      alert('Error: No se recibió token de autenticación');
      return;
    }

    if (!user.id || !user.email) {
      console.error('❌ Usuario incompleto:', user);
      alert('Error: Datos de usuario incompletos');
      return;
    }
    // ✅ CRÍTICO: GUARDAR TOKEN Y USUARIO ANTES DE NAVEGAR
    localStorage.setItem('mcm_token', token);
    localStorage.setItem('mcm_user', JSON.stringify(user));

    // ✅ GUARDAR EN VARIABLE GLOBAL TAMBIÉN (para evitar race condition)
    window.mcm_token = token;
    window.mcm_user = user;

    // Verificar que se guardó
    console.log('✅ Token guardado en localStorage:', localStorage.getItem('mcm_token'));
    console.log('✅ Token guardado en variable global:', window.mcm_token);
    console.log('✅ Usuario guardado:', localStorage.getItem('mcm_user'));

    // alert('¡Bienvenido ' + (user.nombre || user.email) + '!');

    // Limpiar formulario
    emailInput.value = '';
    passwordInput.value = '';

    // ✅ NAVEGAR AL DASHBOARD DESPUÉS de guardar
    console.log('📊 Navegando a Dashboard...');
    if (typeof showDashboard === 'function') {
      showDashboard();
    } else if (typeof showView === 'function') {
      showView('dashboard');
    }

  } catch (error) {
    console.error('❌ Error login:', error);
    alert('Error: ' + error.message);
  }
}


// ============================================
// FUNCIÓN showDashboard
// ============================================
function showDashboard() {
  // Delegate visibility management to showView
  showView('dashboard');
}



/**
 * Cerrar sesión
 */
function handleLogout() {
  showConfirm('¿Está seguro de cerrar sesión?', () => {
    STATE.authToken = null;
    STATE.currentUser = null;
    window.mcm_token = null;
    localStorage.removeItem('mcm_token');
    localStorage.removeItem('mcm_user');

    showToast('Sesión cerrada', 'info');

    // Explicitly toggle containers
    const loginView = document.getElementById('login');
    const mainApp = document.getElementById('mainApp');

    if (loginView) {
      loginView.classList.add('active');
      loginView.classList.remove('hidden');
      loginView.style.display = 'flex'; // Ensure flex layout
    }

    if (mainApp) {
      mainApp.classList.add('hidden');
      mainApp.style.display = 'none';
    }

    document.getElementById('loginForm')?.reset();
  });
}

// ======================== NAVEGACIÓN Y VISTAS ========================

/**
 * Cambiar vista principal
 */
function showView(viewName) {
  // SPECIAL HANDLING: If view is 'login', assume explicit logout/login flow
  if (viewName === 'login') {
    const loginView = document.getElementById('login');
    const mainApp = document.getElementById('mainApp');
    if (loginView) {
      loginView.style.display = 'flex';
      loginView.classList.remove('hidden');
      loginView.classList.add('active');
    }
    if (mainApp) {
      mainApp.style.display = 'none';
      mainApp.classList.add('hidden');
    }
    return;
  }

  // ELSE assumption: We are inside the main app
  const loginView = document.getElementById('login');
  const mainApp = document.getElementById('mainApp');

  if (loginView) {
    loginView.style.display = 'none';
    loginView.classList.add('hidden');
    loginView.classList.remove('active');
  }

  if (mainApp) {
    mainApp.style.display = 'flex'; // Restore main layout
    mainApp.classList.remove('hidden');
  }

  const views = document.querySelectorAll('.view, [data-view-content]');
  views.forEach(view => {
    // Don't hide login if we are just switching tabs, but we handled that above
    if (!view.classList.contains('login-view')) {
      view.classList.remove('active');
    }
  });

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
  switch (viewName) {
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

function loadDashboard() {
  try {
    console.log('📊 Cargando dashboard...');

    // Cargar datos del servidor
    loadDashboardData();

    console.log('✅ Dashboard cargado');

  } catch (error) {
    console.error('❌ Error en loadDashboard:', error);
  }
}



function loadLocalLotes() {
  try {
    if (typeof appData !== 'undefined' && appData.lots) {
      renderLotesTable(appData.lots);
    }
  } catch (error) {
    console.error('Error cargando lotes locales:', error);
  }
}



function loadLocalProductos() {
  try {
    if (typeof appData !== 'undefined' && appData.products) {
      renderProductosTable(appData.products);
    }
  } catch (error) {
    console.error('Error cargando productos locales:', error);
  }
}



function loadLocalAlertas() {
  try {
    if (typeof appData !== 'undefined' && appData.alerts) {
      renderAlertasTable(appData.alerts);
    }
  } catch (error) {
    console.error('Error cargando alertas locales:', error);
  }
}

// ============================================
// FUNCIÓN renderAlertasTable (SI NO EXISTE)
// ============================================
function renderAlertasTable(alertas) {
  try {
    if (!Array.isArray(alertas)) return;

    const tableBody = document.querySelector('#alertasTable tbody') ||
      document.querySelector('.alertas-table tbody');

    if (!tableBody) {
      console.warn('⚠️ Tabla de alertas no encontrada');
      return;
    }

    tableBody.innerHTML = '';

    alertas.slice(0, 10).forEach(alerta => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span class="priority priority-${(alerta.priority || alerta.prioridad || 'low').toLowerCase()}">${alerta.priority || alerta.prioridad || 'N/A'}</span></td>
        <td>${alerta.title || alerta.titulo || '-'}</td>
        <td>${alerta.message || alerta.mensaje || '-'}</td>
        <td>${alerta.date || alerta.fecha || '-'}</td>
      `;
      tableBody.appendChild(row);
    });

    console.log('✅ Tabla de alertas actualizada');

  } catch (error) {
    console.error('❌ Error renderizando alertas:', error);
  }
}

// ============================================
// FUNCIÓN loadReportes (SI LA NECESITAS)
// ============================================
function loadReportes() {
  try {
    console.log('📊 Cargando reportes...');

    const baseURL = 'http://localhost:4000';
    const token = localStorage.getItem('mcm_token');

    fetch(baseURL + '/api/reportes', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          renderReportesTable(data.data);
          console.log('✅ Reportes cargados');
        } else {
          loadLocalReportes();
        }
      })
      .catch(err => {
        console.warn('Error obteniendo reportes:', err);
        loadLocalReportes();
      });

  } catch (error) {
    console.error('❌ Error en loadReportes:', error);
  }
}

function loadLocalReportes() {
  try {
    if (typeof appData !== 'undefined' && appData.reports) {
      renderReportesTable(appData.reports);
    }
  } catch (error) {
    console.error('Error cargando reportes locales:', error);
  }
}

function renderReportesTable(reportes) {
  try {
    if (!Array.isArray(reportes)) return;

    const tableBody = document.querySelector('#reportesTable tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    reportes.slice(0, 10).forEach(reporte => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${reporte.name || reporte.nombre || '-'}</td>
        <td>${reporte.type || reporte.tipo || '-'}</td>
        <td>${reporte.frequency || reporte.frecuencia || '-'}</td>
        <td>${reporte.format || reporte.formato || '-'}</td>
      `;
      tableBody.appendChild(row);
    });

  } catch (error) {
    console.error('Error renderizando reportes:', error);
  }
}

// Generate Report Listener
const generateReporteBtn = document.getElementById('generateReporteBtn');
if (generateReporteBtn) {
  generateReporteBtn.addEventListener('click', generateReporte);
}

async function generateReporte() {
  const type = document.getElementById('reporteType').value;
  const startDate = document.getElementById('reporteStartDate').value;
  const endDate = document.getElementById('reporteEndDate').value;
  const format = document.getElementById('reporteFormat').value;

  if (!type) {
    showToast('Selecciona un tipo de reporte', 'warning');
    return;
  }

  showLoading(true);
  try {
    const baseURL = 'http://localhost:4000';
    const token = window.mcm_token || localStorage.getItem('mcm_token');

    if (!token) {
      showToast('No hay sesión activa', 'error');
      showLoading(false);
      return;
    }

    // IF CSV, Use direct backend download
    if (format === 'CSV') {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ type, startDate, endDate, format })
      };

      const response = await fetch(baseURL + '/api/reportes/generate', options);
      if (response.ok) {
        const blob = await response.blob();
        downloadBlob(blob, `reporte-${type}-${new Date().toISOString().split('T')[0]}.csv`);
        showToast('Reporte CSV descargado', 'success');
      } else {
        const err = await response.text();
        console.error('CSV Error:', err);
        showToast('Error descargando CSV', 'error');
      }
      return;
    }

    // FOR PDF or EXCEL -> Fetch JSON first
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ type, startDate, endDate, format: 'JSON' }) // Force JSON
    };

    const response = await fetch(baseURL + '/api/reportes/generate', options);
    const result = await response.json();

    if (!result.success || !result.data || result.data.length === 0) {
      showToast('No hay datos para generar el reporte', 'warning');
      return;
    }

    const data = result.data;
    const filename = result.filename || `reporte-${type}`;

    if (format === 'PDF') {
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Reporte: ${type.toUpperCase()}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);

        const headers = Object.keys(data[0]);
        const rows = data.map(obj => Object.values(obj));

        doc.autoTable({
          head: [headers],
          body: rows,
          startY: 40,
        });

        doc.save(`${filename}.pdf`);
        showToast('Reporte PDF generado', 'success');
      } catch (pdfErr) {
        console.error('PDF Generation Error:', pdfErr);
        showToast('Error generando PDF. Verifique librerías.', 'error');
      }
    } else if (format === 'Excel') {
      // Generate CSV/XLS compatible string
      const headers = Object.keys(data[0]).join('\t');
      const rows = data.map(obj => Object.values(obj).join('\t')).join('\n');
      const excelContent = `${headers}\n${rows}`;

      const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
      downloadBlob(blob, `${filename}.xls`);
      showToast('Reporte Excel descargado', 'success');
    }

  } catch (error) {
    console.error('Error in generateReporte:', error);
    showToast('Error de conexión al generar reporte', 'error');
  } finally {
    showLoading(false);
  }
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}


// ============================================
// FUNCIÓN loadUsuarios (SI LA NECESITAS)
// ============================================
function loadUsuarios() {
  try {
    console.log('👥 Cargando usuarios...');

    const baseURL = 'http://localhost:4000';
    const token = localStorage.getItem('mcm_token');

    fetch(baseURL + '/api/usuarios', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          renderUsuariosTable(data.data);
          console.log('✅ Usuarios cargados');
        } else {
          loadLocalUsuarios();
        }
      })
      .catch(err => {
        console.warn('Error obteniendo usuarios:', err);
        loadLocalUsuarios();
      });

  } catch (error) {
    console.error('❌ Error en loadUsuarios:', error);
  }
}

function loadLocalUsuarios() {
  try {
    if (typeof appData !== 'undefined' && appData.users) {
      renderUsuariosTable(appData.users);
    }
  } catch (error) {
    console.error('Error cargando usuarios locales:', error);
  }
}

function renderUsuariosTable(usuarios) {
  try {
    if (!Array.isArray(usuarios)) return;

    const tableBody = document.querySelector('#usuariosTable tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    usuarios.slice(0, 10).forEach(usuario => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${usuario.name || usuario.nombre || '-'}</td>
        <td>${usuario.email || '-'}</td>
        <td>${usuario.role || usuario.rol || '-'}</td>
        <td><span class="status">${usuario.status || usuario.estado || 'activo'}</span></td>
      `;
      tableBody.appendChild(row);
    });

  } catch (error) {
    console.error('Error renderizando usuarios:', error);
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
/**
 * Cargar datos del dashboard
 */
async function loadDashboardData() {
  try {
    console.log('📊 Cargando datos del dashboard...');

    // 1. CARGAR KPIs
    try {
      const kpisRes = await apiCall('/dashboard/kpis');
      if (kpisRes.success) {
        updateKPIs(kpisRes.data);

        // Render Recent Alerts from KPI response if available
        if (kpisRes.data.recentAlerts) {
          renderDashboardAlerts(kpisRes.data.recentAlerts);
        }
      } else {
        console.warn('⚠️ Fallo carga KPIs, usando local');
        loadLocalDashboardData();
      }
    } catch (error) {
      console.warn('⚠️ Error KPIs, usando local');
      loadLocalDashboardData();
    }

    // 2. CARGAR LOTES RECIENTES
    try {
      const lotesRes = await apiCall('/lotes?pagina=1&paginaSize=10');
      if (lotesRes.success) {
        // En el dashboard mostramos lotes recientes en la tabla pequeña
        renderRecentLots(lotesRes.data);

        // También actualizamos la tabla principal se hay datos
        if (STATE) STATE.lotes = lotesRes.data;
      }
    } catch (error) {
      console.warn('⚠️ Error Lotes recientes');
    }

    // 3. (REMOVED SEPARATE ALERTS CALL - Handled in KPIs)


    // 4. CARGAR DATOS DE GRÁFICAS
    try {
      const chartsRes = await apiCall('/dashboard/charts');
      if (chartsRes.success) {
        initializeCharts(chartsRes.data);
      } else {
        initializeCharts(); // Fallback to static/empty
      }
    } catch (error) {
      console.warn('⚠️ Error Graficas');
      initializeCharts();
    }

  } catch (error) {
    console.error('❌ Error cargando datos dashboard:', error);
    loadLocalDashboardData();
  }
}

// Función auxiliar - ASEGÚRATE DE QUE EXISTE
function loadLocalDashboardData() {
  console.log('📦 Cargando datos locales...');

  try {
    if (typeof appData !== 'undefined' && appData) {
      if (appData.kpis) updateKPIs(appData.kpis);
      if (appData.lots) renderRecentLots(appData.lots);
      if (appData.alerts) renderDashboardAlerts(appData.alerts); // Assuming alerts exist in appData
      console.log('✅ Datos locales cargados');
    }
  } catch (error) {
    console.error('Error cargando datos locales:', error);
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
/**
 * Renderizar alertas en dashboard
 */
function renderDashboardAlerts(alertas) {
  const container = document.getElementById('dashboardAlerts') ||
    document.querySelector('.recent-alerts-list');

  if (!container) return;

  // Header Title matching mockup
  const headerHtml = '<h3 class="alerts-section-title"></h3>';

  if (!alertas || alertas.length === 0) {
    container.innerHTML = headerHtml + '<p style="padding: 20px; text-align: center; color: #999;">No hay alertas pendientes</p>';
    return;
  }

  const alertsHtml = alertas.slice(0, 6).map(alerta => {
    const iconClass = {
      'Caducidad': 'clock',
      'Stock Bajo': 'exclamation-triangle',
      'Sistema': 'info-circle'
    }[alerta.tipo] || 'alert-circle';

    // Determine border color class
    let borderClass = 'border-blue';
    if (alerta.tipo === 'Caducidad') borderClass = 'border-red';
    if (alerta.tipo === 'Stock Bajo') borderClass = 'border-orange';

    return `
      <div class="alert-card ${borderClass}">
        <div class="alert-icon-wrapper">
           <i class="fas fa-${iconClass}"></i>
        </div>
        <div class="alert-text-content">
          <div class="alert-title">
             <strong>${alerta.descripcion || alerta.mensaje}</strong>
          </div>
          <div class="alert-meta">
            ${formatDate(alerta.fecha)} - ${alerta.tipo}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = headerHtml + '<div class="alerts-list-container">' + alertsHtml + '</div>';
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
 * Global Chart Instances to handle updates/destruction
 */
let stockChartInstance = null;
let alertsChartInstance = null;

/**
 * Inicializar gráficas (Chart.js)
 */
function initializeCharts(chartData) {
  // Default data if none provided
  const stockLabels = chartData?.stock?.labels || ['Premium Chiapas', 'Orgánico Veracruz', 'Descafeinado', 'Espresso Blend', 'Colombia Supremo', 'Guatemala Antigua'];
  const stockValues = chartData?.stock?.data || [85, 42, 23, 67, 91, 18];

  const alertLabels = chartData?.alertas?.labels || ['Caducidad', 'Stock Bajo', 'Sistema'];
  const alertValues = chartData?.alertas?.data || [5, 3, 2];

  // Gráfica de Stock
  const stockCtx = document.getElementById('stockChart');
  if (stockCtx && typeof Chart !== 'undefined') {
    if (stockChartInstance) stockChartInstance.destroy();

    stockChartInstance = new Chart(stockCtx, {
      type: 'bar',
      data: {
        labels: stockLabels,
        datasets: [{
          label: 'Stock Actual',
          data: stockValues,
          backgroundColor: [
            '#26C6DA', // Cyan
            '#FFCA28', // Orange
            '#A52A2A', // Dark Red/Brown
            '#F0F4C3', // Light Beige
            '#546E7A', // Blue Grey
            '#EF5350', // Red
            '#8D6E63', // Brown
            '#7E57C2'  // Deep Purple
          ],
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Niveles de Stock por Producto',
            font: { size: 16, weight: 'bold', family: 'Inter' },
            color: '#3E2723',
            align: 'start',
            padding: { bottom: 20 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { color: '#5D4037', font: { weight: '500' } }
          },
          x: {
            grid: { display: true, color: 'rgba(0,0,0,0.05)' },
            ticks: { color: '#5D4037', font: { weight: '500' } }
          }
        },
        layout: { padding: 10 }
      }
    });
  }

  // Gráfica de Alertas
  const alertsCtx = document.getElementById('alertsChart');
  if (alertsCtx && typeof Chart !== 'undefined') {
    if (alertsChartInstance) alertsChartInstance.destroy();

    alertsChartInstance = new Chart(alertsCtx, {
      type: 'doughnut',
      data: {
        labels: alertLabels,
        datasets: [{
          data: alertValues,
          backgroundColor: ['#EF5350', '#FFA726', '#8D6E63', '#26C6DA', '#7E57C2'],
          borderColor: '#FFF8E1',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#5D4037',
              padding: 20,
              usePointStyle: true,
              font: { family: 'Inter', size: 12 }
            }
          },
          title: {
            display: true,
            text: 'Distribución de Alertas',
            font: { size: 16, weight: 'bold', family: 'Inter' },
            color: '#3E2723',
            align: 'start',
            padding: { bottom: 20 }
          }
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
    console.log('📦 Cargando lotes...');

    try {
      const data = await apiCall('/lotes?pagina=1&paginaSize=10');
      if (data.success && data.data) {
        renderLotesTable(data.data);
        console.log('✅ Lotes del servidor cargados');
        return;
      }
    } catch (error) {
      console.warn('⚠️ Servidor no disponible, usando datos locales');
    }

    // FALLBACK A DATOS LOCALES
    loadLocalLotes();

  } catch (error) {
    console.error('❌ Error en loadLotes:', error);
    loadLocalLotes();
  }
}

function loadLocalLotes() {
  try {
    if (typeof appData !== 'undefined' && appData.lots) {
      renderLotesTable(appData.lots);
      console.log('✅ Lotes locales cargados');
    }
  } catch (error) {
    console.error('Error cargando lotes locales:', error);
  }
}

/**
 * Renderizar tabla de lotes (Vista Principal)
 */
function renderLotesTable(lotesInput = null) {
  const lotes = lotesInput || STATE.lotes;

  const tbody = document.getElementById('lotesTableBody') ||
    document.querySelector('#lotesTable tbody');

  if (!tbody) return;

  if (!lotes || lotes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #999;">No hay lotes encontrados</td></tr>';
    return;
  }

  tbody.innerHTML = lotes.map(lote => `
    <tr>
      <td><strong>${lote.codigo}</strong></td>
      <td>${lote.productoNombre}</td>
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
          <button class="btn-action view" onclick="viewLote('${lote.id}')" title="Ver Detalle">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn-action edit" onclick="editLote('${lote.id}')" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-action delete" onclick="deleteLote('${lote.id}')" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
          <button class="btn-action label" onclick="generateLabel('${lote.id}')" title="Generar etiqueta">
            <i class="fas fa-tag"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Ver Detalle Lote
 */
function viewLote(loteId) {
  const lote = STATE.lotes.find(l => l.id == loteId);
  if (!lote) return;

  // Populate Modal
  document.getElementById('detailCodigo').textContent = lote.codigo;
  document.getElementById('detailProducto').textContent = lote.productoNombre || lote.producto;
  document.getElementById('detailOrigen').textContent = lote.origen;
  document.getElementById('detailTueste').textContent = lote.tipoTueste;
  document.getElementById('detailPeso').textContent = (lote.pesoActual || lote.peso) + ' kg';

  const statusEl = document.getElementById('detailEstado');
  if (statusEl) {
    statusEl.innerHTML = `
        <span class="status-badge status-${lote.estado.toLowerCase().replace(/\s/g, '-')}">
          ${lote.estado}
        </span>`;
  }

  document.getElementById('detailFechaTueste').textContent = formatDate(lote.fechaTueste);
  document.getElementById('detailCaducidad').textContent = formatDate(lote.fechaCaducidad);
  document.getElementById('detailCreador').textContent = lote.creadorNombre || 'Desconocido';
  document.getElementById('detailFechaCreacion').textContent = lote.creadoEn ? formatDateTime(lote.creadoEn) : 'N/A';
  document.getElementById('detailNotas').textContent = lote.notas || '-';

  // Bind Edit Button
  const btnEdit = document.getElementById('btnEditFromDetail');
  if (btnEdit) {
    btnEdit.onclick = function () {
      closeModal('loteDetailModal');
      editLote(loteId);
    };
  }

  // Show Modal
  openModal('loteDetailModal');
}

/**
 * Generar Etiqueta desde Lote
 */
function generateLabel(loteId) {
  // Save selection
  STATE.preselectedLotId = loteId;

  // Switch view
  showView('etiquetas');
}

/**
 * Abrir modal para nuevo lote
 */
async function openNewLoteModal() {
  STATE.editingLoteId = null;
  document.getElementById('loteFormTitle').textContent = 'Nuevo Lote';
  document.getElementById('loteForm').reset();
  await populateProductOptions();
  document.getElementById('loteModal').classList.add('active');
}

/**
 * Helper para poblar select de productos
 */
async function populateProductOptions(selectedId = null) {
  const select = document.getElementById('productoId');
  if (!select) return;

  // Fetch if needed
  if (!STATE.productos || STATE.productos.length === 0) {
    try {
      const res = await apiCall('/productos');
      if (res.success) STATE.productos = res.data;
    } catch (e) { console.error("Error fetching products", e); }
  }

  select.innerHTML = '<option value="">Selecciona un producto</option>' +
    STATE.productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

  if (selectedId) {
    select.value = selectedId;
  }
}

/**
 * Editar lote
 */
async function editLote(loteId) {
  STATE.editingLoteId = loteId;

  const lote = STATE.lotes.find(l => l.id == loteId);
  if (lote) {
    document.getElementById('loteFormTitle').textContent = 'Editar Lote';
    await populateProductOptions(lote.productoId); // Use productoId

    setInputValue('codigo', lote.codigo);
    setInputValue('origen', lote.origen);
    setInputValue('tipoTueste', lote.tipoTueste);
    setInputValue('pesoInicial', lote.pesoInicial);
    setInputValue('pesoActual', lote.pesoActual || lote.peso); // Fallback to peso if pesoActual null
    setInputValue('fechaTueste', lote.fechaTueste?.split('T')[0]);
    setInputValue('fechaCaducidad', lote.fechaCaducidad?.split('T')[0]);
    setInputValue('estado', lote.estado);
    setInputValue('notas', lote.notas);

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
    productoId: getInputValue('productoId'), // Changed from producto text
    origen: getInputValue('origen'),
    tipoTueste: getInputValue('tipoTueste'),
    pesoInicial: parseFloat(getInputValue('pesoInicial')),
    pesoActual: parseFloat(getInputValue('pesoActual')),
    peso: parseFloat(getInputValue('pesoActual')), // Add peso (using pesoActual)
    fechaTueste: getInputValue('fechaTueste'),
    fechaCaducidad: getInputValue('fechaCaducidad'),
    estado: getInputValue('estado'),
    notas: getInputValue('notas')
  };

  // Validaciones
  if (!loteData.codigo || !loteData.productoId || !loteData.fechaTueste) {
    showToast('Por favor completa los campos obligatorios', 'warning');
    return;
  }

  try {
    let result;

    if (STATE.editingLoteId) {
      // Actualizar
      result = await apiCall(`/lotes/${STATE.editingLoteId}`, 'PUT', loteData);
    } else {
      // Crear
      result = await apiCall('/lotes', 'POST', loteData);
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
  showConfirm('¿Está seguro de eliminar este lote?', async () => {
    try {
      const result = await apiCall(`/lotes/${loteId}`, 'DELETE');

      if (result.success) {
        showToast('Lote eliminado correctamente', 'success');
        loadLotes();
      }
    } catch (error) {
      showToast('Error eliminando lote', 'error');
    }
  });
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
 * Renderizar productos (Premium Grid)
 */
function renderProductosTable() {
  renderProductosGrid();
}

/**
 * Render Grid View High End
 */
/**
 * Render Grid View High End
 */
function renderProductosGrid(products = null) {
  const grid = document.getElementById('productosGrid');
  if (!grid) return;

  const dataToRender = products || STATE.productos;

  if (!dataToRender || dataToRender.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999;">No hay productos registrados</div>';
    return;
  }

  grid.innerHTML = dataToRender.map(p => {
    // Calculations
    const stockPct = p.stockMinimo > 0 ? (p.stockActual / (p.stockMinimo * 2)) * 100 : 50;
    const displayPct = Math.min(Math.max(stockPct, 5), 100);
    const isLow = p.stockActual < p.stockMinimo;
    const statusBadge = isLow
      ? '<span class="stock-badge badge-low">STOCK BAJO</span>'
      : '<span class="stock-badge badge-available">DISPONIBLE</span>';

    return `
        <div class="product-card-premium">
            <div class="card-header-icon">
                <i class="fas fa-mug-hot"></i>
                <div class="product-actions-overlay">
                    <button class="btn-overlay edit" onclick="editProducto('${p.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-overlay delete" onclick="deleteProducto('${p.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="card-body">
                <h3 class="product-title">${p.nombre}</h3>
                
                <div class="product-meta-row">
                    <span><i class="fas fa-map-marker-alt"></i> ${p.origen}</span>
                    <span><i class="fas fa-leaf"></i> ${p.grano}</span>
                </div>

                <div class="stock-info">
                    <div class="stock-labels">
                        <span>Stock: ${p.stockActual} / ${p.stockMinimo}</span>
                        ${statusBadge}
                    </div>
                    <div class="stock-progress-bar">
                        <div class="stock-progress-fill" style="width: ${displayPct}%; background-color: ${isLow ? '#EF6C00' : '#2E7D32'}"></div>
                    </div>
                </div>

                <div class="product-details-text">
                    <strong>Presentaciones:</strong> ${p.presentacion || 'N/A'}<br>
                    <small>${p.descripcion || ''}</small><br>
                </div>

                <div class="product-price-tag">
                    $${parseFloat(p.precio).toFixed(2)} / kg
                </div>
            </div>
        </div>
        `;
  }).join('');
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
    // User renamed input to granoProducto. Mapping grano/tipoGrano to it.
    setInputValue('granoProducto', producto.grano);
    setInputValue('stockActualProducto', producto.stockActual);
    setInputValue('stockMinimoProducto', producto.stockMinimo);
    setInputValue('precioProducto', producto.precio || producto.precioUnitario);
    setInputValue('descripcionProducto', producto.descripcion);
    setInputValue('presentacionProducto', producto.presentacion); // New simple input

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
    grano: getInputValue('granoProducto'),
    stockActual: parseFloat(getInputValue('stockActualProducto')),
    stockMinimo: parseFloat(getInputValue('stockMinimoProducto')),
    precioUnitario: parseFloat(getInputValue('precioProducto')),
    descripcion: getInputValue('descripcionProducto'),
    presentacion: getInputValue('presentacionProducto') // Simple text
  };

  if (!productoData.nombre || !productoData.origen) {
    showToast('Por favor completa los campos obligatorios', 'warning');
    return;
  }

  try {
    let result;

    if (STATE.editingProductId) {
      result = await apiCall(`/productos/${STATE.editingProductId}`, 'PUT', productoData);
    } else {
      result = await apiCall('/productos', 'POST', productoData);
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
  showConfirm('¿Está seguro de eliminar este producto?', async () => {
    try {
      const result = await apiCall(`/productos/${productoId}`, 'DELETE');

      if (result.success) {
        showToast('Producto eliminado correctamente', 'success');
        loadProductos();
      }
    } catch (error) {
      showToast('Error eliminando producto', 'error');
    }
  });
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
      result = await apiCall(`/usuarios/${STATE.editingUserId}`, 'PUT', usuarioData);
    } else {
      result = await apiCall('/usuarios', 'POST', usuarioData);
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
  showConfirm('¿Está seguro de eliminar este usuario?', async () => {
    try {
      const result = await apiCall(`/usuarios/${usuarioId}`, 'DELETE');

      if (result.success) {
        showToast('Usuario eliminado correctamente', 'success');
        loadUsuarios();
      }
    } catch (error) {
      showToast('Error eliminando usuario', 'error');
    }
  });
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
async function generateLabel2(loteId) {
  console.log("LOTES: ", STATE.lotes)
  const lote = STATE.lotes.find(l => l.id === loteId);
  // if (!lote) {
  //   showToast('Lote no encontrado', 'error');
  //   return;
  // }

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

// ======================== ETIQUETAS LOGIC ========================

function loadEtiquetas() {
  renderLabelTemplates();
  loadLabelFormOptions();
  // Default preview
  updateLabelPreview();
}

function renderLabelTemplates() {
  const grid = document.getElementById('plantillasGrid');
  if (!grid) return;

  grid.innerHTML = STATE.plantillaEtiquetas.map(p => `
      <div class="plantilla-card ${STATE.selectedTemplateId === p.id ? 'active' : ''}" 
           onclick="selectLabelTemplate(${p.id})">
          <h4>${p.name}</h4>
          <p>${p.description}</p>
          <div class="plantilla-meta">
              <i class="fas fa-ruler-combined"></i> ${p.size}
              <span style="margin-left: 10px"><i class="fas fa-list"></i> ${p.fields.length} campos</span>
          </div>
      </div>
  `).join('');
}

function selectLabelTemplate(id) {
  STATE.selectedTemplateId = id;
  renderLabelTemplates();
  updateLabelPreview();
}

// Make it global so HTML can call it
window.selectLabelTemplate = selectLabelTemplate;

async function loadLabelFormOptions() {
  // Populate Products
  const prodSelect = document.getElementById('labelProductSelect');
  if (prodSelect) {
    // Ensure we have products
    if (!STATE.productos || STATE.productos.length === 0) {
      try {
        const res = await apiCall('/productos');
        if (res.success) STATE.productos = res.data;
      } catch (e) { }
    }

    if (STATE.productos.length > 0) {
      prodSelect.innerHTML = '<option value="">Seleccionar producto</option>' +
        STATE.productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }

    prodSelect.onchange = updateLabelPreview;
  }

  // Populate Lots
  const lotSelect = document.getElementById('labelLotSelect');
  if (lotSelect) {
    if (!STATE.lotes || STATE.lotes.length === 0) {
      try {
        // Try fetching if empty
        const res = await apiCall('/lotes');
        if (res.success) STATE.lotes = res.data;
      } catch (e) { }
    }

    if (STATE.lotes.length > 0) {
      // Enforce fetching a few if empty? No, we trust STATE or fetch above
      lotSelect.innerHTML = '<option value="">Seleccionar lote</option>' +
        STATE.lotes.map(l => `<option value="${l.id}">${l.codigo} (${l.origen})</option>`).join('');
    }

    lotSelect.onchange = updateLabelPreview;
  }

  // Quantity listener
  const qtyInput = document.getElementById('labelQuantity');
  if (qtyInput) qtyInput.oninput = updateLabelPreview;

  // Generate Button
  const btnGen = document.getElementById('btnGenerateLabels');
  if (btnGen) btnGen.onclick = addToPrintQueue;

  // Handle Pre-selection from Lotes View
  if (STATE.preselectedLotId && STATE.lotes.length > 0) {
    const lotId = STATE.preselectedLotId;
    const lot = STATE.lotes.find(l => l.id == lotId);

    if (lot) {
      // Select Lot
      if (lotSelect) lotSelect.value = lotId;

      // Select Product (find product by name match or ID if available)
      // Since lotes usually have productoId, we should use that. 
      // If not available, we try to match by name from lot.productoNombre
      if (prodSelect) {
        const prod = STATE.productos.find(p => p.nombre === lot.productoNombre);
        if (prod) prodSelect.value = prod.id;
      }

      updateLabelPreview();
    }

    // Clear selection
    STATE.preselectedLotId = null;
  }
}

function updateLabelPreview() {
  const previewBox = document.getElementById('labelPreview');
  if (!previewBox) return;

  const template = STATE.plantillaEtiquetas.find(p => p.id === STATE.selectedTemplateId);
  const prodId = document.getElementById('labelProductSelect')?.value;
  const prod = STATE.productos.find(p => p.id == prodId);

  if (!template) return;

  if (!prod) {
    previewBox.innerHTML = `
          <div style="opacity: 0.5;">
              <h4>${template.name}</h4>
              <p>Seleccione un producto para ver el resultado final</p>
              <div style="margin-top: 20px; font-size: 30px;"><i class="fas fa-barcode"></i></div>
          </div>
      `;
    return;
  }

  // Generate mockup preview based on template type
  let content = `<div style="text-align: center; width: 100%;">`;

  // Premium adds branded header
  if (template.id === 2) {
    content += `<div style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 5px; font-weight: bold; color: #8D6E63; text-transform: uppercase; letter-spacing: 1px;">Mexhi Coffee</div>`;
  }

  // Compact has smaller text
  const titleSize = template.id === 3 ? '1.1em' : '1.4em';
  content += `<h3 style="margin: 5px 0; color: #3E2723; font-size: ${titleSize};">${prod.nombre}</h3>`;

  if (template.id !== 3) {
    content += `<p style="font-size: 0.9em; margin: 4px 0;"><strong>Origen:</strong> ${prod.origen || 'N/A'}</p>`;
    content += `<p style="font-size: 0.9em; margin: 2px 0;"><strong>Tueste:</strong> ${prod.tipoGrano || 'Medio'}</p>`;
  }

  if (template.id === 4) { // Promo
    content += `<div style="background: #E53935; color: white; padding: 2px 8px; border-radius: 4px; display: inline-block; margin: 5px 0; font-size: 0.8em; font-weight: bold;">OFERTA ESPECIAL</div>`;
    content += `<p style="font-size: 1.1em; color: #3E2723; font-weight: bold; margin: 4px 0;">$${(prod.precio * 0.9).toFixed(2)}</p>`;
  }

  const lotId = document.getElementById('labelLotSelect')?.value;
  const lot = STATE.lotes.find(l => l.id == lotId);
  let caducidad = '15/10/2026';

  if (lot && lot.fechaCaducidad) {
    const date = new Date(lot.fechaCaducidad);
    caducidad = date.toLocaleDateString();
  }

  content += `<p style="font-size: 0.8em; margin: 8px 0; color: #666;">Caduca: ${caducidad}</p>`;

  content += `<div style="margin-top: 10px; font-size: 32px; color: #3E2723;"><i class="fas fa-qrcode"></i></div>`;
  content += `</div>`;

  previewBox.innerHTML = content;
}

function addToPrintQueue() {
  const prodId = document.getElementById('labelProductSelect')?.value;
  const qty = document.getElementById('labelQuantity')?.value || 10;
  const prod = STATE.productos.find(p => p.id == prodId);
  const template = STATE.plantillaEtiquetas.find(p => p.id === STATE.selectedTemplateId);

  if (!prodId || !prod) {
    showToast('Seleccione un producto primero', 'error');
    return;
  }

  // Create print logic directly
  const printWindow = window.open('', '_blank', 'width=600,height=600');
  if (!printWindow) {
    showToast('Permita popups para imprimir', 'warning');
    return;
  }

  const labelHTML = document.getElementById('labelPreview').innerHTML;

  printWindow.document.write(`
      <html>
      <head>
          <title>Imprimir Etiquetas - Mexhi Coffee</title>
          <style>
              body { font-family: 'Arial', sans-serif; text-align: center; padding: 20px; }
              .label-card { 
                  border: 1px dashed #ccc; 
                  padding: 10px; 
                  margin: 10px auto; 
                  width: 300px; 
                  break-inside: avoid; 
              }
              @media print {
                  .no-print { display: none; }
              }
          </style>
      </head>
      <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
          <h2>Imprimiendo ${qty} Copias</h2>
          ${Array(parseInt(qty)).fill(`<div class="label-card">${labelHTML}</div>`).join('')}
      </body>
      </html>
  `);
  printWindow.document.close();

  showToast(`Enviando ${qty} etiquetas a imprimir...`, 'success');
}

// ======================== FILTROS PRODUCTOS ========================
const btnApply = document.getElementById('applyProductosFilter');
const btnClear = document.getElementById('clearProductosFilter');

if (btnApply) btnApply.addEventListener('click', filterProductos);
if (btnClear) btnClear.addEventListener('click', clearProductosFilter);

function filterProductos() {
  const term = document.getElementById('filterProductoNombre').value.toLowerCase();
  const status = document.getElementById('filterProductoEstado').value;

  const filtered = STATE.productos.filter(p => {
    const matchesTerm = !term ||
      (p.nombre && p.nombre.toLowerCase().includes(term)) ||
      (p.origen && p.origen.toLowerCase().includes(term));

    // Calculate status manually if not in DB, assuming same logic as grid render
    let displayPct = 0;
    if (p.stockMinimo > 0) {
      displayPct = Math.min((p.stockActual / p.stockMinimo) * 100, 100);
    }

    let pStatus = 'DISPONIBLE';
    if (parseFloat(p.stockActual) === 0) pStatus = 'AGOTADO';
    else if (parseFloat(p.stockActual) <= parseFloat(p.stockMinimo)) pStatus = 'STOCK BAJO';

    const matchesStatus = !status || pStatus === status;

    return matchesTerm && matchesStatus;
  });

  renderProductosGrid(filtered);
}

function clearProductosFilter() {
  document.getElementById('filterProductoNombre').value = '';
  document.getElementById('filterProductoEstado').value = '';
  renderProductosGrid(STATE.productos);
}

// ======================== FILTROS LOTES ========================
const btnApplyLotes = document.getElementById('applyLotesFilter');
const btnClearLotes = document.getElementById('clearLotesFilter'); // Assuming clear button exists or add logic if needed

if (btnApplyLotes) btnApplyLotes.addEventListener('click', filterLotes);

function filterLotes() {
  const term = document.getElementById('filterOrigen')?.value.toLowerCase();
  const status = document.getElementById('filterEstado')?.value;
  const dateFrom = document.getElementById('filterDesde')?.value;
  const dateHasta = document.getElementById('filterHasta')?.value;

  const filtered = STATE.lotes.filter(l => {
    const matchesTerm = !term ||
      (l.origen && l.origen.toLowerCase().includes(term)) ||
      (l.codigo && l.codigo.toLowerCase().includes(term));

    const matchesStatus = !status || l.estado === status;

    let matchesDate = true;
    if (dateFrom && l.fechaTueste) {
      matchesDate = matchesDate && new Date(l.fechaTueste) >= new Date(dateFrom);
    }
    if (dateHasta && l.fechaTueste) {
      matchesDate = matchesDate && new Date(l.fechaTueste) <= new Date(dateHasta);
    }

    return matchesTerm && matchesStatus && matchesDate;
  });

  renderLotesTable(filtered);
}

// Clear logic if button exists
function clearLotesFilters() {
  if (document.getElementById('filterOrigen')) document.getElementById('filterOrigen').value = '';
  if (document.getElementById('filterEstado')) document.getElementById('filterEstado').value = '';
  if (document.getElementById('filterDesde')) document.getElementById('filterDesde').value = '';
  if (document.getElementById('filterHasta')) document.getElementById('filterHasta').value = '';
  renderLotesTable(STATE.lotes);
}

// ======================== GESTIÓN DE ALERTAS ========================

// Event Listeners for Filters
const filterAlertTipo = document.getElementById('filterAlertTipo');
const filterAlertPrioridad = document.getElementById('filterAlertPrioridad');
const filterAlertEstado = document.getElementById('filterAlertEstado');

if (filterAlertTipo) filterAlertTipo.addEventListener('change', filterAlertas);
if (filterAlertPrioridad) filterAlertPrioridad.addEventListener('change', filterAlertas);
if (filterAlertEstado) filterAlertEstado.addEventListener('change', filterAlertas);

/**
 * Cargar Alertas
 */
async function loadAlertas() {
  try {
    const grid = document.getElementById('alertasGrid');
    if (grid) grid.innerHTML = `
        <div style="text-align: center; color: #999; padding: 40px;">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p style="margin-top: 10px;">Cargando alertas...</p>
        </div>`;

    const result = await apiCall('/alertas');

    if (result.success) {
      STATE.alertas = result.data;
      filterAlertas(); // This calls renderAlertsGrid
    } else {
      showToast('Error cargando alertas', 'error');
    }
  } catch (error) {
    console.error('Error loading alerts:', error);
    showToast('Error de conexión', 'error');
  }
}

/**
 * Filtrar y Renderizar
 */
function filterAlertas() {
  const tipo = document.getElementById('filterAlertTipo')?.value;
  const prioridad = document.getElementById('filterAlertPrioridad')?.value;
  const estado = document.getElementById('filterAlertEstado')?.value;

  const filtered = STATE.alertas.filter(a => {
    return (!tipo || a.tipo === tipo) &&
      (!prioridad || a.prioridad === prioridad) &&
      (!estado || a.estado === estado);
  });

  renderAlertsGrid(filtered);
}

/**
 * Renderizar Grid de Alertas
 */
function renderAlertsGrid(alertas) {
  const grid = document.getElementById('alertasGrid');
  if (!grid) return;

  if (!alertas || alertas.length === 0) {
    grid.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">No hay alertas que coincidan con los filtros</div>';
    return;
  }

  grid.innerHTML = alertas.map(alert => {
    const priorityClass = `priority-${alert.prioridad.toLowerCase()}`;
    const statusClass = alert.estado === 'Resuelto' ? 'status-resuelto' : '';
    const icon = getAlertIcon(alert.tipo);

    return `
      <div class="alert-card ${priorityClass} ${statusClass}" style="padding: 15px; margin-bottom: 10px;">
        <div class="alert-icon-wrapper" style="width: 40px; height: 40px; font-size: 1em; margin-right: 15px;">
          <i class="fas ${icon}"></i>
        </div>
        <div class="alert-content">
          <div class="alert-title" style="font-size: 1em;">${alert.titulo}</div>
          <div class="alert-message" style="font-size: 0.9em; margin-bottom: 4px;">${alert.mensaje}</div>
          <div class="alert-meta" style="font-size: 0.75em;">
            <span>${formatDateTime(alert.fecha)}</span> • 
            <span>${alert.estado}</span>
          </div>
        </div>
        <div class="alert-actions">
          ${alert.estado === 'Pendiente' ? `
            <button class="btn-resolve" onclick="resolveAlert(${alert.id})" title="Resolver" style="padding: 4px 8px;">
              <i class="fas fa-check"></i>
            </button>
            <button class="btn-dismiss" onclick="dismissAlert(${alert.id})" title="Descartar" style="padding: 4px 8px;">
              <i class="fas fa-times"></i>
            </button>
          ` : `
            <span class="badge-resuelto" style="font-size: 0.7em;">${alert.estado.toUpperCase()}</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function getAlertIcon(type) {
  switch (type) {
    case 'STOCK': return 'fa-exclamation-triangle';
    case 'CADUCIDAD': return 'fa-clock';
    case 'SISTEMA': return 'fa-cog';
    default: return 'fa-info-circle';
  }
}

/**
 * Renderizar Alertas en Dashboard
 */
function renderDashboardAlerts(alertas) {
  const container = document.getElementById('dashboardAlerts');
  if (!container) return;

  if (!alertas || alertas.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No hay alertas recientes</div>';
    return;
  }

  container.innerHTML = alertas.map(alert => {
    const priorityClass = `priority-${alert.prioridad.toLowerCase()}`;
    const statusClass = alert.estado === 'Resuelto' ? 'status-resuelto' : '';
    const icon = getAlertIcon(alert.tipo);

    // Simplified card for dashboard
    return `
      <div class="alert-card ${priorityClass} ${statusClass}" style="padding: 15px; margin-bottom: 10px;">
        <div class="alert-icon-wrapper" style="width: 40px; height: 40px; font-size: 1em; margin-right: 15px;">
          <i class="fas ${icon}"></i>
        </div>
        <div class="alert-content">
          <div class="alert-title" style="font-size: 1em;">${alert.titulo}</div>
          <div class="alert-message" style="font-size: 0.9em; margin-bottom: 4px;">${alert.mensaje}</div>
          <div class="alert-meta" style="font-size: 0.75em;">
            <span>${formatDateTime(alert.fecha)}</span>
          </div>
        </div>
        <div class="alert-actions">
           ${alert.estado === 'Pendiente' ? `
            <button class="btn-resolve" onclick="resolveAlert(${alert.id})" title="Resolver" style="padding: 4px 8px;">
              <i class="fas fa-check"></i>
            </button>
            <button class="btn-dismiss" onclick="dismissAlert(${alert.id})" title="Descartar" style="padding: 4px 8px;">
              <i class="fas fa-times"></i>
            </button>
          ` : `
            <span class="badge-resuelto" style="font-size: 0.7em;">${alert.estado.toUpperCase()}</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}
async function resolveAlert(id) {
  try {
    const result = await apiCall(`/alertas/${id}`, 'PUT', { estado: 'Resuelto' });
    if (result.success) {
      showToast('Alerta marcada como resuelta', 'success');
      loadAlertas(); // Reload to refresh list
    }
  } catch (error) {
    showToast('Error actualizando alerta', 'error');
  }
}

/**
 * Descartar Alerta
 */
async function dismissAlert(id) {
  if (!confirm('¿Estás seguro de descartar esta alerta?')) return;
  try {
    const result = await apiCall(`/alertas/${id}`, 'PUT', { estado: 'Descartado' });
    if (result.success) {
      showToast('Alerta descartada', 'success');
      loadAlertas();
    }
  } catch (error) {
    showToast('Error actualizando alerta', 'error');
  }
}



// Bind Clear if exists, or you can add button in HTML if missing
// But user only asked to make filters work, assuming HTML elements exist
const btnClearLotesRef = document.querySelector('button[onclick="clearFilters()"]');
if (btnClearLotesRef) {
  btnClearLotesRef.onclick = function (e) {
    e.preventDefault();
    clearLotesFilters();
  };
}
