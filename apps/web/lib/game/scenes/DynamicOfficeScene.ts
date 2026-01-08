/**
 * Dynamic Office Scene
 * 
 * A Phaser scene that renders dynamically generated office layouts.
 * Supports both generated layouts and templates.
 */

import * as Phaser from 'phaser';
import { GAME_CONFIG } from '../constants';
import { Player } from '../objects/Player';
import { DynamicOfficeBuilder } from '../objects/DynamicOfficeBuilder';
import { OfficeLayoutData, DeskData, RoomData } from '../generators/types';
import { PlayerData, Position, PlayerDirection } from '../types';

export interface DynamicOfficeSceneConfig {
  layout: OfficeLayoutData;
  localPlayer: PlayerData;
  onPlayerMove?: (position: Position, direction: PlayerDirection) => void;
  onReady?: () => void;
  onDeskClick?: (desk: DeskData) => void;
  onRoomClick?: (room: RoomData) => void;
  showGrid?: boolean;
  showZoneOverlays?: boolean;
  editorMode?: boolean;
}

export class DynamicOfficeScene extends Phaser.Scene {
  private localPlayer!: Player;
  private remotePlayers: Map<string, Player> = new Map();
  private officeBuilder!: DynamicOfficeBuilder;
  private collisionBodies: Phaser.GameObjects.Rectangle[] = [];
  
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { 
    W: Phaser.Input.Keyboard.Key; 
    A: Phaser.Input.Keyboard.Key; 
    S: Phaser.Input.Keyboard.Key; 
    D: Phaser.Input.Keyboard.Key 
  };
  
  private config!: DynamicOfficeSceneConfig;
  private lastPosition: Position = { x: 0, y: 0 };
  private lastDirection: PlayerDirection = 'down';
  private moveThrottle: number = 50;
  private lastMoveEmit: number = 0;
  
  // Mobile joystick input
  private mobileInput: { 
    direction: PlayerDirection | null; 
    velocity: { x: number; y: number } 
  } = {
    direction: null,
    velocity: { x: 0, y: 0 }
  };
  
  constructor() {
    super({ key: 'DynamicOfficeScene' });
  }
  
  /**
   * Preload assets
   */
  preload(): void {
    // Preload tileset assets
    DynamicOfficeBuilder.preloadAssets(this);
  }
  
  /**
   * Initialize scene with config
   */
  init(data: DynamicOfficeSceneConfig): void {
    this.config = data;
  }
  
  /**
   * Create scene
   */
  create(): void {
    const { layout } = this.config;
    
    // Get layout dimensions (support both old and new format)
    const layoutWidth = layout.dimensions?.width ?? (layout as any).width ?? 1600;
    const layoutHeight = layout.dimensions?.height ?? (layout as any).height ?? 900;
    
    // Set world bounds to layout size
    this.physics.world.setBounds(0, 0, layoutWidth, layoutHeight);
    
    // Build office environment with dynamic builder
    this.officeBuilder = new DynamicOfficeBuilder(this, {
      layout,
      showGrid: this.config.showGrid,
      showZoneOverlays: this.config.showZoneOverlays,
      interactiveMode: this.config.editorMode,
      onDeskClick: this.config.onDeskClick,
      onRoomClick: this.config.onRoomClick,
    });
    
    this.officeBuilder.build();
    
    // Get collision bodies
    this.collisionBodies = this.officeBuilder.getCollisionBodies();
    
    // Create local player at spawn point
    this.createLocalPlayer();
    
    // Setup input
    this.setupInput();
    
    // Setup camera
    this.setupCamera();
    
    // Add collision between player and environment
    this.collisionBodies.forEach(body => {
      this.physics.add.collider(this.localPlayer, body);
    });
    
    // Add instructions
    this.addInstructions();
    
    // Notify that scene is ready
    if (this.config.onReady) {
      this.config.onReady();
    }
  }
  
