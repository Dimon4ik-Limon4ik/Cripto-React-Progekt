// import pg from "pg";
import express from "express";
import { getCrypto } from "./endpoin/apiCoinGecko.js";
const app = express();
const PORT = 3000;

// const { Pool } = pg;
// const pool = new Pool({
//   user: "postgres",
//   password: "89885612",
//   host: "localhost",
//   port: 5432,
//   database: "my_crypto",
// });


app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});

