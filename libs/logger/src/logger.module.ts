import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { buildLoggerConfig, BuildLoggerConfigOptions } from './logger.config';

@Module({})
export class BosLoggerModule {
  static forRoot(options: BuildLoggerConfigOptions): DynamicModule {
    return {
      module: BosLoggerModule,
      imports: [PinoLoggerModule.forRoot(buildLoggerConfig(options))],
      exports: [PinoLoggerModule],
    };
  }
}
