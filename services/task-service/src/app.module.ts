import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@ft-trans/database';
import { TaskModule } from './task/task.module';
import { SprintModule } from './sprint/sprint.module';
import { CommentModule } from './comment/comment.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    PrismaModule,
    TaskModule,
    SprintModule,
    CommentModule,
    BlockchainModule,
  ],
})
export class AppModule {}
