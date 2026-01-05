require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'mexhi-secret-2025-super-seguro';

// ==================== MIDDLEWARE ====================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method.toUpperCase()} ${req.path}`);
  next();
});

// ==================== DATOS MOCK ====================

const mockData = {
  usuarios: [
    {
      id: 1,
      nombre: 'Admin MCM',
      email: 'admin@mexhi.com',
      rol: 'admin',
      password: 'password',
      estado: 'activo'
    },
    {
      id: 2,
      nombre: 'Juan Barista',
      email: 'barista@mexhi.com',
      rol: 'barista',
      password: 'password',
      estado: 'activo'
    },
    {
      id: 3,
      nombre: 'Carlos Almacén',
      email: 'almacenista@mexhi.com',
      rol: 'almacenista',
      password: 'password',
      estado: 'activo'
    }
  ],
  lotes: [
    {
      id: 1,
      codigo: 'LOT-2025-001',
      producto: 'Premium Chiapas',
      origen: 'Chiapas',
      tueste: 'Medio',
      peso: 50,
      pesoActual: 35,
      fechaTueste: '2025-01-15',
      fechaCaducidad: '2025-04-15',
      estado: 'Activo'
    },
    {
      id: 2,
      codigo: 'LOT-2025-002',
      producto: 'Orgánico Veracruz',
      origen: 'Veracruz',
      tueste: 'Claro',
      peso: 25,
      pesoActual: 8,
      fechaTueste: '2025-01-10',
      fechaCaducidad: '2025-04-10',
      estado: 'Stock Bajo'
    }
  ],
  productos: [
    {
      id: 1,
      nombre: 'Premium Chiapas',
      origen: 'Chiapas',
      tipo: 'Arábica',
      stock: 85,
      stockMinimo: 20,
      precio: 180,
      estado: 'disponible'
    },
    {
      id: 2,
      nombre: 'Orgánico Veracruz',
      origen: 'Veracruz',
      tipo: 'Arábica',
      stock: 15,
      stockMinimo: 25,
      precio: 220,
      estado: 'bajo'
    }
  ],
  alertas: [
    {
      id: 1,
      tipo: 'caducidad',
      titulo: 'Lote próximo a caducar',
      descripcion: 'LOT-2025-001 caduca en 7 días',
      prioridad: 'alta',
      estado: 'pendiente'
    },
    {
      id: 2,
      tipo: 'stock',
      titulo: 'Stock bajo',
      descripcion: 'Orgánico Veracruz está por debajo del mínimo',
      prioridad: 'media',
      estado: 'pendiente'
    }
  ]
};

// ==================== JWT UTILITIES ====================

const generateToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// ==================== MIDDLEWARE - JWT ====================

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
  req.user = decoded;
  next();
};

// ==================== 🔐 AUTH ENDPOINTS ====================

/**
 * POST /api/auth/login
 * Inicia sesión con email y password
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y password requeridos'
      });
    }

    const usuario = mockData.usuarios.find(u => u.email === email);

    if (!usuario || usuario.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Email o contraseña inválidos'
      });
    }

    const token = generateToken(usuario);

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        user: {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol
        }
      }
    });
  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({ success: false, message: 'Error en servidor' });
  }
});

/**
 * POST /api/auth/logout
 * Cierra sesión
 */
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logout exitoso' });
});

/**
 * POST /api/auth/verify
 * Verifica si el token es válido
 */
app.post('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Token válido',
    data: { user: req.user }
  });
});

// ==================== 📊 LOTES ENDPOINTS ====================

/**
 * GET /api/lotes
 * Obtiene todos los lotes
 */
app.get('/api/lotes', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Lotes obtenidos',
    data: mockData.lotes,
    total: mockData.lotes.length
  });
});

/**
 * GET /api/lotes/test
 * Test endpoint para lotes (sin autenticación)
 */
app.get('/api/lotes/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test lotes OK',
    data: mockData.lotes
  });
});

/**
 * POST /api/lotes
 * Crea un nuevo lote
 */
app.post('/api/lotes', authMiddleware, (req, res) => {
  try {
    const nuevoLote = {
      id: Math.max(...mockData.lotes.map(l => l.id), 0) + 1,
      ...req.body,
      createdAt: new Date()
    };
    mockData.lotes.push(nuevoLote);
    res.status(201).json({
      success: true,
      message: 'Lote creado exitosamente',
      data: nuevoLote
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creando lote' });
  }
});

/**
 * PUT /api/lotes/:id
 * Actualiza un lote
 */
app.put('/api/lotes/:id', authMiddleware, (req, res) => {
  try {
    const lote = mockData.lotes.find(l => l.id === parseInt(req.params.id));
    if (!lote) {
      return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    }
    Object.assign(lote, req.body);
    res.json({ success: true, message: 'Lote actualizado', data: lote });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando lote' });
  }
});

/**
 * DELETE /api/lotes/:id
 * Elimina un lote
 */
app.delete('/api/lotes/:id', authMiddleware, (req, res) => {
  try {
    const index = mockData.lotes.findIndex(l => l.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    }
    mockData.lotes.splice(index, 1);
    res.json({ success: true, message: 'Lote eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error eliminando lote' });
  }
});

// ==================== 📦 PRODUCTOS ENDPOINTS ====================

/**
 * GET /api/productos
 * Obtiene todos los productos
 */
app.get('/api/productos', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Productos obtenidos',
    data: mockData.productos,
    total: mockData.productos.length
  });
});

