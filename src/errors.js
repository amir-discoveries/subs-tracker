export class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
    this.exitCode = 1;
  }
}

export class SystemError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SystemError';
    this.exitCode = 2;
  }
}