  /**
   * Create the local player at spawn point
   */
  private createLocalPlayer(): void {
    const spawnPoint = this.officeBuilder.getSpawnPoint();
    const spawnX = this.config.localPlayer.position?.x || spawnPoint.x;
    const spawnY = this.config.localPlayer.position?.y || spawnPoint.y;
    
    this.localPlayer = new Player(
      this,
      spawnX,
      spawnY,
      this.config.localPlayer,
      true
    );
    
    // Set initial direction from spawn point if available
    if (spawnPoint.direction) {
      this.lastDirection = spawnPoint.direction;
    }
    
    this.lastPosition = { x: spawnX, y: spawnY };
  }
  
  /**
   * Setup keyboard input
   */
  private setupInput(): void {
    // Arrow keys
    this.cursors = this.input.keyboard!.createCursorKeys();
    
    // WASD keys
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    
    // Listen for mobile joystick events
    if (typeof window !== 'undefined') {
      window.addEventListener('mobile-joystick', ((e: CustomEvent) => {
        this.mobileInput = e.detail;
      }) as EventListener);
    }
  }
  
  /**
   * Setup camera to follow player
   */
  private setupCamera(): void {
    const dimensions = this.officeBuilder.getDimensions();
    
    // Camera follows player with smooth lerp
    this.cameras.main.startFollow(this.localPlayer, true, 0.15, 0.15);
    this.cameras.main.setZoom(1);
    
    // Set bounds to layout dimensions
    this.cameras.main.setBounds(0, 0, dimensions.width, dimensions.height);
    
    // Handle resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      const width = gameSize.width;
      const height = gameSize.height;
      this.cameras.main.setBounds(
        0,
        0,
        Math.max(width, dimensions.width),
        Math.max(height, dimensions.height)
      );
    });
  }
  
  /**
   * Add instruction text overlay
   */
  private addInstructions(): void {
    const layoutName = this.config.layout.name || 'Office';
    const instructionText = `${layoutName} | WASD or Arrow Keys to move`;
    
    const instructions = this.add.text(10, 10, instructionText, {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      color: '#666666',
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      padding: { x: 10, y: 6 },
    });
    
    instructions.setScrollFactor(0);
    instructions.setDepth(1000);
  }
  
  /**
   * Update loop
   */
  update(time: number, delta: number): void {
    this.handleMovement();
    this.checkAndEmitPosition(time);
  }
  
  /**
   * Handle player movement input
   */
  private handleMovement(): void {
    const speed = GAME_CONFIG.PLAYER_SPEED;
    let velocityX = 0;
    let velocityY = 0;
    let direction: PlayerDirection = this.lastDirection;
    
    // Keyboard input
    const up = this.cursors.up?.isDown || this.wasd.W?.isDown;
    const down = this.cursors.down?.isDown || this.wasd.S?.isDown;
    const left = this.cursors.left?.isDown || this.wasd.A?.isDown;
    const right = this.cursors.right?.isDown || this.wasd.D?.isDown;
    
    if (up) {
      velocityY = -speed;
      direction = 'up';
    } else if (down) {
      velocityY = speed;
      direction = 'down';
    }
    
    if (left) {
      velocityX = -speed;
      direction = 'left';
    } else if (right) {
      velocityX = speed;
      direction = 'right';
    }
    
    // Mobile joystick input (override keyboard)
    if (this.mobileInput.direction) {
      velocityX = this.mobileInput.velocity.x * speed;
      velocityY = this.mobileInput.velocity.y * speed;
      direction = this.mobileInput.direction;
    }
    
    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      const factor = 1 / Math.sqrt(2);
      velocityX *= factor;
      velocityY *= factor;
    }
    
    // Apply velocity
    this.localPlayer.setVelocity(velocityX, velocityY);
    
    // Update direction if moving
    if (velocityX !== 0 || velocityY !== 0) {
      this.lastDirection = direction;
      this.localPlayer.setDirection(direction);
    }
  }
  
  /**
   * Check and emit position changes
   */
  private checkAndEmitPosition(time: number): void {
    const pos = this.localPlayer.getPosition();
    const posChanged = pos.x !== this.lastPosition.x || pos.y !== this.lastPosition.y;
    const dirChanged = this.localPlayer.getDirection() !== this.lastDirection;
    
    if ((posChanged || dirChanged) && time - this.lastMoveEmit > this.moveThrottle) {
      this.lastPosition = { ...pos };
      this.lastMoveEmit = time;
      
      if (this.config.onPlayerMove) {
        this.config.onPlayerMove(pos, this.localPlayer.getDirection());
      }
    }
  }
  
  /**
   * Add a remote player to the scene
   */
  public addRemotePlayer(playerData: PlayerData): void {
    if (this.remotePlayers.has(playerData.id)) {
      return;
    }
    
    const player = new Player(
      this,
      playerData.position?.x || 400,
      playerData.position?.y || 400,
      playerData,
      false
    );
    
    this.remotePlayers.set(playerData.id, player);
  }
  
  /**
   * Update a remote player's position
   */
  public updateRemotePlayer(
    playerId: string, 
    position: Position, 
    direction: PlayerDirection
  ): void {
    const player = this.remotePlayers.get(playerId);
    if (player) {
      player.moveTo(position.x, position.y);
      player.setDirection(direction);
    }
  }
  
  /**
   * Remove a remote player from the scene
   */
  public removeRemotePlayer(playerId: string): void {
    const player = this.remotePlayers.get(playerId);
    if (player) {
      player.destroy();
      this.remotePlayers.delete(playerId);
    }
  }
  
  /**
   * Get all remote players
   */
  public getRemotePlayers(): Map<string, Player> {
    return this.remotePlayers;
  }
  
  /**
   * Update the office layout (for real-time editing)
   */
  public updateLayout(newLayout: OfficeLayoutData): void {
    // Destroy current builder
    this.officeBuilder.destroy();
    
    // Clear collision bodies
    this.collisionBodies.forEach(body => body.destroy());
    this.collisionBodies = [];
    
    // Rebuild with new layout
    this.config.layout = newLayout;
    this.officeBuilder = new DynamicOfficeBuilder(this, {
      layout: newLayout,
      showGrid: this.config.showGrid,
      showZoneOverlays: this.config.showZoneOverlays,
      interactiveMode: this.config.editorMode,
      onDeskClick: this.config.onDeskClick,
      onRoomClick: this.config.onRoomClick,
    });
    
    this.officeBuilder.build();
    this.collisionBodies = this.officeBuilder.getCollisionBodies();
    
    // Re-add collisions
    this.collisionBodies.forEach(body => {
      this.physics.add.collider(this.localPlayer, body);
    });
    
    // Update world bounds
    this.physics.world.setBounds(0, 0, newLayout.width, newLayout.height);
    this.cameras.main.setBounds(0, 0, newLayout.width, newLayout.height);
  }
  
  /**
   * Highlight a specific zone
   */
  public highlightZone(zoneId: string, highlight: boolean = true): void {
    this.officeBuilder.highlightZone(zoneId, highlight);
  }
  
  /**
   * Update a desk's state
   */
  public updateDesk(deskId: string, updates: Partial<DeskData>): void {
    this.officeBuilder.updateDesk(deskId, updates);
  }
  
  /**
   * Get the current layout
   */
  public getLayout(): OfficeLayoutData {
    return this.config.layout;
  }
  
  /**
   * Teleport player to a specific location
   */
  public teleportPlayer(x: number, y: number): void {
    this.localPlayer.setPosition(x, y);
    this.lastPosition = { x, y };
  }
  
  /**
   * Get local player position
   */
  public getPlayerPosition(): Position {
    return this.localPlayer.getPosition();
  }
}
