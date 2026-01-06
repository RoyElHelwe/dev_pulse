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
}
