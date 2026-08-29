import { appEnv } from '../../config/env';
import { DbConnection } from '../../module_bindings';

export function createConnectionBuilder(idToken?: string) {
  const builder = DbConnection.builder()
    .withUri(appEnv.spacetimeUri)
    .withDatabaseName(appEnv.databaseName);
  return idToken ? builder.withToken(idToken) : builder;
}
