const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'Daughter18',
  port: 5432,
});

const createUserTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      email VARCHAR(50) NOT NULL,
      password VARCHAR(255) NOT NULL
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log('Users table created successfully');
  } catch (error) {
    console.error('Error creating users table:', error);
  }
};

const insertUser = async (username, email, password) => {
  const insertQuery = `
    INSERT INTO users (username, email, password) 
    VALUES ($1, $2, $3) 
    RETURNING *;
  `;
  try {
    const result = await pool.query(insertQuery, [username, email, password]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const findUserByUsername = async (username) => {
  const findQuery = 'SELECT * FROM users WHERE username = $1';
  try {
    const result = await pool.query(findQuery, [username]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createUserTable,
  insertUser,
  findUserByUsername,
};
