// Game types
export * from './types'
export * from './constants'

// Generator system
export * from './generators'

// Asset configuration
export * from './assets'

// Game objects
export { Player } from './objects/Player'
export { OfficeBuilder } from './objects/OfficeBuilder'
export { DynamicOfficeBuilder } from './objects/DynamicOfficeBuilder'
export type { DynamicOfficeConfig } from './objects/DynamicOfficeBuilder'

// Game scenes
export { OfficeScene } from './scenes/OfficeScene'
export type { OfficeSceneConfig } from './scenes/OfficeScene'

export { DynamicOfficeScene } from './scenes/DynamicOfficeScene'
export type { DynamicOfficeSceneConfig } from './scenes/DynamicOfficeScene'
