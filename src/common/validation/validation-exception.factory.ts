import { BadRequestException, ValidationError } from '@nestjs/common';
import { ValidationAppError } from '@app/common/errors/specialized.errors';

function flattenErrors(errors: ValidationError[]) {
  const res: Record<string, string[]> = {};
  const walk = (err: ValidationError, path = err.property) => {
    if (err.constraints) {
      res[path] = Object.values(err.constraints);
    }
    if (err.children?.length) {
      for (const child of err.children) {
        const childPath = child.property ? `${path}.${child.property}` : path;
        walk(child, childPath);
      }
    }
  };
  errors.forEach((e) => walk(e));
  return res;
}

export function validationExceptionFactory(errors: ValidationError[]) {
  const details = { fieldErrors: flattenErrors(errors) };
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    details,
  });
}

// export function validationExceptionFactory(errors: ValidationError[]) {
//   const details = { fieldErrors: flattenErrors(errors) };
//   return new ValidationAppError('Validation failed', details);
// }
