require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Added bcrypt for password comparison
const { sql, poolPromise } = require('./config/db');

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

// ==================== LOGGING UTILITIES ====================
async function logActivity(usuarioId, email, action, status, req) {
  try {
    const pool = await poolPromise;
    const ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    await pool.request()
      .input('usuarioId', sql.Int, usuarioId)
      .input('email', sql.NVarChar, email)
      .input('accion', sql.NVarChar, action)
      .input('estado', sql.NVarChar, status)
      .input('ip', sql.NVarChar, ip)
      .input('navegador', sql.NVarChar, userAgent)
      .query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ActivityLogs' AND xtype='U')
                CREATE TABLE ActivityLogs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    usuarioId INT NULL,
                    email NVARCHAR(255),
                    accion NVARCHAR(100),
                    fecha DATETIME DEFAULT GETDATE(),
                    ip NVARCHAR(50),
                    navegador NVARCHAR(MAX),
                    estado NVARCHAR(50)
                )

                INSERT INTO ActivityLogs (usuarioId, email, accion, fecha, ip, navegador, estado)
                VALUES (@usuarioId, @email, @accion, GETDATE(), @ip, @navegador, @estado)
            `);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

// Ensure ActivityLogs table exists
(async () => {
  try {
    const pool = await poolPromise;
    await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ActivityLogs' AND xtype='U')
            CREATE TABLE ActivityLogs (
                id INT IDENTITY(1,1) PRIMARY KEY,
                usuarioId INT NULL,
                email NVARCHAR(255),
                accion NVARCHAR(100),
                fecha DATETIME DEFAULT GETDATE(),
                ip NVARCHAR(50),
                navegador NVARCHAR(255),
                estado NVARCHAR(50)
            )
        `);
    console.log('✅ Tabla ActivityLogs verificada/creada');
  } catch (error) {
    console.error('❌ Error verificando tabla ActivityLogs:', error);
  }
})();


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
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      await logActivity(null, email || 'unknown', 'LOGIN', 'FALLO', req);
      return res.status(400).json({ success: false, message: 'Email y password requeridos' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT u.id, u.nombre, u.email, u.passwordHash, r.nombre as rol
        FROM Usuarios u
        INNER JOIN Roles r ON u.rolId = r.id
        WHERE u.email = @email AND u.estado = 'Activo'
      `);

    if (result.recordset.length === 0) {
      await logActivity(null, email, 'LOGIN', 'FALLO', req);
      return res.status(401).json({ success: false, message: 'Email o contraseña inválidos' });
    }

    const usuario = result.recordset[0];

    // Compare password (assuming DB has hashes, or plain password for now if legacy)
    // Note: Schema seeds imply hashes ($2b$...). 
    // Fallback: If hash check fails, try plain text for legacy dev data reset
    let passwordMatch = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordMatch && password === usuario.passwordHash) {
      passwordMatch = true; // For simple dev/test cases if plain text was stored
    }

    if (!passwordMatch) {
      await logActivity(usuario.id, usuario.email, 'LOGIN', 'FALLO', req);
      return res.status(401).json({ success: false, message: 'Email o contraseña inválidos' });
    }

    try {
      const updateResult = await pool.request()
        .input('id', sql.Int, usuario.id)
        .query('UPDATE Usuarios SET ultimoAcceso = GETDATE() WHERE id = @id');
    } catch (errUpdate) {
      console.error("❌ Error actualizando fecha acceso:", errUpdate);
    }

    // SUCCESS LOG
    await logActivity(usuario.id, usuario.email, 'LOGIN EXITOSO', 'EXITO', req);

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

app.post('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Token válido',
    data: { user: req.user }
  });
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await logActivity(req.user.id, req.user.email, 'LOGOUT', 'EXITO', req);
    res.json({ success: true, message: 'Sesión cerrada' });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// ==================== 📊 LOTES ENDPOINTS ====================
// ==================== 📊 LOTES ENDPOINTS ====================

app.get('/api/lotes', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;

    const { origen, estado, desde, hasta } = req.query;

    let query = `
      SELECT l.*, p.nombre as productoNombre, u.nombre as creadorNombre
      FROM Lotes l
      LEFT JOIN Productos p ON l.productoId = p.id
      LEFT JOIN Usuarios u ON l.creadoPor = u.id
      WHERE 1=1
    `;

    const params = pool.request();

    if (origen) {
      query += ' AND l.origen LIKE @origen';
      params.input('origen', sql.NVarChar, `%${origen}%`);
    }

    if (estado) {
      query += ' AND l.estado = @estado';
      params.input('estado', sql.NVarChar, estado);
    }

    // 📅 FILTRO DESDE (filterDesde)
    if (desde) {
      query += ' AND l.fechaTueste >= @desde';
      params.input('desde', sql.Date, desde);
    }

    // 📅 FILTRO HASTA (filterHasta)
    if (hasta) {
      query += ' AND l.fechaTueste <= @hasta';
      params.input('hasta', sql.Date, hasta);
    }

    // ✅ TU ORDEN ORIGINAL MANTENIDA
    query += ' ORDER BY l.creadoEn DESC';

    const result = await params.query(query);

    res.json({
      success: true,
      message: 'Lotes obtenidos',
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error obteniendo lotes' });
  }
});

app.post('/api/lotes', authMiddleware, async (req, res) => {
  try {
    const { codigo, productoId, origen, tipoTueste, peso, fechaTueste, fechaCaducidad, estado, notas } = req.body;
    const pool = await poolPromise;

    // Insert and get the new ID
    const result = await pool.request()
      .input('codigo', sql.NVarChar, codigo)
      .input('productoId', sql.Int, productoId || null)
      .input('origen', sql.NVarChar, origen)
      .input('tipoTueste', sql.NVarChar, tipoTueste)
      .input('peso', sql.Decimal(10, 2), peso)
      .input('fechaTueste', sql.Date, fechaTueste)
      .input('fechaCaducidad', sql.Date, fechaCaducidad)
      .input('estado', sql.NVarChar, estado || 'Activo')
      .input('notas', sql.NVarChar, notas || '')
      .input('creadoPor', sql.Int, req.user.id)
      .query(`
        INSERT INTO Lotes (codigo, productoId, origen, tipoTueste, peso, fechaTueste, fechaCaducidad, estado, notas, creadoPor)
        OUTPUT INSERTED.*
        VALUES (@codigo, @productoId, @origen, @tipoTueste, @peso, @fechaTueste, @fechaCaducidad, @estado, @notas, @creadoPor)
      `);

    res.status(201).json({
      success: true,
      message: 'Lote creado exitosamente',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error creando lote' });
  }
});

app.put('/api/lotes/:id', authMiddleware, async (req, res) => {
  try {
    const { codigo, productoId, origen, tipoTueste, peso, fechaTueste, fechaCaducidad, estado, notas } = req.body;
    const id = req.params.id;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('codigo', sql.NVarChar, codigo)
      .input('productoId', sql.Int, productoId || null)
      .input('origen', sql.NVarChar, origen)
      .input('tipoTueste', sql.NVarChar, tipoTueste)
      .input('peso', sql.Decimal(10, 2), peso)
      .input('fechaTueste', sql.Date, fechaTueste)
      .input('fechaCaducidad', sql.Date, fechaCaducidad)
      .input('estado', sql.NVarChar, estado)
      .input('notas', sql.NVarChar, notas)
      .query(`
            UPDATE Lotes 
            SET codigo=@codigo, productoId=@productoId, origen=@origen, tipoTueste=@tipoTueste,
                peso=@peso, fechaTueste=@fechaTueste, fechaCaducidad=@fechaCaducidad,
                estado=@estado, notas=@notas
            WHERE id = @id
        `);

    res.json({ success: true, message: 'Lote actualizado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando lote' });
  }
});

app.delete('/api/lotes/:id', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Lotes WHERE id = @id');
    res.json({ success: true, message: 'Lote eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error eliminando lote' });
  }
});

// ==================== 📦 PRODUCTOS ENDPOINTS ====================

app.get('/api/productos', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Productos ORDER BY nombre');
    res.json({
      success: true,
      message: 'Productos obtenidos',
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error obteniendo productos' });
  }
});

app.post('/api/productos', authMiddleware, async (req, res) => {
  try {
    const { nombre, origen, grano, stockActual, stockMinimo, precioUnitario, descripcion, presentacion } = req.body;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('nombre', sql.NVarChar, nombre)
      .input('origen', sql.NVarChar, origen)
      .input('grano', sql.NVarChar, grano)
      .input('stockActual', sql.Decimal(10, 2), stockActual)
      .input('stockMinimo', sql.Decimal(10, 2), stockMinimo)
      .input('precioUnitario', sql.Decimal(10, 2), precioUnitario)
      .input('descripcion', sql.NVarChar, descripcion)
      .input('presentacion', sql.NVarChar, presentacion)
      .query(`
        INSERT INTO Productos (nombre, origen, grano, stockActual, stockMinimo, precio, descripcion, presentacion)
        VALUES (@nombre, @origen, @grano, @stockActual, @stockMinimo, @precioUnitario, @descripcion, @presentacion)
      `);
    res.status(201).json({ success: true, message: 'Producto creado' });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ success: false, message: 'Error creando producto' });
  }
});

app.put('/api/productos/:id', authMiddleware, async (req, res) => {
  try {
    const { nombre, origen, grano, stockActual, stockMinimo, precioUnitario, descripcion, presentacion } = req.body;
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('nombre', sql.NVarChar, nombre)
      .input('origen', sql.NVarChar, origen)
      .input('grano', sql.NVarChar, grano)
      .input('stockActual', sql.Decimal(10, 2), stockActual)
      .input('stockMinimo', sql.Decimal(10, 2), stockMinimo)
      .input('precioUnitario', sql.Decimal(10, 2), precioUnitario)
      .input('descripcion', sql.NVarChar, descripcion)
      .input('presentacion', sql.NVarChar, presentacion)
      .query(`
        UPDATE Productos SET 
          nombre=@nombre, origen=@origen, grano=@grano,
          stockActual=@stockActual, stockMinimo=@stockMinimo, 
          precio=@precioUnitario, descripcion=@descripcion, 
          presentacion=@presentacion
        WHERE id = @id
      `);
    res.json({ success: true, message: 'Producto actualizado' });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ success: false, message: 'Error actualizando producto' });
  }
});

app.delete('/api/productos/:id', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Productos WHERE id = @id');
    res.json({ success: true, message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error eliminando producto' });
  }
});

// ==================== 🚨 ALERTAS ENDPOINTS ====================

app.get('/api/alertas', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;

    // 1. GENERATE AUTOMATIC ALERTS
    // ==========================================

    // A. STOCK BAJO
    // Find products with low stock that don't have an ACTIVE alert
    const lowStockProducts = await pool.request().query(`
      SELECT p.id, p.nombre, p.stockActual, p.stockMinimo 
      FROM Productos p 
      WHERE p.stockActual <= p.stockMinimo
      AND NOT EXISTS (
        SELECT 1 FROM Alertas a 
        WHERE a.productoId = p.id 
        AND a.tipo = 'STOCK' 
        AND a.estado = 'Pendiente'
      )
    `);

    for (const prod of lowStockProducts.recordset) {
      const priority = prod.stockActual === 0 ? 'ALTA' : 'MEDIA';
      const msg = prod.stockActual === 0
        ? `Producto agotado: ${prod.nombre}`
        : `Stock bajo para ${prod.nombre} (${prod.stockActual}/${prod.stockMinimo})`;

      await pool.request()
        .input('titulo', sql.NVarChar, 'Stock bajo mínimo')
        .input('mensaje', sql.NVarChar, msg)
        .input('tipo', sql.NVarChar, 'STOCK')
        .input('prioridad', sql.NVarChar, priority)
        .input('estado', sql.NVarChar, 'Pendiente')
        .input('productoId', sql.Int, prod.id)
        .input('generadoPor', sql.Int, req.user.id)
        .query(`
          INSERT INTO Alertas (titulo, mensaje, tipo, prioridad, estado, fecha, productoId, generadoPor)
          VALUES (@titulo, @mensaje, @tipo, @prioridad, @estado, GETDATE(), @productoId, @generadoPor)
        `);
    }

    // B. LOTES PRÓXIMOS A CADUCAR (30 días)
    const expiringLotes = await pool.request().query(`
      SELECT l.id, l.codigo, l.fechaCaducidad, p.nombre as prodNombre
      FROM Lotes l
      JOIN Productos p ON l.productoId = p.id
      WHERE l.fechaCaducidad <= DATEADD(day, 30, GETDATE())
      AND l.fechaCaducidad >= GETDATE()
      AND l.estado = 'Activo'
      AND NOT EXISTS (
        SELECT 1 FROM Alertas a 
        WHERE a.loteId = l.id 
        AND a.tipo = 'CADUCIDAD' 
        AND a.estado = 'Pendiente'
      )
    `);

    for (const lote of expiringLotes.recordset) {
      const daysLeft = Math.ceil((new Date(lote.fechaCaducidad) - new Date()) / (1000 * 60 * 60 * 24));
      await pool.request()
        .input('titulo', sql.NVarChar, 'Lote próximo a caducar')
        .input('mensaje', sql.NVarChar, `El lote ${lote.codigo} (${lote.prodNombre}) caduca en ${daysLeft} días`)
        .input('tipo', sql.NVarChar, 'CADUCIDAD')
        .input('prioridad', sql.NVarChar, daysLeft < 7 ? 'ALTA' : 'MEDIA')
        .input('estado', sql.NVarChar, 'Pendiente')
        .input('loteId', sql.Int, lote.id)
        .input('generadoPor', sql.Int, req.user.id)
        .query(`
          INSERT INTO Alertas (titulo, mensaje, tipo, prioridad, estado, fecha, loteId, generadoPor)
          VALUES (@titulo, @mensaje, @tipo, @prioridad, @estado, GETDATE(), @loteId, @generadoPor)
        `);
    }

    // 2. FETCH ALL ALERTS
    // ==========================================
    const result = await pool.request().query('SELECT * FROM Alertas ORDER BY CASE WHEN estado = \'Pendiente\' THEN 0 ELSE 1 END, fecha DESC');

    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (error) {
    console.error("Error generating/fetching alerts:", error);
    res.status(500).json({ success: false, message: 'Error obteniendo alertas' });
  }
});

// Endpoint to Resolve/Dismiss/Delete Alert
app.put('/api/alertas/:id', authMiddleware, async (req, res) => {
  try {
    const { estado } = req.body; // 'Resuelto', 'Descartado'
    const id = req.params.id;
    const pool = await poolPromise;

    await pool.request()
      .input('id', sql.Int, id)
      .input('estado', sql.NVarChar, estado)
      .query('UPDATE Alertas SET estado = @estado WHERE id = @id');

    res.json({ success: true, message: 'Alerta actualizada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando alerta' });
  }
});

// ==================== 👥 USUARIOS ENDPOINTS ====================

app.get('/api/usuarios', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'No autorizado' });
  }
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT u.id, u.nombre, u.email, u.estado, u.ultimoAcceso, r.nombre as rol, r.id as rolId
            FROM Usuarios u
            JOIN Roles r ON u.rolId = r.id
        `);

    // DEBUG: Print first user to check columns
    if (result.recordset.length > 0) {
      console.log('🔍 GET /api/usuarios DEBUG:', result.recordset[0]);
    }

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error' });
  }
});

