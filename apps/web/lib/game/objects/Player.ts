import * as Phaser from 'phaser'
import { GAME_CONFIG } from '../constants'
import { PlayerData, Position, PlayerStatus, PlayerDirection, getAvatarColor } from '../types'

export class Player extends Phaser.GameObjects.Container {
  public playerId: string
  public playerName: string
  public playerStatus: PlayerStatus = 'online'
  public direction: PlayerDirection = 'down'
  
  private avatarGraphics!: Phaser.GameObjects.Graphics
  private nameLabel!: Phaser.GameObjects.Text
  private statusIndicator!: Phaser.GameObjects.Graphics
  private avatarColor: number
  private isLocalPlayer: boolean
  
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerData: PlayerData,
    isLocal: boolean = false
  ) {
    super(scene, x, y)
    
    this.playerId = playerData.id
    this.playerName = playerData.name
    this.playerStatus = playerData.status || 'online'
    this.isLocalPlayer = isLocal
    this.avatarColor = parseInt(getAvatarColor(playerData.id).replace('#', '0x'))
    
    this.createAvatar()
    this.createNameLabel()
    this.createStatusIndicator()
    
    scene.add.existing(this)
    
    // Enable physics for local player
    if (isLocal) {
      scene.physics.add.existing(this)
      const physicsBody = this.body as Phaser.Physics.Arcade.Body
      physicsBody.setCollideWorldBounds(true)
      physicsBody.setSize(GAME_CONFIG.PLAYER_SIZE, GAME_CONFIG.PLAYER_SIZE)
      physicsBody.setOffset(-GAME_CONFIG.PLAYER_SIZE / 2, -GAME_CONFIG.PLAYER_SIZE / 2)
    }
  }
  
  private createAvatar(): void {
    this.avatarGraphics = this.scene.add.graphics()
    
    // Draw avatar body (circle with direction indicator)
    this.drawAvatar()
    
    this.add(this.avatarGraphics)
  }
  
  private drawAvatar(): void {
    this.avatarGraphics.clear()
    
    const size = GAME_CONFIG.PLAYER_SIZE
    const halfSize = size / 2
    
    // Shadow
    this.avatarGraphics.fillStyle(0x000000, 0.2)
    this.avatarGraphics.fillEllipse(2, 4, size, size / 2)
    
    // Body (circle)
    this.avatarGraphics.fillStyle(this.avatarColor)
    this.avatarGraphics.fillCircle(0, 0, halfSize)
    
    // Border
    this.avatarGraphics.lineStyle(2, 0x000000, 0.3)
    this.avatarGraphics.strokeCircle(0, 0, halfSize)
    
    // Direction indicator (small triangle)
    const indicatorSize = 6
    this.avatarGraphics.fillStyle(0xffffff, 0.8)
    
    switch (this.direction) {
      case 'up':
        this.avatarGraphics.fillTriangle(
          0, -halfSize - 2,
          -indicatorSize, -halfSize + indicatorSize,
          indicatorSize, -halfSize + indicatorSize
        )
        break
      case 'down':
        this.avatarGraphics.fillTriangle(
          0, halfSize + 2,
          -indicatorSize, halfSize - indicatorSize,
          indicatorSize, halfSize - indicatorSize
        )
        break
      case 'left':
        this.avatarGraphics.fillTriangle(
          -halfSize - 2, 0,
          -halfSize + indicatorSize, -indicatorSize,
          -halfSize + indicatorSize, indicatorSize
        )
        break
      case 'right':
        this.avatarGraphics.fillTriangle(
          halfSize + 2, 0,
          halfSize - indicatorSize, -indicatorSize,
          halfSize - indicatorSize, indicatorSize
        )
        break
    }
    
    // Local player highlight
    if (this.isLocalPlayer) {
      this.avatarGraphics.lineStyle(3, 0xffd700, 0.8)
      this.avatarGraphics.strokeCircle(0, 0, halfSize + 4)
    }
  }
  
  private createNameLabel(): void {
    this.nameLabel = this.scene.add.text(0, -GAME_CONFIG.PLAYER_SIZE - 8, this.playerName, {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      padding: { x: 4, y: 2 },
    })
    this.nameLabel.setOrigin(0.5, 1)
    this.add(this.nameLabel)
  }
  
  private createStatusIndicator(): void {
    this.statusIndicator = this.scene.add.graphics()
    this.updateStatusIndicator()
    this.add(this.statusIndicator)
  }
  
  private updateStatusIndicator(): void {
    this.statusIndicator.clear()
    
    const colors: Record<string, number> = {
      online: GAME_CONFIG.COLORS.STATUS_ONLINE,
      available: GAME_CONFIG.COLORS.STATUS_ONLINE,
      away: GAME_CONFIG.COLORS.STATUS_AWAY,
      busy: GAME_CONFIG.COLORS.STATUS_BUSY,
      dnd: GAME_CONFIG.COLORS.STATUS_BUSY,
      offline: GAME_CONFIG.COLORS.STATUS_OFFLINE,
    }
    
    const halfSize = GAME_CONFIG.PLAYER_SIZE / 2
    
    // Status dot
    const statusColor = colors[this.playerStatus] || GAME_CONFIG.COLORS.STATUS_OFFLINE
    this.statusIndicator.fillStyle(statusColor)
    this.statusIndicator.fillCircle(halfSize - 2, -halfSize + 2, 5)
    this.statusIndicator.lineStyle(1, 0xffffff)
    this.statusIndicator.strokeCircle(halfSize - 2, -halfSize + 2, 5)
  }
  
  public setDirection(direction: PlayerDirection): void {
    if (this.direction !== direction) {
      this.direction = direction
      this.drawAvatar()
    }
  }
  
  public setStatus(status: PlayerStatus | string): void {
    const validStatus = status as PlayerStatus
    if (this.playerStatus !== validStatus) {
      this.playerStatus = validStatus
      this.updateStatusIndicator()
    }
  }
  
  public moveToPosition(x: number, y: number, smooth: boolean = true): void {
    if (smooth && !this.isLocalPlayer) {
      // Smooth interpolation for remote players
      this.scene.tweens.add({
        targets: this,
        x: x,
        y: y,
        duration: 100,
        ease: 'Linear',
      })
    } else {
      this.x = x
      this.y = y
    }
  }
  
  public getPosition(): Position {
    return { x: this.x, y: this.y }
  }
  
  public getPhysicsBody(): Phaser.Physics.Arcade.Body | null {
    return this.body as Phaser.Physics.Arcade.Body | null
  }
  
  public getData(): PlayerData {
    return {
      id: this.playerId,
      name: this.playerName,
      position: this.getPosition(),
      direction: this.direction,
      status: this.playerStatus,
      avatarColor: getAvatarColor(this.playerId),
    }
  }
}
