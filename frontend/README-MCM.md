# 🎉 MEXHI COFFEE MANAGER v2.0 - Instalación y Uso

## 📋 Descripción General

**Mexhi Coffee Manager** es un sistema web completo de gestión de inventarios para café tostado, desarrollado con:

- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript
- **Backend:** Node.js + Express
- **Base de Datos:** Microsoft SQL Server
- **Autenticación:** JWT (JSON Web Tokens)

## 📦 Archivos Incluidos

```
mexhi-coffee-manager/
├── index-final.html          # HTML principal 
├── app-complete.js           # JavaScript 
├── style-final.css           # CSS completo y responsivo
├── README.md                 # Este archivo
└── backend/                  # Directorio para backend (Node.js)
    ├── package.json
    ├── server.js
    ├── config/
    ├── controllers/
    ├── routes/
    └── models/
```

## 🚀 Inicio Rápido

### Paso 1: Preparar Archivos

1. **Descargar los archivos:**
   - `index-final.html` → Renombrar a `index.html`
   - `app-complete.js` → Renombrar a `app.js`
   - `style-final.css` → Renombrar a `style.css`

2. **Estructura de carpetas recomendada:**
```
project/
├── index.html
├── app.js
├── style.css
└── backend/
```

### Paso 2: Instalar Backend

```bash
# Navegar a carpeta backend
cd backend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env

# Configurar conexión SQL Server en .env:
DB_SERVER=localhost
DB_USER=sa
DB_PASSWORD=TuPassword123
DB_NAME=mexhi_db
JWT_SECRET=tu_secreto_jwt_aqui

# Ejecutar servidor
npm start
# O para desarrollo:
npm run dev
```

### Paso 3: Abrir Frontend

1. **Opción A - Servidor Local (recomendado):**
```bash
# Instalar http-server globalmente
npm install -g http-server

# En la carpeta del proyecto
http-server .
# Abrir: http://localhost:8080
```

2. **Opción B - Live Server (VS Code):**
   - Instalar extensión "Live Server"
   - Click derecho en index.html → "Open with Live Server"

3. **Opción C - Python (si lo tienes instalado):**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
# Abrir: http://localhost:8000
```

## 🔐 Credenciales por Defecto

```
Email:    admin@mexhi.com
Password: password
```

**Nota:** Estas credenciales deben existir en la base de datos de SQL Server.

## 📱 Estructura del Sistema

### Frontend

#### Vistas Disponibles:
- **Dashboard** - KPIs, gráficas, alertas y lotes recientes
- **Lotes** - CRUD completo de lotes de café
- **Productos** - Gestión de catálogo de productos
- **Alertas** - Centro de gestión de alertas
- **Etiquetas** - Generación e impresión de etiquetas con QR
- **Reportes** - Generación de reportes (PDF, CSV, Excel)
- **Usuarios** - Administración de usuarios (solo admin)
- **Auditoría** - Log de sesiones y acciones
- **Manual** - Manual de usuario integrado

#### Características:
- ✅ Autenticación con JWT
- ✅ Control de acceso por roles (Admin, Almacenista, Barista)
- ✅ Interfaz responsiva
- ✅ Gráficas dinámicas con Chart.js
- ✅ Tablas paginadas
- ✅ Filtros avanzados
- ✅ Notificaciones Toast
- ✅ Modales interactivos
- ✅ Exportación de datos (CSV, PDF)
- ✅ Dark mode (opcional)

### Backend API

#### Endpoints Disponibles:

**Autenticación:**
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/validate` - Validar token JWT

**Lotes:**
- `GET /api/lotes` - Listar lotes (con paginación y filtros)
- `POST /api/lotes` - Crear lote
- `PUT /api/lotes/:id` - Editar lote
- `DELETE /api/lotes/:id` - Eliminar lote

**Productos:**
- `GET /api/productos` - Listar productos
- `POST /api/productos` - Crear producto
- `PUT /api/productos/:id` - Editar producto
- `DELETE /api/productos/:id` - Eliminar producto

**Usuarios:**
- `GET /api/usuarios` - Listar usuarios (solo admin)
- `POST /api/usuarios` - Crear usuario
- `PUT /api/usuarios/:id` - Editar usuario
- `DELETE /api/usuarios/:id` - Eliminar usuario