/**
 * GET /api/productos/test
 * Test endpoint para productos (sin autenticación)
 */
app.get('/api/productos/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test productos OK',
    data: mockData.productos
  });
});

/**
 * POST /api/productos
 * Crea un nuevo producto
 */
app.post('/api/productos', authMiddleware, (req, res) => {
  try {
    const nuevoProducto = {
      id: Math.max(...mockData.productos.map(p => p.id), 0) + 1,
      ...req.body,
      createdAt: new Date()
    };
    mockData.productos.push(nuevoProducto);
    res.status(201).json({
      success: true,
      message: 'Producto creado',
      data: nuevoProducto
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creando producto' });
  }
});

/**
 * PUT /api/productos/:id
 * Actualiza un producto
 */
app.put('/api/productos/:id', authMiddleware, (req, res) => {
  try {
    const producto = mockData.productos.find(p => p.id === parseInt(req.params.id));
    if (!producto) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    Object.assign(producto, req.body);
    res.json({ success: true, message: 'Producto actualizado', data: producto });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando producto' });
  }
});

/**
 * DELETE /api/productos/:id
 * Elimina un producto
 */
app.delete('/api/productos/:id', authMiddleware, (req, res) => {
  try {
    const index = mockData.productos.findIndex(p => p.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    mockData.productos.splice(index, 1);
    res.json({ success: true, message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error eliminando producto' });
  }
});

// ==================== 🚨 ALERTAS ENDPOINTS ====================

/**
 * GET /api/alertas
 * Obtiene todas las alertas
 */

// ============================================
// ETIQUETAS ENDPOINTS
// ============================================

app.get('/api/etiquetas/plantillas', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Plantillas obtenidas',
    data: mockData.labelTemplates || []
  });
});

// ============================================
// REPORTES ENDPOINTS
// ============================================

app.get('/api/reportes', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Reportes obtenidos',
    data: mockData.reports || []
  });
});

app.post('/api/reportes/generar', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Reporte generado',
    data: {
      id: Date.now(),
      nombre: req.body.tipo || 'Reporte',
      tipo: req.body.tipo,
      fecha: new Date().toISOString(),
      url: '/reportes/reporte_' + Date.now() + '.pdf'
    }
  });
});

// ============================================
// LOGS ENDPOINTS
// ============================================

app.get('/api/logs/sesiones', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Logs de sesión obtenidos',
    data: mockData.sessionLogs || []
  });
});

app.get('/api/alertas', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Alertas obtenidas',
    data: mockData.alertas,
    total: mockData.alertas.length
  });
});

/**
 * GET /api/alertas/test
 * Test endpoint para alertas (sin autenticación)
 */
app.get('/api/alertas/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test alertas OK',
    data: mockData.alertas
  });
});

/**
 * PUT /api/alertas/:id
 * Actualiza una alerta
 */
app.put('/api/alertas/:id', authMiddleware, (req, res) => {
  try {
    const alerta = mockData.alertas.find(a => a.id === parseInt(req.params.id));
    if (!alerta) {
      return res.status(404).json({ success: false, message: 'Alerta no encontrada' });
    }
    Object.assign(alerta, req.body);
    res.json({ success: true, message: 'Alerta actualizada', data: alerta });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando alerta' });
  }
});

/**
 * DELETE /api/alertas/:id
 * Elimina una alerta
 */
app.delete('/api/alertas/:id', authMiddleware, (req, res) => {
  try {
    const index = mockData.alertas.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Alerta no encontrada' });
    }
    mockData.alertas.splice(index, 1);
    res.json({ success: true, message: 'Alerta eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error eliminando alerta' });
  }
});

// ==================== 👥 USUARIOS ENDPOINTS ====================

/**
 * GET /api/usuarios
 * Obtiene todos los usuarios (solo admin)
 */
app.get('/api/usuarios', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'Solo admins pueden ver usuarios' });
  }
  res.json({
    success: true,
    message: 'Usuarios obtenidos',
    data: mockData.usuarios.map(u => ({ ...u, password: undefined })),
    total: mockData.usuarios.length
  });
});

/**
 * POST /api/usuarios
 * Crea un nuevo usuario (solo admin)
 */
app.post('/api/usuarios', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'Solo admins pueden crear usuarios' });
  }
  try {
    const nuevoUsuario = {
      id: Math.max(...mockData.usuarios.map(u => u.id), 0) + 1,
      ...req.body,
      createdAt: new Date()
    };
    mockData.usuarios.push(nuevoUsuario);
    res.status(201).json({
      success: true,
      message: 'Usuario creado',
      data: { ...nuevoUsuario, password: undefined }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creando usuario' });
  }
});

