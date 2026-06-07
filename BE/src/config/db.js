const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  name: process.env.DB_NAME || 'mri_db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

module.exports = DB_CONFIG;