**Alertas:**
- `GET /api/alertas` - Listar alertas
- `PUT /api/alertas/:id` - Actualizar estado alerta
- `DELETE /api/alertas/:id` - Eliminar alerta

**Etiquetas:**
- `GET /api/etiquetas/plantillas` - Listar plantillas
- `POST /api/etiquetas/generar` - Generar etiqueta

**Reportes:**
- `GET /api/reportes` - Listar reportes disponibles
- `POST /api/reportes/generar` - Generar nuevo reporte
- `GET /api/reportes/:id/descargar` - Descargar reporte

**Dashboard:**
- `GET /api/dashboard/kpis` - Obtener KPIs
- `GET /api/logs/sesiones` - Log de sesiones

## 🎨 Personalización

### Cambiar Colores

Editar en `style.css`:

```css
:root {
  --color-dark-coffee: #4B3621;    /* Café oscuro */
  --color-coffee: #8B5E3C;         /* Marrón */
  --color-beige: #F5F0E1;          /* Beige */
  --color-light-coffee: #A67B5B;   /* Café claro */
}
```

### Cambiar Nombres o Textos

Editar en `index.html`:
- Logo y nombre en `.login-header`
- Etiquetas en `sidebar-nav`
- Textos en las secciones

### Agregar Nuevas Vistas

1. Agregar HTML en `index.html`:
```html
<section id="nueva-vista" class="view">
  <!-- Contenido -->
</section>
```

2. Agregar JavaScript en `app.js`:
```javascript
async function loadNuevaVista() {
  // Cargar datos y renderizar
}
```

3. Agregar en switch `loadViewData()`:
```javascript
case 'nueva-vista':
  loadNuevaVista();
  break;
```

## 🔧 Troubleshooting

### Error: "Cannot GET /api/..."
**Solución:** Asegúrate que el backend está corriendo en http://localhost:4000

### Error: "Invalid token"
**Solución:** Limpia localStorage y vuelve a iniciar sesión
```javascript
localStorage.removeItem('mcm_auth_token');
```

### Error: "Conexión rechazada a SQL Server"
**Solución:** Verifica credenciales en `.env` del backend

### Tabla vacía o sin datos
**Solución:** Asegúrate que existen datos en la base de datos

### CORS Error
**Solución:** Backend debe tener CORS habilitado:
```javascript
const cors = require('cors');
app.use(cors());
```

## 📚 Desarrollo

### Estructura de Carpetas Recomendada (Backend)

```
backend/
├── config/
│   ├── database.js          # Conexión SQL Server
│   └── constants.js         # Constantes de la app
├── controllers/
│   ├── authController.js
│   ├── lotesController.js
│   ├── productosController.js
│   ├── usuariosController.js
│   ├── alertasController.js
│   └── reportesController.js
├── routes/
│   ├── auth.js
│   ├── lotes.js
│   ├── productos.js
│   ├── usuarios.js
│   ├── alertas.js
│   └── reportes.js
├── models/
│   └── queries.js           # Queries SQL parametrizadas
├── middleware/
│   ├── auth.js              # Verificación JWT
│   └── errorHandler.js
├── .env                     # Variables de entorno
├── .env.example
├── package.json
└── server.js                # Punto de entrada
```

## 🔐 Seguridad

### Implementado:
- ✅ Autenticación con JWT
- ✅ Control de acceso por roles
- ✅ Prepared statements (SQL injection prevention)
- ✅ HTTPS ready
- ✅ CORS configurado
- ✅ Rate limiting (recomendado agregar)

### Recomendaciones:
- Usar HTTPS en producción
- Cambiar JWT_SECRET en .env
- Implementar rate limiting
- Validar inputs en servidor
- Usar variables de entorno para credenciales

## 📊 Base de Datos

### Tablas Requeridas (SQL Server):