app.post('/api/usuarios', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'No autorizado' });
  }
  try {
    const { nombre, email, password, rol } = req.body;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Get Rol ID (Assuming Roles table exists: 1=Admin, 2=Barista, 3=Almacenista)
    // Dynamic lookup is better
    const pool = await poolPromise;
    const rolResult = await pool.request()
      .input('rolName', sql.NVarChar, rol)
      .query("SELECT id FROM Roles WHERE nombre = @rolName OR nombre = 'Administrador' AND @rolName = 'admin'");

    let rolId = 2; // Default Barista
    if (rolResult.recordset.length > 0) rolId = rolResult.recordset[0].id;
    else if (rol === 'admin') rolId = 1;
    else if (rol === 'almacenista') rolId = 3;

    await pool.request()
      .input('nombre', sql.NVarChar, nombre)
      .input('email', sql.NVarChar, email)
      .input('passwordHash', sql.NVarChar, passwordHash)
      .input('rolId', sql.Int, rolId)
      .query(`
        INSERT INTO Usuarios (nombre, email, passwordHash, rolId, estado, creadoEn)
        VALUES (@nombre, @email, @passwordHash, @rolId, 'Activo', GETDATE())
      `);

    res.status(201).json({ success: true, message: 'Usuario creado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creando usuario' });
  }
});

