require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

// ✅ IMPORTS EXISTENTES
const poolPromise = require('./config/db');
const authRoutes = require('./routes/auth.routes');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret123';

// ==================== MIDDLEWARE ====================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ CORS CONFIGURADO PROFESIONAL
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8081',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://192.168.100.72:8081'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir herramientas como Postman o curl
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.error('❌ CORS bloqueado para origen:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== DATOS DEMO ====================

const demoUsuarios = {
  'admin@mexhi.com': { 
    id: 1, 
    nombre: 'Admin MCM', 
    email: 'admin@mexhi.com',
    rol: 'admin', 
    password: 'password' 
  },
  'barista@mexhi.com': { 
    id: 2, 
    nombre: 'Juan Barista', 
    email: 'barista@mexhi.com',
    rol: 'barista', 
    password: 'password' 
  },
  'almacenista@mexhi.com': { 
    id: 3, 
    nombre: 'Carlos Almacén', 
    email: 'almacenista@mexhi.com',
    rol: 'almacenista', 
    password: 'password' 
  }
};

// ==================== UTILIDADES ====================

// Generar JWT
const generateToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol || 'user'
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Verificar JWT
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// ==================== ENDPOINTS LOGIN ====================

/**
 * POST /api/auth/login
 * Login con credenciales
 * Body: { email, password }
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validación básica
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y password requeridos'
      });
    }

    // Buscar usuario en demo data
    const usuario = demoUsuarios[email];

    // Validar credenciales
    if (!usuario || usuario.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generateToken(usuario);

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error en servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (invalidar token)
 */
app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout exitoso'
  });
});

/**
 * POST /api/auth/verify
 * Verificar si token es válido
 */
app.post('/api/auth/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    res.json({
      success: true,
      usuario: decoded
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== RUTAS EXISTENTES ====================

app.use('/api/auth', authRoutes);

// ==================== HEALTH CHECK ====================

app.get('/api/health', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT @@VERSION as version');
    res.json({
      success: true,
      status: 'OK',
      message: 'Servidor funcionando correctamente',
      sqlServer: result.recordset[0].version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'ERROR',
      message: 'Base de datos no disponible',
      error: error.message
    });
  }
});

// ==================== TEST ENDPOINTS ====================

/**
 * GET /api/lotes/test
 * Obtener 5 lotes de prueba
 */
app.get('/api/lotes/test', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 5 
        id, 
        codigo, 
        origen, 
        tipoTueste, 
        peso, 
        estado,
        fecha
      FROM Lotes 
      ORDER BY fecha DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo lotes',
      error: error.message
    });
  }
});

/**
 * GET /api/productos/test
 * Obtener 5 productos de prueba
 */
app.get('/api/productos/test', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 5 
        id,
        nombre,
        stock,
        stockMinimo,
        precio,
        estado
      FROM Productos
      ORDER BY fecha DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo productos',
      error: error.message
    });
  }
});

/**
 * GET /api/alertas/test
 * Obtener 5 alertas de prueba
 */
app.get('/api/alertas/test', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 5
        id,
        titulo,
        descripcion,
        tipo,
        prioridad,
        estado,
        fecha
      FROM Alertas
      ORDER BY fecha DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo alertas',
      error: error.message
    });
  }
});

// ==================== ERROR HANDLING ====================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.path,
    method: req.method
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ==================== INICIO DEL SERVIDOR ====================

const startServer = () => {
  app.listen(PORT, () => {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║     🚀 MEXHI COFFEE MANAGER - BACKEND        ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log(`\n✅ Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`\n📊 Endpoints disponibles:`);
    console.log(`   POST   /api/auth/login          - Login`);
    console.log(`   POST   /api/auth/logout         - Logout`);
    console.log(`   POST   /api/auth/verify         - Verificar token`);
    console.log(`   GET    /api/health              - Health check`);
    console.log(`   GET    /api/lotes/test          - Test lotes`);
    console.log(`   GET    /api/productos/test      - Test productos`);
    console.log(`   GET    /api/alertas/test        - Test alertas`);
    console.log(`\n🧪 Testing:`);
    console.log(`   curl -X POST http://localhost:${PORT}/api/auth/login \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"email":"admin@mexhi.com","password":"password"}'`);
    console.log(`\n💾 Base de datos: ${process.env.DB_NAME || 'conexión pendiente'}`);
    console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✅ Configurado' : '⚠️  Usando default'}`);
    console.log(`\n📝 Frontend esperado en: http://127.0.0.1:8080`);
    console.log('\n');
  });
};

// Conectar a BD y arrancar servidor
poolPromise
  .then(() => {
    console.log('✅ Conectado a SQL Server\n');
    startServer();
  })
  .catch(err => {
    console.error('❌ Error conexión SQL Server:', err.message);
    console.log('\n⚠️  Iniciando servidor sin BD (modo demo)...\n');
    startServer();
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⛔ Deteniendo servidor...');
  process.exit(0);
});