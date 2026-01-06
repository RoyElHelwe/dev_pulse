import * as Phaser from 'phaser'
import { GAME_CONFIG } from '../constants'
import { Player } from '../objects/Player'
import { OfficeBuilder } from '../objects/OfficeBuilder'
import { PlayerData, Position, PlayerDirection } from '../types'

export interface OfficeSceneConfig {
  localPlayer: PlayerData
  onPlayerMove?: (position: Position, direction: PlayerDirection) => void
  onReady?: () => void
}

export class OfficeScene extends Phaser.Scene {
  private localPlayer!: Player
  private remotePlayers: Map<string, Player> = new Map()
  private officeBuilder!: OfficeBuilder
  private collisionBodies: Phaser.GameObjects.Rectangle[] = []
  
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key }
  
  private config!: OfficeSceneConfig
  private lastPosition: Position = { x: 0, y: 0 }
  private lastDirection: PlayerDirection = 'down'
  private moveThrottle: number = 50 // ms
  private lastMoveEmit: number = 0
  
  constructor() {
    super({ key: 'OfficeScene' })
  }
  
  init(data: OfficeSceneConfig): void {
    this.config = data
  }
  
  create(): void {
    // Set world bounds
    this.physics.world.setBounds(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)
    
    // Build office environment
    this.officeBuilder = new OfficeBuilder(this)
    this.officeBuilder.buildOffice()
    
    // Get collision bodies
    this.collisionBodies = this.officeBuilder.getCollisionBodies()
    
    // Create local player
    this.createLocalPlayer()
    
    // Setup input
    this.setupInput()
    
    // Setup camera
    this.setupCamera()
    
    // Add collision between player and walls
    this.collisionBodies.forEach(body => {
      this.physics.add.collider(this.localPlayer, body)
    })
    
    // Notify that scene is ready
    if (this.config.onReady) {
      this.config.onReady()
    }
    
    // Add instructions text
    this.addInstructions()
  }
  
  private createLocalPlayer(): void {
    const spawnX = this.config.localPlayer.position?.x || GAME_CONFIG.DEFAULT_OFFICE.SPAWN_X
    const spawnY = this.config.localPlayer.position?.y || GAME_CONFIG.DEFAULT_OFFICE.SPAWN_Y
    
    this.localPlayer = new Player(
      this,
      spawnX,
      spawnY,
      this.config.localPlayer,
      true
    )
    
    this.lastPosition = { x: spawnX, y: spawnY }
  }
  
  private setupInput(): void {
    // Arrow keys
    this.cursors = this.input.keyboard!.createCursorKeys()
    
    // WASD
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
  }
  
  private setupCamera(): void {
    // Camera follows player
    this.cameras.main.startFollow(this.localPlayer, true, 0.1, 0.1)
    this.cameras.main.setZoom(1)
    this.cameras.main.setBounds(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)
  }
  
  private addInstructions(): void {
    const instructions = this.add.text(10, 10, 'Use WASD or Arrow Keys to move', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#666666',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      padding: { x: 8, y: 4 },
    })
    instructions.setScrollFactor(0) // Fixed to camera
    instructions.setDepth(1000)
  }
  
  update(time: number, delta: number): void {
    this.handleMovement()
    this.checkAndEmitPosition(time)
  }
  
  private handleMovement(): void {
    const physicsBody = this.localPlayer.getPhysicsBody()
    if (!physicsBody) return
    
    const speed = GAME_CONFIG.PLAYER_SPEED
    let velocityX = 0
    let velocityY = 0
    let direction = this.localPlayer.direction
    
    // Check input
    const up = this.cursors.up.isDown || this.wasd.W.isDown
    const down = this.cursors.down.isDown || this.wasd.S.isDown
    const left = this.cursors.left.isDown || this.wasd.A.isDown
    const right = this.cursors.right.isDown || this.wasd.D.isDown
    
    if (up) {
      velocityY = -speed
      direction = 'up'
    } else if (down) {
      velocityY = speed
      direction = 'down'
    }
    
    if (left) {
      velocityX = -speed
      direction = 'left'
    } else if (right) {
      velocityX = speed
      direction = 'right'
    }
    
    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707
      velocityY *= 0.707
    }
    
    physicsBody.setVelocity(velocityX, velocityY)
    this.localPlayer.setDirection(direction)
  }
  
  private checkAndEmitPosition(time: number): void {
    const currentPos = this.localPlayer.getPosition()
    const currentDir = this.localPlayer.direction
    
    // Check if position or direction changed
    const posChanged = 
      Math.abs(currentPos.x - this.lastPosition.x) > 1 ||
      Math.abs(currentPos.y - this.lastPosition.y) > 1
    const dirChanged = currentDir !== this.lastDirection
    
    // Throttle emits
    if ((posChanged || dirChanged) && time - this.lastMoveEmit > this.moveThrottle) {
      this.lastPosition = { ...currentPos }
      this.lastDirection = currentDir
      this.lastMoveEmit = time
      
      if (this.config.onPlayerMove) {
        this.config.onPlayerMove(currentPos, currentDir)
      }
    }
  }
  
  // Public methods for external control
  
  public addRemotePlayer(playerData: PlayerData): void {
    if (playerData.id === this.config.localPlayer.id) return
    if (this.remotePlayers.has(playerData.id)) {
      console.log('[OfficeScene] Player already exists:', playerData.id)
      return
    }
    
    console.log('[OfficeScene] Creating remote player at:', playerData.position)
    
    const player = new Player(
      this,
      playerData.position.x,
      playerData.position.y,
      playerData,
      false
    )
    
    // Set depth so remote players render above floor
    player.setDepth(10)
    
    this.remotePlayers.set(playerData.id, player)
    console.log('[OfficeScene] Remote players count:', this.remotePlayers.size)
  }
  
  public updateRemotePlayer(playerId: string, data: Partial<PlayerData>): void {
    const player = this.remotePlayers.get(playerId)
    if (!player) return
    
    if (data.position) {
      player.moveToPosition(data.position.x, data.position.y)
    }
    
    if (data.direction) {
      player.setDirection(data.direction)
    }
    
    if (data.status) {
      player.setStatus(data.status)
    }
  }
  
  public removeRemotePlayer(playerId: string): void {
    const player = this.remotePlayers.get(playerId)
    if (player) {
      player.destroy()
      this.remotePlayers.delete(playerId)
    }
  }
  
  public syncPlayers(players: PlayerData[]): void {
    console.log('[OfficeScene] syncPlayers called with:', players.length, 'players')
    
    // Add or update players
    players.forEach(playerData => {
      if (playerData.id === this.config.localPlayer.id) return
      
      if (this.remotePlayers.has(playerData.id)) {
        this.updateRemotePlayer(playerData.id, playerData)
      } else {
        console.log('[OfficeScene] Adding remote player:', playerData.name)
        this.addRemotePlayer(playerData)
      }
    })
    
    // Remove players that are no longer in the list
    const currentIds = new Set(players.map(p => p.id))
    this.remotePlayers.forEach((player, id) => {
      if (!currentIds.has(id)) {
        console.log('[OfficeScene] Removing player:', id)
        this.removeRemotePlayer(id)
      }
    })
  }
  
  public getLocalPlayerData(): PlayerData {
    return this.localPlayer.getData()
  }
}