app.put('/api/usuarios/:id', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'No autorizado' });
  }
  try {
    const { nombre, email, password, rol, estado } = req.body;
    const id = req.params.id;
    const pool = await poolPromise;

    let rolId = null;
    if (rol) {
      const rolResult = await pool.request()
        .input('rolName', sql.NVarChar, rol)
        .query("SELECT id FROM Roles WHERE nombre = @rolName OR (nombre = 'Administrador' AND @rolName = 'admin')");

      if (rolResult.recordset.length > 0) {
        rolId = rolResult.recordset[0].id;
      } else {
        if (rol === 'admin') rolId = 1;
        else if (rol === 'barista') rolId = 2;
        else if (rol === 'almacenista') rolId = 3;
      }
    }

    let query = "UPDATE Usuarios SET nombre=@nombre, email=@email, estado=@estado";
    const reqSql = pool.request()
      .input('id', sql.Int, id)
      .input('nombre', sql.NVarChar, nombre)
      .input('email', sql.NVarChar, email)
      .input('estado', sql.NVarChar, estado || 'Activo');

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      query += ", passwordHash=@passwordHash";
      reqSql.input('passwordHash', sql.NVarChar, passwordHash);
    }

    if (rolId) {
      query += ", rolId=@rolId";
      reqSql.input('rolId', sql.Int, rolId);
    }

    query += " WHERE id=@id";
    await reqSql.query(query);

    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error actualizando usuario' });
  }
});

