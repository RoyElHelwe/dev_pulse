import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService, TaskStatus, TaskAction } from '@ft-trans/database';
import { ethers } from 'ethers';
import { createHash } from 'crypto';

// TaskRecord contract ABI (simplified)
const TASK_RECORD_ABI = [
  'function recordTaskCompletion(bytes32 _taskId, bytes32 _workspaceId, address _worker, bytes32 _proofHash, string memory _ipfsMetadata) external',
  'function getWorkerCompletions(address _worker) external view returns (bytes32[] memory)',
  'function verifyCompletion(bytes32 _taskId, address _worker) external view returns (bool, uint256)',
  'function completions(bytes32) external view returns (bytes32 taskId, bytes32 workspaceId, address worker, uint256 timestamp, bytes32 proofHash, string ipfsMetadata)',
  'event TaskCompleted(bytes32 indexed taskId, address indexed worker, uint256 timestamp, bytes32 proofHash)',
];

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;

  constructor(private prisma: PrismaService) {
    this.initializeBlockchain();
  }

  private initializeBlockchain() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!rpcUrl || !privateKey || !contractAddress) {
      this.logger.warn('Blockchain configuration not set. Running in mock mode.');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(contractAddress, TASK_RECORD_ABI, this.wallet);
      this.logger.log('Blockchain service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize blockchain connection:', error);
    }
  }

  async recordTaskCompletion(taskId: string, userId: string, workspaceId: string) {
    // Get the task
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId, status: TaskStatus.DONE },
      include: {
        assignee: true,
      },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Completed task not found' });
    }

    if (task.blockchainVerified) {
      throw new RpcException({ statusCode: 400, message: 'Task already recorded on blockchain' });
    }

    // Generate proof hash
    const proofHash = this.generateProofHash(task);

    // Check if we have blockchain config
    if (!this.contract) {
      // Mock mode - simulate blockchain recording
      this.logger.log(`[MOCK] Recording task ${taskId} on blockchain`);
      
      const mockTxHash = `0x${createHash('sha256').update(taskId + Date.now()).digest('hex')}`;
      
      // Create blockchain record
      await this.prisma.blockchainRecord.create({
        data: {
          taskId,
          txHash: mockTxHash,
          proofHash,
          network: 'mock',
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      // Update task
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          blockchainVerified: true,
          blockchainTxHash: mockTxHash,
          blockchainRecordedAt: new Date(),
          proofHash,
        },
      });

      // Record activity
      await this.prisma.taskActivity.create({
        data: {
          taskId,
          userId,
          action: TaskAction.BLOCKCHAIN_VERIFIED,
          metadata: { txHash: mockTxHash, network: 'mock' },
        },
      });

      return {
        success: true,
        txHash: mockTxHash,
        network: 'mock',
        proofHash,
      };
    }

    // Real blockchain recording
    try {
      // Convert to bytes32
      const taskIdBytes = ethers.id(taskId);
      const workspaceIdBytes = ethers.id(workspaceId);
      const proofHashBytes = `0x${proofHash}`;

      // Get worker address (if available) or use contract wallet
      const workerAddress = task.assignee?.id
        ? await this.getWorkerAddress(task.assignee.id)
        : this.wallet!.address;

      // Create pending record
      const pendingRecord = await this.prisma.blockchainRecord.create({
        data: {
          taskId,
          txHash: '', // Will be updated after tx
          proofHash,
          workerAddress,
          network: process.env.BLOCKCHAIN_NETWORK || 'sepolia',
          status: 'PENDING',
        },
      });

      // Send transaction
      const tx = await this.contract.recordTaskCompletion(
        taskIdBytes,
        workspaceIdBytes,
        workerAddress,
        proofHashBytes,
        JSON.stringify({
          title: task.title,
          completedAt: task.completedAt?.toISOString(),
        }),
      );

      // Update record with tx hash
      await this.prisma.blockchainRecord.update({
        where: { id: pendingRecord.id },
        data: { txHash: tx.hash },
      });

      // Wait for confirmation (don't block, handle async)
      this.waitForConfirmation(taskId, tx.hash, userId);

      return {
        success: true,
        txHash: tx.hash,
        network: process.env.BLOCKCHAIN_NETWORK || 'sepolia',
        proofHash,
        status: 'PENDING',
      };
    } catch (error: any) {
      this.logger.error('Blockchain transaction failed:', error);

      // Update record as failed
      await this.prisma.blockchainRecord.updateMany({
        where: { taskId, status: 'PENDING' },
        data: { status: 'FAILED', errorMessage: error.message },
      });

      throw new RpcException({
        statusCode: 500,
        message: 'Failed to record on blockchain: ' + error.message,
      });
    }
  }

  private async waitForConfirmation(taskId: string, txHash: string, userId: string) {
    if (!this.provider) return;

    try {
      const receipt = await this.provider.waitForTransaction(txHash, 1, 60000);

      if (receipt && receipt.status === 1) {
        // Update blockchain record
        await this.prisma.blockchainRecord.update({
          where: { txHash },
          data: {
            status: 'CONFIRMED',
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            confirmedAt: new Date(),
          },
        });

        // Update task
        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            blockchainVerified: true,
            blockchainTxHash: txHash,
            blockchainRecordedAt: new Date(),
          },
        });

        // Record activity
        await this.prisma.taskActivity.create({
          data: {
            taskId,
            userId,
            action: TaskAction.BLOCKCHAIN_VERIFIED,
            metadata: { txHash, blockNumber: receipt.blockNumber },
          },
        });

        this.logger.log(`Task ${taskId} confirmed on blockchain: ${txHash}`);
      } else {
        await this.prisma.blockchainRecord.update({
          where: { txHash },
          data: { status: 'FAILED', errorMessage: 'Transaction failed' },
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to confirm transaction:', error);
      await this.prisma.blockchainRecord.update({
        where: { txHash },
        data: { status: 'FAILED', errorMessage: error.message },
      });
    }
  }

  async getBlockchainRecord(taskId: string) {
    const record = await this.prisma.blockchainRecord.findUnique({
      where: { taskId },
    });

    if (!record) {
      return null;
    }

    return {
      ...record,
      explorerUrl: this.getExplorerUrl(record.txHash, record.network),
    };
  }

  async getUserBlockchainRecords(userId: string) {
    // Get all verified tasks for this user
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        blockchainVerified: true,
      },
      select: {
        id: true,
        title: true,
        blockchainTxHash: true,
        blockchainRecordedAt: true,
        completedAt: true,
        workspace: {
          select: { id: true, name: true },
        },
      },
      orderBy: { blockchainRecordedAt: 'desc' },
    });

    return tasks.map((task) => ({
      ...task,
      explorerUrl: task.blockchainTxHash
        ? this.getExplorerUrl(task.blockchainTxHash, process.env.BLOCKCHAIN_NETWORK || 'sepolia')
        : null,
    }));
  }

  async verifyOnBlockchain(_taskId: string, txHash: string) {
    if (!this.provider) {
      return { verified: true, mock: true };
    }

    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { verified: false, reason: 'Transaction not found' };
      }

      return {
        verified: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      return { verified: false, reason: error.message };
    }
  }

  async getBlockchainStats(workspaceId: string) {
    const [totalRecorded, pendingCount, failedCount] = await Promise.all([
      this.prisma.task.count({
        where: { workspaceId, blockchainVerified: true },
      }),
      this.prisma.blockchainRecord.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.blockchainRecord.count({
        where: { status: 'FAILED' },
      }),
    ]);

    return {
      totalRecorded,
      pendingCount,
      failedCount,
      network: process.env.BLOCKCHAIN_NETWORK || 'mock',
      contractAddress: process.env.CONTRACT_ADDRESS || 'N/A',
    };
  }

  async retryFailedRecords() {
    const failedRecords = await this.prisma.blockchainRecord.findMany({
      where: { status: 'FAILED' },
      take: 10,
    });

    const results = [];

    for (const record of failedRecords) {
      try {
        const task = await this.prisma.task.findUnique({
          where: { id: record.taskId },
        });

        if (task && task.status === TaskStatus.DONE) {
          // Delete old record
          await this.prisma.blockchainRecord.delete({ where: { id: record.id } });
          
          // Retry
          const result = await this.recordTaskCompletion(
            record.taskId,
            task.creatorId,
            task.workspaceId,
          );
          results.push({ taskId: record.taskId, status: 'retried', result });
        }
      } catch (error: any) {
        results.push({ taskId: record.taskId, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  // Helper methods

  private generateProofHash(task: any): string {
    const data = {
      taskId: task.id,
      title: task.title,
      workspaceId: task.workspaceId,
      assigneeId: task.assigneeId,
      completedAt: task.completedAt?.toISOString(),
      creatorId: task.creatorId,
    };

    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private async getWorkerAddress(userId: string): Promise<string> {
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    return wallet?.address || this.wallet!.address;
  }

  private getExplorerUrl(txHash: string, network: string): string {
    const explorers: Record<string, string> = {
      mainnet: 'https://etherscan.io/tx/',
      sepolia: 'https://sepolia.etherscan.io/tx/',
      polygon: 'https://polygonscan.com/tx/',
      mock: '',
    };

    const baseUrl = explorers[network] || explorers.sepolia;
    return baseUrl ? `${baseUrl}${txHash}` : '';
  }
}
