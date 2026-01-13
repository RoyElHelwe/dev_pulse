import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BlockchainService } from './blockchain.service';

@Controller()
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @MessagePattern('blockchain.recordTask')
  async recordTaskCompletion(
    @Payload() data: { taskId: string; userId: string; workspaceId: string },
  ) {
    return this.blockchainService.recordTaskCompletion(data.taskId, data.userId, data.workspaceId);
  }

  @MessagePattern('blockchain.getRecord')
  async getBlockchainRecord(@Payload() data: { taskId: string }) {
    return this.blockchainService.getBlockchainRecord(data.taskId);
  }

  @MessagePattern('blockchain.getUserRecords')
  async getUserBlockchainRecords(@Payload() data: { userId: string }) {
    return this.blockchainService.getUserBlockchainRecords(data.userId);
  }

  @MessagePattern('blockchain.verify')
  async verifyOnBlockchain(@Payload() data: { taskId: string; txHash: string }) {
    return this.blockchainService.verifyOnBlockchain(data.taskId, data.txHash);
  }

  @MessagePattern('blockchain.getStats')
  async getBlockchainStats(@Payload() data: { workspaceId: string }) {
    return this.blockchainService.getBlockchainStats(data.workspaceId);
  }

  @MessagePattern('blockchain.retryFailed')
  async retryFailedRecords() {
    return this.blockchainService.retryFailedRecords();
  }
}
