export class ApplicationError extends Error {
  constructor(
    public readonly category: string,
    public readonly referenceId?: string,
  ) {
    super(category);
    this.name = new.target.name;
  }
}
export class ValidationError extends ApplicationError {
  constructor(public readonly fields: Record<string, string[]>) {
    super('VALIDATION_ERROR');
  }
}
