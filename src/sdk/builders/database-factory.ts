import { DatabaseBuilder } from "./database.js";

export function createDatabaseBuilder(id: string): DatabaseBuilder {
  return new DatabaseBuilder(id);
}
