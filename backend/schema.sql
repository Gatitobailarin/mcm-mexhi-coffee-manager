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

-- COLA DE IMPRESI�N
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

-- AUDITOR�A
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
-- ROLES Y PERMISOS
INSERT INTO Roles (nombre, descripcion) VALUES 
('Administrador', 'Acceso completo al sistema'),
('Barista', 'Gesti�n de lotes y etiquetas'),
('Almacenista', 'Gesti�n de inventario y lotes');

INSERT INTO Permisos (modulo, puedeVer, puedeCrear, puedeEditar, puedeEliminar) VALUES
('dashboard', 1, 0, 0, 0),
('lotes', 1, 1, 1, 0),
('productos', 1, 0, 0, 0),
('usuarios', 1, 0, 0, 0),
('etiquetas', 1, 1, 0, 0),
('reportes', 1, 0, 0, 0);

-- USUARIOS (contrase�as hasheadas con bcrypt)
INSERT INTO Usuarios (nombre, email, passwordHash, rolId) VALUES 
('Administrador', 'admin@mexhi.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1),
('Ana Garc�a', 'ana@mexhi.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 2),
('Juan Morales', 'juan@mexhi.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3);

-- PRODUCTOS (datos de mock_data.json)
INSERT INTO Productos (nombre, origen, presentacion, stockMinimo, stockActual, precio, descripcion) VALUES 
('Colombia Huila Premium', 'Colombia Huila', '250g', 20, 45, 180.00, 'Caf� premium con notas florales y cuerpo medio'),
('Guatemala Antigua Oscuro', 'Guatemala Antigua', '500g', 15, 32, 220.00, 'Tueste oscuro con cuerpo completo y notas achocolatadas');

-- LOTES (datos de mock_data.json)
INSERT INTO Lotes (codigo, productoId, origen, tipoTueste, peso, fechaTueste, fechaCaducidad, estado, notas) VALUES 
('MCX-001-2025', 1, 'Colombia Huila', 'Medio', 500, '2025-09-25', '2025-11-25', 'Activo', 'Lote premium, notas florales'),
('MCX-002-2025', 1, 'Guatemala Antigua', 'Oscuro', 750, '2025-09-23', '2025-11-23', 'Activo', 'Cuerpo completo, chocolate amargo');


SELECT local_net_address, local_tcp_port
FROM sys.dm_exec_connections
WHERE session_id = @@SPID;

SELECT email, estado FROM Usuarios;


