import { ApplicationError } from './application.error';
export class PersistenceError extends ApplicationError {
  constructor(referenceId?: string) {
    super('PERSISTENCE_ERROR', referenceId);
  }
}
export class ReferenceConflictError extends PersistenceError {}