```sql
CREATE DATABASE MexhiCoffeeManager;
GO
USE MexhiCoffeeManager;
GO


-- USUARIOS Y ROLES
CREATE TABLE Roles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(50) NOT NULL UNIQUE,
    descripcion NVARCHAR(200)
);

CREATE TABLE Permisos (
    id INT IDENTITY(1,1) PRIMARY KEY,
    modulo NVARCHAR(50) NOT NULL,
    puedeVer BIT DEFAULT 1,
    puedeCrear BIT DEFAULT 0,
    puedeEditar BIT DEFAULT 0,
    puedeEliminar BIT DEFAULT 0
);

CREATE TABLE RolesPermisos (
    rolId INT,
    permisoId INT,
    PRIMARY KEY (rolId, permisoId),
    FOREIGN KEY (rolId) REFERENCES Roles(id),
    FOREIGN KEY (permisoId) REFERENCES Permisos(id)
);

CREATE TABLE Usuarios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    passwordHash NVARCHAR(255) NOT NULL,
    rolId INT NOT NULL,
    estado NVARCHAR(20) DEFAULT 'Activo',
    ultimoAcceso DATETIME NULL,
    creadoEn DATETIME DEFAULT GETDATE(),
    actualizadoEn DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (rolId) REFERENCES Roles(id)
);

-- PRODUCTOS
CREATE TABLE Productos (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    origen NVARCHAR(100),
    presentacion NVARCHAR(50),
    stockMinimo DECIMAL(10,2) DEFAULT 0,
    stockActual DECIMAL(10,2) DEFAULT 0,
    precio DECIMAL(10,2),
    descripcion NVARCHAR(MAX),
    estado NVARCHAR(20) DEFAULT 'Activo',
    creadoEn DATETIME DEFAULT GETDATE(),
    actualizadoEn DATETIME DEFAULT GETDATE()
);

-- LOTES
CREATE TABLE Lotes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    codigo NVARCHAR(50) UNIQUE NOT NULL,
    productoId INT,
    origen NVARCHAR(100),
    tipoTueste NVARCHAR(50),
    peso DECIMAL(10,2),
    fechaTueste DATE,
    fechaCaducidad DATE,
    estado NVARCHAR(20) DEFAULT 'Activo',
    notas NVARCHAR(MAX),
    creadoPor INT,
    creadoEn DATETIME DEFAULT GETDATE(),
    actualizadoEn DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (productoId) REFERENCES Productos(id),
    FOREIGN KEY (creadoPor) REFERENCES Usuarios(id)
);

-- ALERTAS
CREATE TABLE Alertas (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tipo NVARCHAR(50),
    mensaje NVARCHAR(MAX),
    prioridad NVARCHAR(20),
    estado NVARCHAR(20) DEFAULT 'Pendiente',
    loteId INT NULL,
    productoId INT NULL,
    generadoPor INT,
    fecha DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (loteId) REFERENCES Lotes(id),
    FOREIGN KEY (productoId) REFERENCES Productos(id),
    FOREIGN KEY (generadoPor) REFERENCES Usuarios(id)
);

-- COLA DE IMPRESIÓN
CREATE TABLE ColaImpresionEtiquetas (
    id INT IDENTITY(1,1) PRIMARY KEY,
    loteId INT NOT NULL,
    codigo NVARCHAR(50),
    estado NVARCHAR(20) DEFAULT 'Pendiente',
    cantidad INT,
    fechaCreacion DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (loteId) REFERENCES Lotes(id)
);

-- HISTORIAL DE ACCESOS
CREATE TABLE HistorialAccesos (
    id INT IDENTITY(1,1) PRIMARY KEY,
    usuarioId INT,
    accion NVARCHAR(100),
    tiempoUso INT,
    fechaHora DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (usuarioId) REFERENCES Usuarios(id)
);

-- AUDITORÍA
CREATE TABLE AuditLog (
    id INT IDENTITY(1,1) PRIMARY KEY,
    entidad NVARCHAR(50),
    entidadId INT,
    usuarioId INT,
    accion NVARCHAR(50),
    valoresPrevios NVARCHAR(MAX),
    valoresNuevos NVARCHAR(MAX),
    fechaHora DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (usuarioId) REFERENCES Usuarios(id)
);

## 🚀 Deployment

### Heroku/Vercel (Frontend):
```bash
# Crear archivo Procfile
echo "web: http-server -p $PORT" > Procfile

# Desplegar
git push heroku main
```

### AWS/Azure (Backend):
- Usar RDS para SQL Server
- Configurar variables de entorno
- Usar load balancer para alta disponibilidad

## 📞 Soporte

Para reportar problemas o sugerencias:

1. Verificar console del navegador (F12)
2. Revisar logs del backend
3. Verificar conexión a base de datos
4. Revisar variables de entorno

## 📄 Licencia

Este proyecto está desarrollado para Mexhi Coffee Manager.

---

**Versión:** 2.0  
**Última actualización:** Enero 2026  
**Estado:** Producción Ready ✅
