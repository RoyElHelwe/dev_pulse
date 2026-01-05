import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface OnlineUser {
  userId: string;
  socketId: string;
  workspaceId: string;
  lastActivity: Date;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');

  // Track online users: Map<userId, OnlineUser>
  private onlineUsers: Map<string, OnlineUser> = new Map();
  // Track socket to user mapping for disconnect
  private socketToUser: Map<string, string> = new Map();
  // Track user to workspace mapping
  private userWorkspaces: Map<string, string> = new Map();

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Cleanup inactive users every 30 seconds
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, 30000);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Get user ID from socket mapping
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      const workspaceId = this.userWorkspaces.get(userId);

      // Remove user from online tracking
      this.onlineUsers.delete(userId);
      this.socketToUser.delete(client.id);
      this.userWorkspaces.delete(userId);

      // Broadcast user went offline to workspace
      if (workspaceId) {
        this.broadcastToWorkspace(workspaceId, 'user:offline', { userId });
        this.logger.log(
          `User ${userId} went offline in workspace ${workspaceId}`,
        );
      }
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): string {
    return 'pong';
  }

  @SubscribeMessage('user:connect')
  handleUserConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; workspaceId: string },
  ): void {
    this.logger.log(
      `Received user:connect event with data: ${JSON.stringify(data)}`,
    );

    const { userId, workspaceId } = data;

    if (!userId || !workspaceId) {
      this.logger.warn(
        'Invalid user:connect data - missing userId or workspaceId',
      );
      return;
    }

    // Store user info
    this.onlineUsers.set(userId, {
      userId,
      socketId: client.id,
      workspaceId,
      lastActivity: new Date(),
    });
    this.socketToUser.set(client.id, userId);
    this.userWorkspaces.set(userId, workspaceId);

    // Join workspace room
    client.join(`workspace:${workspaceId}`);

    // Broadcast user came online to workspace
    this.logger.log(
      `Broadcasting user:online for user ${userId} to workspace ${workspaceId}`,
    );
    this.broadcastToWorkspace(workspaceId, 'user:online', { userId });

    // Send current online users to the connecting client
    const workspaceOnlineUsers = this.getWorkspaceOnlineUsers(workspaceId);
    this.logger.log(
      `Sending online users to client: ${JSON.stringify(workspaceOnlineUsers)}`,
    );
    client.emit('online:users', { users: workspaceOnlineUsers });

    this.logger.log(
      `User ${userId} came online in workspace ${workspaceId}. Total online: ${this.onlineUsers.size}`,
    );
  }

  @SubscribeMessage('user:heartbeat')
  handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ): void {
    const { userId } = data;
    const user = this.onlineUsers.get(userId);

    if (user) {
      user.lastActivity = new Date();
      this.onlineUsers.set(userId, user);
    }
  }

  @SubscribeMessage('user:status')
  handleStatusChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; status: 'online' | 'away' | 'busy' },
  ): void {
    const { userId, status } = data;
    const workspaceId = this.userWorkspaces.get(userId);

    if (workspaceId) {
      this.broadcastToWorkspace(workspaceId, 'user:status:changed', {
        userId,
        status,
      });
    }
  }

  @SubscribeMessage('join:workspace')
  handleJoinWorkspace(client: Socket, workspaceId: string): void {
    client.join(`workspace:${workspaceId}`);
    this.logger.log(`Client ${client.id} joined workspace ${workspaceId}`);
    client.emit('joined:workspace', { workspaceId });
  }

  @SubscribeMessage('leave:workspace')
  handleLeaveWorkspace(client: Socket, workspaceId: string): void {
    client.leave(`workspace:${workspaceId}`);
    this.logger.log(`Client ${client.id} left workspace ${workspaceId}`);
    client.emit('left:workspace', { workspaceId });
  }

  @SubscribeMessage('get:online:users')
  handleGetOnlineUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string },
  ): void {
    const onlineUsers = this.getWorkspaceOnlineUsers(data.workspaceId);
    client.emit('online:users', { users: onlineUsers });
  }

  // Get all online users in a workspace
  getWorkspaceOnlineUsers(workspaceId: string): string[] {
    const onlineUserIds: string[] = [];

    this.onlineUsers.forEach((user, oderId) => {
      if (user.workspaceId === workspaceId) {
        onlineUserIds.push(user.userId);
      }
    });

    return onlineUserIds;
  }

  // Cleanup users who haven't sent heartbeat in 60 seconds
  private cleanupInactiveUsers(): void {
    const now = new Date();
    const timeout = 60000; // 60 seconds

    this.onlineUsers.forEach((user, oderId) => {
      if (now.getTime() - user.lastActivity.getTime() > timeout) {
        const workspaceId = user.workspaceId;
        const userId = user.userId;

        // Remove user
        this.onlineUsers.delete(userId);
        this.socketToUser.delete(user.socketId);
        this.userWorkspaces.delete(userId);

        // Broadcast offline
        this.broadcastToWorkspace(workspaceId, 'user:offline', { userId });
        this.logger.log(`User ${userId} timed out and marked offline`);
      }
    });
  }

  // Broadcast to workspace
  broadcastToWorkspace(workspaceId: string, event: string, data: any): void {
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
  }
}
