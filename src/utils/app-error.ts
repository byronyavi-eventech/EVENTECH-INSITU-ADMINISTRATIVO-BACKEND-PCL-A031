/**
 * app-error.ts
 * Typed operational error with an HTTP status code.
 *
 * Throw this for expected failure cases (bad input, not found, conflict…).
 * The global error middleware will catch it and forward `statusCode` + `message`
 * to the client. Unexpected errors (DB crashes, etc.) remain plain `Error`
 * and produce a generic 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    // Maintain correct prototype chain for `instanceof` checks.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
