import bcrypt from "bcrypt";
import { pool } from "./poolBD.js";

export default async function addUsersToBD(data) {
  const { password, name, login, email } = data;
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (name, login, password, email) VALUES ($1, $2, $3, $4) RETURNING *",
    [name, login, passwordHash, email],
  );
  return result;
}
