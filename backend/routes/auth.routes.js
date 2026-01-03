const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const poolPromise = require('../config/db');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email y contraseña requeridos' 
      });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', email)
      .query(`
        SELECT u.id, u.nombre, u.email, u.passwordHash, u.rolId, r.nombre as rol
        FROM Usuarios u
        JOIN Roles r ON u.rolId = r.id
        WHERE u.email = @email AND u.estado = 'Activo'
      `);

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    // Generar JWT
    const token = jwt.sign(
      { 
        sub: user.id, 
        nombre: user.nombre, 
        email: user.email, 
        rol: user.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Actualizar último acceso
    await pool.request()
      .input('id', user.id)
      .query('UPDATE Usuarios SET ultimoAcceso = GETDATE() WHERE id = @id');

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

module.exports = router;
