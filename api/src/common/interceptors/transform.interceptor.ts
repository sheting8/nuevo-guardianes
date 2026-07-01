import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function yaEnvuelto(result: unknown): result is { data: unknown } {
  return typeof result === 'object' && result !== null && 'data' in result;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  { data: T }
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ data: T }> {
    return next
      .handle()
      .pipe(
        map((result) =>
          yaEnvuelto(result) ? (result as { data: T }) : { data: result },
        ),
      );
  }
}
