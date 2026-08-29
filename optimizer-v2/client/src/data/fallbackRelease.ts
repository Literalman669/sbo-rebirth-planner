import rawFallbackRelease from './fallback-release.json';
import { datasetSnapshotSchema } from '../domain/dataset/schema';

export const fallbackRelease = datasetSnapshotSchema.parse(rawFallbackRelease);
