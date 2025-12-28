import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'

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
  server: Server

  private logger: Logger = new Logger('WebsocketGateway')

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized')
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): string {
    return 'pong'
  }

  @SubscribeMessage('join:workspace')
  handleJoinWorkspace(client: Socket, workspaceId: string): void {
    client.join(`workspace:${workspaceId}`)
    this.logger.log(`Client ${client.id} joined workspace ${workspaceId}`)
    client.emit('joined:workspace', { workspaceId })
  }

  @SubscribeMessage('leave:workspace')
  handleLeaveWorkspace(client: Socket, workspaceId: string): void {
    client.leave(`workspace:${workspaceId}`)
    this.logger.log(`Client ${client.id} left workspace ${workspaceId}`)
    client.emit('left:workspace', { workspaceId })
  }

  // Broadcast to workspace
  broadcastToWorkspace(workspaceId: string, event: string, data: any): void {
    this.server.to(`workspace:${workspaceId}`).emit(event, data)
  }
}