/**
 * PUT /api/usuarios/:id
 * Actualiza un usuario (solo admin)
 */
app.put('/api/usuarios/:id', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'Solo admins pueden editar usuarios' });
  }
  try {
    const usuario = mockData.usuarios.find(u => u.id === parseInt(req.params.id));
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    Object.assign(usuario, req.body);
    res.json({ success: true, message: 'Usuario actualizado', data: { ...usuario, password: undefined } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando usuario' });
  }
});

/**
 * DELETE /api/usuarios/:id
 * Elimina un usuario (solo admin)
 */
app.delete('/api/usuarios/:id', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'Solo admins pueden eliminar usuarios' });
  }
  try {
    const index = mockData.usuarios.findIndex(u => u.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    mockData.usuarios.splice(index, 1);
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error eliminando usuario' });
  }
});

// ==================== 📊 DASHBOARD ENDPOINTS ====================

/**
 * GET /api/dashboard/kpis
 * Obtiene KPIs del dashboard
 */
app.get('/api/dashboard/kpis', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'KPIs obtenidos',
    data: {
      lotesActivos: mockData.lotes.filter(l => l.estado === 'Activo').length,
      proximosACaducar: mockData.lotes.filter(l => l.estado === 'Por Caducar').length,
      stockBajo: mockData.productos.filter(p => p.stock <= p.stockMinimo).length,
      alertasPendientes: mockData.alertas.filter(a => a.estado === 'pendiente').length
    }
  });
});

// ==================== 🏥 HEALTH CHECK ====================

/**
 * GET /api/health
 * Verifica que el servidor está vivo
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==================== 404 HANDLER ====================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      auth: [
        'POST /api/auth/login',
        'POST /api/auth/logout',
        'POST /api/auth/verify'
      ],
      lotes: [
        'GET /api/lotes',
        'GET /api/lotes/test',
        'POST /api/lotes',
        'PUT /api/lotes/:id',
        'DELETE /api/lotes/:id'
      ],
      productos: [
        'GET /api/productos',
        'GET /api/productos/test',
        'POST /api/productos',
        'PUT /api/productos/:id',
        'DELETE /api/productos/:id'
      ],
      alertas: [
        'GET /api/alertas',
        'GET /api/alertas/test',
        'PUT /api/alertas/:id',
        'DELETE /api/alertas/:id'
      ],
      usuarios: [
        'GET /api/usuarios',
        'POST /api/usuarios',
        'PUT /api/usuarios/:id',
        'DELETE /api/usuarios/:id'
      ],
      dashboard: [
        'GET /api/dashboard/kpis'
      ],
      health: [
        'GET /api/health'
      ]
    }
  });
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   🚀 MEXHI COFFEE MANAGER v4.0             ║');
  console.log('║        Backend Running Successfully         ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`✅ Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📝 URL: http://localhost:${PORT}\n`);
  console.log('📊 Endpoints disponibles:');
  console.log('   🔐 Auth:');
  console.log('      POST   /api/auth/login');
  console.log('      POST   /api/auth/logout');
  console.log('      POST   /api/auth/verify\n');
  console.log('   📦 Lotes:');
  console.log('      GET    /api/lotes');
  console.log('      GET    /api/lotes/test');
  console.log('      POST   /api/lotes');
  console.log('      PUT    /api/lotes/:id');
  console.log('      DELETE /api/lotes/:id\n');
  console.log('   📊 Productos:');
  console.log('      GET    /api/productos');
  console.log('      GET    /api/productos/test');
  console.log('      POST   /api/productos');
  console.log('      PUT    /api/productos/:id');
  console.log('      DELETE /api/productos/:id\n');
  console.log('   🚨 Alertas:');
  console.log('      GET    /api/alertas');
  console.log('      GET    /api/alertas/test');
  console.log('      PUT    /api/alertas/:id');
  console.log('      DELETE /api/alertas/:id\n');
  console.log('   👥 Usuarios:');
  console.log('      GET    /api/usuarios');
  console.log('      POST   /api/usuarios');
  console.log('      PUT    /api/usuarios/:id');
  console.log('      DELETE /api/usuarios/:id\n');
  console.log('   📊 Dashboard:');
  console.log('      GET    /api/dashboard/kpis\n');
  console.log('   🏥 Health:');
  console.log('      GET    /api/health\n');
  console.log('🔐 Credenciales:');
  console.log('   admin@mexhi.com / password');
  console.log('   barista@mexhi.com / password');
  console.log('   almacenista@mexhi.com / password\n');
  console.log('🧪 Test endpoints (sin autenticación):');
  console.log('   GET /api/lotes/test');
  console.log('   GET /api/productos/test');
  console.log('   GET /api/alertas/test');
  console.log('   GET /api/health\n');
});

process.on('SIGINT', () => {
  console.log('\n⛔ Servidor detenido\n');
  process.exit(0);
});