app.delete('/api/usuarios/:id', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'No autorizado' });
  }
  try {
    const pool = await poolPromise;
    if (req.user.id == req.params.id) {
      return res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario' });
    }

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query("DELETE FROM Usuarios WHERE id = @id");

    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error eliminando usuario' });
  }
});

// ==================== 📜 LOGS ENDPOINTS ====================

app.get('/api/logs', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'No autorizado' });
  }

  try {
    const pool = await poolPromise;
    let query = `
            SELECT l.*, u.nombre as usuarioNombre 
            FROM ActivityLogs l
            LEFT JOIN Usuarios u ON l.usuarioId = u.id
            WHERE 1=1
        `;

    // Filters
    if (req.query.userId && req.query.userId !== 'all') {
      query += ` AND l.usuarioId = @userId`;
    }
    if (req.query.date) {
      query += ` AND CAST(l.fecha AS DATE) = @date`;
    }

    query += ` ORDER BY l.fecha DESC`;

    const request = pool.request();
    if (req.query.userId && req.query.userId !== 'all') request.input('userId', sql.Int, req.query.userId);
    if (req.query.date) request.input('date', sql.Date, req.query.date);

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, message: 'Error recuperando logs' });
  }
});

// ==================== 📊 DASHBOARD ENDPOINTS ====================

