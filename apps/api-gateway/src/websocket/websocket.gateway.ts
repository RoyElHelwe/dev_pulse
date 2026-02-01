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

interface OfficePlayer {
  id: string;
  name: string;
  email?: string;
  position: { x: number; y: number };
  direction: string;
  status: string;
  avatarColor?: string;
  workspaceId: string;
  socketId: string;
  lastUpdate: Date;
}

interface ProximityEvent {
  playerId: string;
  nearbyPlayers: string[];
  type: 'enter' | 'exit';
}

// Proximity detection threshold (in pixels)
const PROXIMITY_THRESHOLD = 100;

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
  
  // Office tracking: Map<`office:${workspaceId}`, Map<playerId, OfficePlayer>>
  private officePlayers: Map<string, Map<string, OfficePlayer>> = new Map();
  // Track previous nearby players for proximity events
  private playerProximity: Map<string, Set<string>> = new Map();

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

      // Remove player from office if they were in one
      if (workspaceId) {
        this.removePlayerFromOffice(workspaceId, userId);
      }

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

  // ============================================
  // Virtual Office Events
  // ============================================

  @SubscribeMessage('office:join')
  handleOfficeJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      userId: string;
      name: string;
      email?: string;
      position?: { x: number; y: number };
      avatarColor?: string;
    },
  ): void {
    const { workspaceId, userId, name, email, position, avatarColor } = data;
    
    if (!workspaceId || !userId) {
      this.logger.warn('Invalid office:join data');
      return;
    }

    const roomKey = `office:${workspaceId}`;
    
    // Initialize office room if needed
    if (!this.officePlayers.has(roomKey)) {
      this.officePlayers.set(roomKey, new Map());
    }
    
    const officeRoom = this.officePlayers.get(roomKey)!;
    
    // Create player data
    const player: OfficePlayer = {
      id: userId,
      name,
      email,
      position: position || { x: 600, y: 400 },
      direction: 'down',
      status: 'available',
      avatarColor,
      workspaceId,
      socketId: client.id,
      lastUpdate: new Date(),
    };
    
    // Add player to office
    officeRoom.set(userId, player);
    this.playerProximity.set(userId, new Set());
    
    // Track socket mapping for disconnect cleanup
    this.socketToUser.set(client.id, userId);
    this.userWorkspaces.set(userId, workspaceId);
    
    // IMPORTANT: Also register in onlineUsers for voice call support
    this.onlineUsers.set(userId, {
      userId,
      socketId: client.id,
      workspaceId,
      lastActivity: new Date(),
    });
    
    // Join office room
    client.join(roomKey);
    
    // Send current players to joining client
    const players = Array.from(officeRoom.values()).map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      direction: p.direction,
      status: p.status,
      avatarColor: p.avatarColor,
    }));
    client.emit('office:players', players);
    
    // Broadcast new player to others
    client.to(roomKey).emit('office:player-joined', {
      id: player.id,
      name: player.name,
      position: player.position,
      direction: player.direction,
      status: player.status,
      avatarColor: player.avatarColor,
    });
    
    this.logger.log(`Player ${name} (${userId}) joined office in workspace ${workspaceId}`);
  }

  @SubscribeMessage('office:move')
  handleOfficeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      userId: string;
      position: { x: number; y: number };
      direction: string;
    },
  ): void {
    const { workspaceId, userId, position, direction } = data;
    const roomKey = `office:${workspaceId}`;
    
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return;
    
    const player = officeRoom.get(userId);
    if (!player) return;
    
    // Update player position
    player.position = position;
    player.direction = direction;
    player.lastUpdate = new Date();
    
    // Broadcast movement to others in office
    client.to(roomKey).emit('office:player-moved', {
      playerId: userId,
      position,
      direction,
    });
    
    // Check proximity with other players
    this.checkProximity(workspaceId, userId, client);
    this.checkVoiceProximity(workspaceId, userId, client);
  }

  @SubscribeMessage('office:status')
  handleOfficeStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      userId: string;
      status: string;
    },
  ): void {
    const { workspaceId, userId, status } = data;
    const roomKey = `office:${workspaceId}`;
    
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return;
    
    const player = officeRoom.get(userId);
    if (!player) return;
    
    player.status = status;
    
    // Broadcast status change
    this.server.to(roomKey).emit('office:player-status', {
      playerId: userId,
      status,
    });
  }

  @SubscribeMessage('office:leave')
  handleOfficeLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      userId: string;
    },
  ): void {
    const { workspaceId, userId } = data;
    this.removePlayerFromOffice(workspaceId, userId, client);
  }

  @SubscribeMessage('office:chat')
  handleOfficeChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      userId: string;
      message: string;
      targetUserId?: string; // For proximity chat
    },
  ): void {
    const { workspaceId, userId, message, targetUserId } = data;
    const roomKey = `office:${workspaceId}`;
    
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return;
    
    const sender = officeRoom.get(userId);
    if (!sender) return;
    
    const chatMessage = {
      senderId: userId,
      senderName: sender.name,
      message,
      position: sender.position,
      timestamp: new Date().toISOString(),
    };
    
    if (targetUserId) {
      // Private proximity message
      const target = officeRoom.get(targetUserId);
      if (target) {
        this.server.to(target.socketId).emit('office:chat-message', chatMessage);
        client.emit('office:chat-message', chatMessage);
      }
    } else {
      // Broadcast to nearby players (within proximity)
      const nearbyPlayers = this.getNearbyPlayers(workspaceId, userId);
      nearbyPlayers.forEach(playerId => {
        const player = officeRoom.get(playerId);
        if (player) {
          this.server.to(player.socketId).emit('office:chat-message', chatMessage);
        }
      });
      client.emit('office:chat-message', chatMessage);
    }
  }

  @SubscribeMessage('office:interaction')
  handleOfficeInteraction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      userId: string;
      targetUserId: string;
      type: 'wave' | 'call-request' | 'pong-invite';
    },
  ): void {
    const { workspaceId, userId, targetUserId, type } = data;
    const roomKey = `office:${workspaceId}`;
    
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return;
    
    const sender = officeRoom.get(userId);
    const target = officeRoom.get(targetUserId);
    if (!sender || !target) return;
    
    // Send interaction to target
    this.server.to(target.socketId).emit('office:interaction-received', {
      senderId: userId,
      senderName: sender.name,
      type,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`${sender.name} sent ${type} to ${target.name}`);
  }

  // Helper: Remove player from office
  private removePlayerFromOffice(workspaceId: string, userId: string, client?: Socket): void {
    const roomKey = `office:${workspaceId}`;
    
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return;
    
    const player = officeRoom.get(userId);
    if (!player) return;
    
    officeRoom.delete(userId);
    this.playerProximity.delete(userId);
    
    if (client) {
      client.leave(roomKey);
    }
    
    // Broadcast player left
    this.server.to(roomKey).emit('office:player-left', userId);
    
    this.logger.log(`Player ${player.name} (${userId}) left office in workspace ${workspaceId}`);
    
    // Clean up empty office
    if (officeRoom.size === 0) {
      this.officePlayers.delete(roomKey);
    }
  }

  // Helper: Check proximity and emit events
  private checkProximity(workspaceId: string, userId: string, client: Socket): void {
    const nearbyPlayers = this.getNearbyPlayers(workspaceId, userId);
    const previousNearby = this.playerProximity.get(userId) || new Set();
    
    const currentNearby = new Set(nearbyPlayers);
    
    // Find players who entered proximity
    const entered = nearbyPlayers.filter(id => !previousNearby.has(id));
    // Find players who left proximity  
    const exited = Array.from(previousNearby).filter(id => !currentNearby.has(id));
    
    const roomKey = `office:${workspaceId}`;
    const officeRoom = this.officePlayers.get(roomKey);
    
    // Emit proximity enter events
    if (entered.length > 0) {
      client.emit('office:proximity', {
        playerId: userId,
        nearbyPlayers: entered,
        type: 'enter',
      });
      
      // Also notify the other players that this user entered their proximity
      if (officeRoom) {
        entered.forEach(otherId => {
          const otherPlayer = officeRoom.get(otherId);
          if (otherPlayer) {
            // Add userId to other player's proximity tracking
            const otherProximity = this.playerProximity.get(otherId) || new Set();
            otherProximity.add(userId);
            this.playerProximity.set(otherId, otherProximity);
            
            this.server.to(otherPlayer.socketId).emit('office:proximity', {
              playerId: otherId,
              nearbyPlayers: [userId],
              type: 'enter',
            });
          }
        });
      }
    }
    
    // Emit proximity exit events
    if (exited.length > 0) {
      client.emit('office:proximity', {
        playerId: userId,
        nearbyPlayers: exited,
        type: 'exit',
      });
      
      // Also notify the other players that this user left their proximity
      if (officeRoom) {
        exited.forEach(otherId => {
          const otherPlayer = officeRoom.get(otherId);
          if (otherPlayer) {
            // Remove userId from other player's proximity tracking
            const otherProximity = this.playerProximity.get(otherId);
            if (otherProximity) {
              otherProximity.delete(userId);
            }
            
            this.server.to(otherPlayer.socketId).emit('office:proximity', {
              playerId: otherId,
              nearbyPlayers: [userId],
              type: 'exit',
            });
          }
        });
      }
    }
    
    // Update tracked proximity
    this.playerProximity.set(userId, currentNearby);
  }

  // Helper: Get nearby players within proximity threshold
  private getNearbyPlayers(workspaceId: string, userId: string): string[] {
    const roomKey = `office:${workspaceId}`;
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return [];
    
    const player = officeRoom.get(userId);
    if (!player) return [];
    
    const nearby: string[] = [];
    
    officeRoom.forEach((otherPlayer, otherId) => {
      if (otherId === userId) return;
      
      const distance = this.calculateDistance(player.position, otherPlayer.position);
      if (distance <= PROXIMITY_THRESHOLD) {
        nearby.push(otherId);
      }
    });
    
    return nearby;
  }

  // Helper: Calculate distance between two positions
  private calculateDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Helper: Get office players for a workspace
  getOfficePlayers(workspaceId: string): OfficePlayer[] {
    const roomKey = `office:${workspaceId}`;
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return [];
    return Array.from(officeRoom.values());
  }

  // ============================================
  // Task Management Events
  // ============================================

  @SubscribeMessage('task:subscribe')
  handleTaskSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string },
  ): void {
    const { workspaceId } = data;
    if (!workspaceId) return;
    
    // Join task room for workspace
    client.join(`tasks:${workspaceId}`);
    this.logger.log(`Client ${client.id} subscribed to tasks for workspace ${workspaceId}`);
    client.emit('task:subscribed', { workspaceId });
  }

  @SubscribeMessage('task:unsubscribe')
  handleTaskUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string },
  ): void {
    const { workspaceId } = data;
    if (!workspaceId) return;
    
    client.leave(`tasks:${workspaceId}`);
    this.logger.log(`Client ${client.id} unsubscribed from tasks for workspace ${workspaceId}`);
  }

  // Broadcast task events to workspace (called from task service via API gateway)
  broadcastTaskEvent(
    workspaceId: string,
    event: string,
    data: any,
  ): void {
    this.server.to(`tasks:${workspaceId}`).emit(event, data);
    this.logger.log(`Broadcasted ${event} to tasks:${workspaceId}`);
  }

  // Task created event
  @SubscribeMessage('task:created')
  handleTaskCreated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; task: any; userId: string },
  ): void {
    const { workspaceId, task, userId } = data;
    if (!workspaceId) return;

    // Broadcast to all clients in the workspace
    this.server.to(`tasks:${workspaceId}`).emit('task:created', {
      task,
      createdBy: userId,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Task created in workspace ${workspaceId}: ${task.id}`);
  }

  // Task updated event
  @SubscribeMessage('task:updated')
  handleTaskUpdated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; task: any; userId: string; changes?: any },
  ): void {
    const { workspaceId, task, userId, changes } = data;
    if (!workspaceId) return;

    // Broadcast to all clients except sender
    client.to(`tasks:${workspaceId}`).emit('task:updated', {
      task,
      updatedBy: userId,
      changes,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Task updated in workspace ${workspaceId}: ${task.id}`);
  }

  // Task status changed (drag-drop)
  @SubscribeMessage('task:status:changed')
  handleTaskStatusChanged(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      taskId: string;
      oldStatus: string;
      newStatus: string;
      userId: string;
      userName?: string;
    },
  ): void {
    const { workspaceId, taskId, oldStatus, newStatus, userId, userName } = data;
    if (!workspaceId) return;

    // Broadcast to all clients except sender
    client.to(`tasks:${workspaceId}`).emit('task:status:changed', {
      taskId,
      oldStatus,
      newStatus,
      movedBy: userId,
      movedByName: userName,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Task ${taskId} moved from ${oldStatus} to ${newStatus} in workspace ${workspaceId}`);
  }

  // Task assigned event
  @SubscribeMessage('task:assigned')
  handleTaskAssigned(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      taskId: string;
      taskTitle: string;
      assigneeId: string;
      assigneeName?: string;
      assignedBy: string;
    },
  ): void {
    const { workspaceId, taskId, taskTitle, assigneeId, assigneeName, assignedBy } = data;
    if (!workspaceId) return;

    // Broadcast to workspace
    this.server.to(`tasks:${workspaceId}`).emit('task:assigned', {
      taskId,
      taskTitle,
      assigneeId,
      assigneeName,
      assignedBy,
      timestamp: new Date().toISOString(),
    });

    // Also send personal notification to assignee
    const assigneeSocket = this.findUserSocket(assigneeId);
    if (assigneeSocket) {
      assigneeSocket.emit('notification', {
        type: 'task:assigned',
        title: 'New Task Assigned',
        message: `You've been assigned to: ${taskTitle}`,
        taskId,
        timestamp: new Date().toISOString(),
      });
    }
    
    this.logger.log(`Task ${taskId} assigned to ${assigneeId} in workspace ${workspaceId}`);
  }

  // Task deleted event
  @SubscribeMessage('task:deleted')
  handleTaskDeleted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; taskId: string; userId: string },
  ): void {
    const { workspaceId, taskId, userId } = data;
    if (!workspaceId) return;

    // Broadcast to all clients except sender
    client.to(`tasks:${workspaceId}`).emit('task:deleted', {
      taskId,
      deletedBy: userId,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Task deleted in workspace ${workspaceId}: ${taskId}`);
  }

  // Task blockchain verified event
  @SubscribeMessage('task:blockchain:verified')
  handleTaskBlockchainVerified(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      taskId: string;
      taskTitle: string;
      txHash: string;
      completedBy: string;
      completedByName?: string;
    },
  ): void {
    const { workspaceId, taskId, taskTitle, txHash, completedBy, completedByName } = data;
    if (!workspaceId) return;

    // Broadcast celebration to entire workspace!
    this.server.to(`tasks:${workspaceId}`).emit('task:blockchain:verified', {
      taskId,
      taskTitle,
      txHash,
      completedBy,
      completedByName,
      timestamp: new Date().toISOString(),
    });
    
    // Also broadcast to office for visual celebration
    this.server.to(`office:${workspaceId}`).emit('office:celebration', {
      type: 'blockchain_verified',
      message: `${completedByName || 'Someone'} completed "${taskTitle}" - Now on blockchain! 🎉`,
      userId: completedBy,
    });
    
    this.logger.log(`Task ${taskId} verified on blockchain in workspace ${workspaceId}`);
  }

  // Task comment added
  @SubscribeMessage('task:comment:added')
  handleTaskCommentAdded(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      taskId: string;
      comment: any;
      userId: string;
      userName?: string;
    },
  ): void {
    const { workspaceId, taskId, comment, userId, userName } = data;
    if (!workspaceId) return;

    // Broadcast to all clients except sender
    client.to(`tasks:${workspaceId}`).emit('task:comment:added', {
      taskId,
      comment,
      addedBy: userId,
      addedByName: userName,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Comment added to task ${taskId} in workspace ${workspaceId}`);
  }

  // Sprint events
  @SubscribeMessage('sprint:created')
  handleSprintCreated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; sprint: any; userId: string },
  ): void {
    const { workspaceId, sprint, userId } = data;
    if (!workspaceId) return;

    this.server.to(`tasks:${workspaceId}`).emit('sprint:created', {
      sprint,
      createdBy: userId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('sprint:started')
  handleSprintStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; sprintId: string; sprintName: string; userId: string },
  ): void {
    const { workspaceId, sprintId, sprintName, userId } = data;
    if (!workspaceId) return;

    this.server.to(`tasks:${workspaceId}`).emit('sprint:started', {
      sprintId,
      sprintName,
      startedBy: userId,
      timestamp: new Date().toISOString(),
    });
    
    // Celebrate in office
    this.server.to(`office:${workspaceId}`).emit('office:announcement', {
      type: 'sprint_started',
      message: `🚀 Sprint "${sprintName}" has started!`,
    });
  }

  @SubscribeMessage('sprint:completed')
  handleSprintCompleted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      sprintId: string;
      sprintName: string;
      stats: { totalTasks: number; completedTasks: number };
      userId: string;
    },
  ): void {
    const { workspaceId, sprintId, sprintName, stats, userId } = data;
    if (!workspaceId) return;

    this.server.to(`tasks:${workspaceId}`).emit('sprint:completed', {
      sprintId,
      sprintName,
      stats,
      completedBy: userId,
      timestamp: new Date().toISOString(),
    });
    
    // Big celebration in office
    this.server.to(`office:${workspaceId}`).emit('office:celebration', {
      type: 'sprint_completed',
      message: `🎉 Sprint "${sprintName}" completed! ${stats.completedTasks}/${stats.totalTasks} tasks done!`,
    });
  }

  // Helper: Find socket by user ID
  private findUserSocket(userId: string): Socket | undefined {
    const user = this.onlineUsers.get(userId);
    if (!user) return undefined;
    
    return this.server.sockets.sockets.get(user.socketId);
  }

  // ============================================
  // Voice Call Events (WebRTC Signaling)
  // ============================================

  // Voice call threshold for proximity voice chat (pixels)
  private readonly VOICE_PROXIMITY_THRESHOLD = 200;

  // Track active voice calls: Map<`call:${workspaceId}:${oderId}`, Set<userId>>
  private activeCalls: Map<string, Set<string>> = new Map();

  @SubscribeMessage('voice:call-invite')
  handleVoiceCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      targetUserId: string;
      callerId: string;
      callerName: string;
      callType: 'voice' | 'proximity';
    },
  ): void {
    const { workspaceId, targetUserId, callerId, callerName, callType } = data;
    
    this.logger.log(`[Voice] Call invite from ${callerName} to ${targetUserId}`);
    
    // Find target user's socket
    const targetSocket = this.findUserSocket(targetUserId);
    if (!targetSocket) {
      client.emit('voice:call-error', { message: 'User is offline' });
      return;
    }
    
    // Send invitation to target
    targetSocket.emit('voice:call-invitation', {
      callerId,
      callerName,
      callType,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`[Voice] Invitation sent to ${targetUserId}`);
  }

  @SubscribeMessage('voice:call-accept')
  handleVoiceCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      callerId: string;
      calleeId: string;
      calleeName: string;
    },
  ): void {
    const { workspaceId, callerId, calleeId, calleeName } = data;
    
    this.logger.log(`[Voice] Call accepted by ${calleeName}`);
    
    // Find caller's socket
    const callerSocket = this.findUserSocket(callerId);
    if (!callerSocket) {
      client.emit('voice:call-error', { message: 'Caller disconnected' });
      return;
    }
    
    // Notify caller that call was accepted
    callerSocket.emit('voice:call-accepted', {
      calleeId,
      calleeName,
    });
    
    // Track active call
    const callKey = `call:${workspaceId}`;
    if (!this.activeCalls.has(callKey)) {
      this.activeCalls.set(callKey, new Set());
    }
    this.activeCalls.get(callKey)!.add(callerId);
    this.activeCalls.get(callKey)!.add(calleeId);
  }

  @SubscribeMessage('voice:call-decline')
  handleVoiceCallDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      callerId: string;
      calleeId: string;
    },
  ): void {
    const { callerId } = data;
    
    this.logger.log(`[Voice] Call declined`);
    
    // Find caller's socket
    const callerSocket = this.findUserSocket(callerId);
    if (callerSocket) {
      callerSocket.emit('voice:call-declined', {});
    }
  }

  @SubscribeMessage('voice:call-end')
  handleVoiceCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      targetUserId: string;
      fromUserId: string;
    },
  ): void {
    const { workspaceId, targetUserId, fromUserId } = data;
    
    this.logger.log(`[Voice] Call ended by ${fromUserId}`);
    
    // Find target's socket
    const targetSocket = this.findUserSocket(targetUserId);
    if (targetSocket) {
      targetSocket.emit('voice:call-ended', { fromUserId });
    }
    
    // Remove from active calls
    const callKey = `call:${workspaceId}`;
    const activeCall = this.activeCalls.get(callKey);
    if (activeCall) {
      activeCall.delete(fromUserId);
      activeCall.delete(targetUserId);
      if (activeCall.size === 0) {
        this.activeCalls.delete(callKey);
      }
    }
  }

  @SubscribeMessage('voice:signal')
  handleVoiceSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      targetUserId: string;
      signalData: any; // SimplePeer signal data (SDP or ICE candidate)
      fromUserId: string;
      fromUserName: string;
    },
  ): void {
    const { targetUserId, signalData, fromUserId, fromUserName } = data;
    
    // Find target's socket
    const targetSocket = this.findUserSocket(targetUserId);
    if (!targetSocket) {
      this.logger.warn(`[Voice] Target user ${targetUserId} not found for signal`);
      return;
    }
    
    // Forward WebRTC signal
    targetSocket.emit('voice:signal', {
      fromUserId,
      fromUserName,
      signalData,
    });
  }

  // ============================================
  // Proximity Voice Chat
  // ============================================

  @SubscribeMessage('voice:enable-proximity')
  handleEnableProximityVoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      userId: string;
    },
  ): void {
    const { workspaceId, userId } = data;
    const roomKey = `office:${workspaceId}`;
    
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return;
    
    const player = officeRoom.get(userId);
    if (!player) return;
    
    this.logger.log(`[Voice] Proximity voice enabled for ${player.name}`);
    
    // Find nearby players and trigger connections
    const nearbyPlayers = this.getPlayersInVoiceRange(workspaceId, userId);
    
    nearbyPlayers.forEach(nearbyPlayerId => {
      const nearbyPlayer = officeRoom.get(nearbyPlayerId);
      if (nearbyPlayer) {
        // Notify both players to establish voice connection
        client.emit('voice:proximity-enter', {
          userId: nearbyPlayerId,
          userName: nearbyPlayer.name,
          position: nearbyPlayer.position,
        });
        
        const nearbySocket = this.findUserSocket(nearbyPlayerId);
        if (nearbySocket) {
          nearbySocket.emit('voice:proximity-enter', {
            userId,
            userName: player.name,
            position: player.position,
          });
        }
      }
    });
  }

  @SubscribeMessage('voice:disable-proximity')
  handleDisableProximityVoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      workspaceId: string;
      userId: string;
    },
  ): void {
    const { workspaceId, userId } = data;
    const roomKey = `office:${workspaceId}`;
    
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return;
    
    this.logger.log(`[Voice] Proximity voice disabled for ${userId}`);
    
    // Notify all nearby players to disconnect voice
    const nearbyPlayers = this.getPlayersInVoiceRange(workspaceId, userId);
    
    nearbyPlayers.forEach(nearbyPlayerId => {
      const nearbySocket = this.findUserSocket(nearbyPlayerId);
      if (nearbySocket) {
        nearbySocket.emit('voice:proximity-exit', { userId });
      }
    });
  }

  // Helper: Get players within voice chat range
  private getPlayersInVoiceRange(workspaceId: string, userId: string): string[] {
    const roomKey = `office:${workspaceId}`;
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return [];
    
    const player = officeRoom.get(userId);
    if (!player) return [];
    
    const nearby: string[] = [];
    
    officeRoom.forEach((otherPlayer, otherId) => {
      if (otherId === userId) return;
      
      const distance = this.calculateDistance(player.position, otherPlayer.position);
      if (distance <= this.VOICE_PROXIMITY_THRESHOLD) {
        nearby.push(otherId);
      }
    });
    
    return nearby;
  }

  // Helper: Check voice proximity changes on player move
  checkVoiceProximity(workspaceId: string, userId: string, client: Socket): void {
    const roomKey = `office:${workspaceId}`;
    const officeRoom = this.officePlayers.get(roomKey);
    if (!officeRoom) return;
    
    const player = officeRoom.get(userId);
    if (!player) return;
    
    // Get all players in voice range
    officeRoom.forEach((otherPlayer, otherId) => {
      if (otherId === userId) return;
      
      const distance = this.calculateDistance(player.position, otherPlayer.position);
      
      // Update position for spatial audio
      const otherSocket = this.findUserSocket(otherId);
      if (otherSocket) {
        // Send position update for spatial audio calculation
        otherSocket.emit('voice:position-update', {
          userId,
          position: player.position,
        });
      }
      
      client.emit('voice:position-update', {
        userId: otherId,
        position: otherPlayer.position,
      });
    });
  }
}
