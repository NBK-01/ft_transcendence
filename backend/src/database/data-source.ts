import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

config();

export const typeOrmModuleOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: false,
  entitySkipConstructor: true,
  logging: ['error'],
  poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  maxQueryExecutionTime: 1000,
};

// Default export required by the TypeORM CLI (see package.json's "typeorm" script).
const dataSource = new DataSource(typeOrmModuleOptions);
export default dataSource;
