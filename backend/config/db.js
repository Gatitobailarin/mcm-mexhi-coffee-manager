const sql = require('mssql');
require('dotenv').config(); // Ensure env vars are loaded

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    encrypt: false, // For local development, often false is needed if certificate isn't set up
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Conectado a SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('❌ Error conectando a SQL Server:', err);
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise
};
