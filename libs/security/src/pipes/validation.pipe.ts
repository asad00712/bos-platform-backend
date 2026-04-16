import { ValidationPipe } from '@nestjs/common';
import type { ValidationPipeOptions, ValidationError } from '@nestjs/common';
import { ValidationFailedException } from '@bos/errors';

export function createValidationPipe(options?: ValidationPipeOptions): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    stopAtFirstError: false,
    exceptionFactory: (errors: ValidationError[]) => {
      const flattened = flattenValidationErrors(errors);
      return new ValidationFailedException(flattened);
    },
    ...options,
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  path: string[] = [],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const err of errors) {
    const currentPath = [...path, err.property];
    const key = currentPath.join('.');

    if (err.constraints) {
      result[key] = Object.values(err.constraints);
    }

    if (err.children && err.children.length > 0) {
      Object.assign(result, flattenValidationErrors(err.children, currentPath));
    }
  }
  return result;
}
