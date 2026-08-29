import { appEnv } from '../../config/env';
import { DbConnection } from '../../module_bindings';

export function createPublicConnectionBuilder() {
  return DbConnection.builder()
    .withUri(appEnv.spacetimeUri)
    .withDatabaseName(appEnv.databaseName);
}