app.get('/api/dashboard/kpis', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;

    // Execute multiple queries in parallel or batch
    const request = pool.request();

    // For simplicity, we can do separate queries or one batched query
    // Let's do a simple aggregated query approach

    const lotesActivosResult = await pool.request().query("SELECT COUNT(*) as count FROM Lotes WHERE estado = 'Activo'");
    const proximosResult = await pool.request().query("SELECT COUNT(*) as count FROM Lotes WHERE fechaCaducidad < DATEADD(day, 30, GETDATE()) AND estado = 'Activo'");
    const stockBajoResult = await pool.request().query("SELECT COUNT(*) as count FROM Productos WHERE stockActual <= stockMinimo");
    const alertasResult = await pool.request().query("SELECT COUNT(*) as count FROM Alertas WHERE estado = 'Pendiente'");

    // Add Recent Alerts
    const recentAlertsResult = await pool.request().query("SELECT TOP 5 * FROM Alertas ORDER BY fecha DESC");

    res.json({
      success: true,
      message: 'KPIs obtenidos',
      data: {
        lotesActivos: lotesActivosResult.recordset[0].count,
        proximosCaducar: proximosResult.recordset[0].count,
        stockBajo: stockBajoResult.recordset[0].count,
        alertasActivas: alertasResult.recordset[0].count,
        recentAlerts: recentAlertsResult.recordset
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error obteniendo KPIs' });
  }
});

/**
 * GET /api/dashboard/charts
 * Obtiene datos para las gráficas
 */
app.get('/api/dashboard/charts', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;

    // 1. Stock Data (Top 10 products by stock or just all)
    const stockResult = await pool.request().query("SELECT nombre, stockActual FROM Productos");

    // 2. Alerts Distribution
    // Group by 'tipo' (Caducidad, Stock Bajo, Sistema, etc.)
    const alertsResult = await pool.request().query("SELECT tipo, COUNT(*) as count FROM Alertas GROUP BY tipo");

    // Format for frontend
    const stockData = {
      labels: stockResult.recordset.map(p => p.nombre),
      data: stockResult.recordset.map(p => p.stockActual)
    };

    const alertsData = {
      labels: alertsResult.recordset.map(a => a.tipo),
      data: alertsResult.recordset.map(a => a.count)
    };

    res.json({
      success: true,
      data: {
        stock: stockData,
        alertas: alertsData
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error obteniendo datos de gráficas' });
  }
});

// ==================== 📊 REPORTES ENDPOINTS ====================

app.get('/api/reportes', authMiddleware, async (req, res) => {
  // Mock listing of available reports since we generate them on the fly
  const availableReports = [
    {
      id: 1,
      nombre: 'Inventario General',
      tipo: 'inventario',
      descripcion: 'Reporte completo de productos y stock',
      frecuencia: 'A demanda',
      formato: 'CSV, JSON'
    },
    {
      id: 2,
      nombre: 'Movimientos de Stock',
      tipo: 'movimientos',
      descripcion: 'Historial de creación de lotes',
      frecuencia: 'A demanda',
      formato: 'CSV, JSON'
    }
  ];

  res.json({
    success: true,
    data: availableReports
  });
});

app.post('/api/reportes/generate', authMiddleware, async (req, res) => {
  try {
    const { type, format } = req.body;
    let { startDate, endDate } = req.body;
    const pool = await poolPromise;

    if (!startDate) startDate = new Date(0).toISOString();
    if (!endDate) endDate = new Date().toISOString();

    let data = [];
    let filename = `reporte-${type}-${Date.now()}`;
    let csvContent = '';

    if (type === 'inventario') {
      const result = await pool.request().query('SELECT * FROM Productos ORDER BY nombre');
      data = result.recordset.map(p => ({
        ID: p.id,
        Nombre: p.nombre,
        Origen: p.origen,
        Grano: p.grano,
        Presentacion: p.presentacion || '',
        StockActual: p.stockActual,
        StockMinimo: p.stockMinimo,
        Precio: p.precio,
        ValorTotal: (p.stockActual * p.precio).toFixed(2)
      }));
      filename = `inventario-${new Date().toISOString().split('T')[0]}`;

    } else if (type === 'movimientos') {
      const result = await pool.request()
        .input('start', sql.Date, startDate)
        .input('end', sql.Date, endDate)
        .query(`
          SELECT l.codigo, l.origen, l.tipoTueste, l.peso, l.fechaTueste, l.fechaCaducidad, l.estado, 
                 p.nombre as Producto, u.nombre as CreadoPor, l.creadoEn
          FROM Lotes l
          LEFT JOIN Productos p ON l.productoId = p.id
          LEFT JOIN Usuarios u ON l.creadoPor = u.id
          WHERE l.creadoEn >= @start AND l.creadoEn <= @end
          ORDER BY l.creadoEn DESC
        `);

      data = result.recordset.map(l => ({
        Codigo: l.codigo,
        Producto: l.Producto,
        Origen: l.origen,
        Tueste: l.tipoTueste,
        Peso: l.peso,
        FechaTueste: l.fechaTueste ? new Date(l.fechaTueste).toISOString().split('T')[0] : '',
        Caducidad: l.fechaCaducidad ? new Date(l.fechaCaducidad).toISOString().split('T')[0] : '',
        Estado: l.estado,
        CreadoPor: l.CreadoPor,
        FechaCreacion: l.creadoEn ? new Date(l.creadoEn).toISOString().split('T')[0] : ''
      }));
      filename = `movimientos-${new Date().toISOString().split('T')[0]}`;

    } else {
      return res.status(400).json({ success: false, message: 'Tipo de reporte no soportado' });
    }

    if (format === 'CSV') {
      if (data.length > 0) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
        csvContent = `${headers}\n${rows}`;
      } else {
        csvContent = 'No hay datos para este reporte';
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.send(csvContent);
    }

    // Default: Return JSON for other formats (handled by frontend)
    res.json({ success: true, data, filename });


  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, message: 'Error generando reporte' });
  }
});

// ==================== 🏥 HEALTH CHECK ====================

app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const pool = await poolPromise;
    if (pool.connected) dbStatus = 'connected';
  } catch (e) { dbStatus = 'error'; }

  res.json({
    success: true,
    message: 'Servidor funcionando',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📝 Modo DB: MSSQL (MexhiCoffeeManager2)`);
});

