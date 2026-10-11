/**
 * View and camera control system for the office scene.
 * Manages viewport boundaries, zoom scaling, view shifts, and canvas resize events.
 */

import * as Phaser from 'phaser';
import {
  BASE_ZOOM_MAX,
  BASE_ZOOM_MIN,
  BASE_ZOOM_REF_WIDTH_TILES,
  CAMERA_BG_COLOR,
  CAMERA_LERP,
  TILE,
  VIEW_MARGIN_BOTTOM_PX,
  VIEW_MARGIN_TOP_PX,
  WHEEL_ZOOM_STEP,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_RESET_TWEEN_MS,
  ZOOM_TWEEN_MS,
} from '../constants';
import type { OfficeLayout } from '../layout/types';

interface ViewControlOptions {
  scene: Phaser.Scene;
  getLayout: () => OfficeLayout;
  getDpr: () => number;
}

/** Controls scene camera follow, bounds, zoom, and horizontal viewport shift. */
export class ViewControl {
  private readonly scene: Phaser.Scene;
  private readonly getLayout: () => OfficeLayout;
  private readonly getDpr: () => number;

  userZoom = 1;
  viewShift = 0;

  private wheelHandler: ((pointer: unknown, over: unknown, deltaX: number, deltaY: number) => void) | null = null;

  constructor(opts: ViewControlOptions) {
    this.scene = opts.scene;
    this.getLayout = opts.getLayout;
    this.getDpr = opts.getDpr;
  }

  /** Sets up camera bounds, follow lerp, background color, initial zoom, and wheel/resize listeners. */
  setup(target: Phaser.GameObjects.GameObject & { x: number; y: number }): void {
    const layout = this.getLayout();
    const worldW = layout.width * TILE;
    const worldH = layout.height * TILE;
    const cam = this.scene.cameras.main;

    cam.setBackgroundColor(CAMERA_BG_COLOR);
    cam.setBounds(0, -VIEW_MARGIN_TOP_PX, worldW, worldH + VIEW_MARGIN_TOP_PX + VIEW_MARGIN_BOTTOM_PX);
    cam.startFollow(target, true, CAMERA_LERP, CAMERA_LERP);
    cam.setZoom(this.targetZoom());
    cam.centerOn(target.x, target.y);

    this.wheelHandler = (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.zoomBy(dy > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP);
    };
    this.scene.input.on('wheel', this.wheelHandler);
    this.scene.scale.on('resize', this.onResize, this);
  }

  /** Cleans up input and scale event listeners registered by the view controller. */
  destroy(): void {
    if (this.wheelHandler) {
      this.scene.input.off('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    this.scene.scale.off('resize', this.onResize, this);
  }

  /** Zooms the camera by a multiplicative factor, clamping between ZOOM_MIN and ZOOM_MAX. */
  zoomBy(factor: number): void {
    this.userZoom = Phaser.Math.Clamp(this.userZoom * factor, ZOOM_MIN, ZOOM_MAX);
    this.scene.cameras.main.zoomTo(this.targetZoom(), ZOOM_TWEEN_MS, 'Sine.easeOut', true);
    this.applyViewShift();
  }

  /** Resets user zoom back to 1x and eases the camera smoothly. */
  resetView(): void {
    this.userZoom = 1;
    this.scene.cameras.main.zoomTo(this.targetZoom(), ZOOM_RESET_TWEEN_MS, 'Sine.easeOut', true);
    this.applyViewShift();
  }

  /** Sets the horizontal view offset in CSS pixels (e.g. pushed aside by open side panels). */
  setViewShift(cssPx: number): void {
    this.viewShift = cssPx;
    this.applyViewShift();
  }

  /** Applies camera follow offset according to viewShift, DPR, and target zoom. */
  applyViewShift(): void {
    // Follow offsets are world units; the camera eases there through its follow lerp.
    this.scene.cameras.main.setFollowOffset((this.viewShift * this.getDpr()) / this.targetZoom(), 0);
  }

  /** Computes the target zoom factor keeping avatars at a readable scale without showing empty borders. */
  targetZoom(): number {
    const dpr = this.getDpr();
    const layout = this.getLayout();
    const cam = this.scene.cameras.main;
    const base = Phaser.Math.Clamp(cam.width / dpr / (BASE_ZOOM_REF_WIDTH_TILES * TILE), BASE_ZOOM_MIN, BASE_ZOOM_MAX);
    // Never zoom out further than the office itself (no empty space around it).
    const cover = Math.max(
      cam.width / (layout.width * TILE),
      cam.height / (layout.height * TILE + VIEW_MARGIN_TOP_PX + VIEW_MARGIN_BOTTOM_PX),
    );
    return Math.max(base * this.userZoom * dpr, cover);
  }

  /** Handles canvas resize events by updating camera dimensions and zoom. */
  onResize(size: Phaser.Structs.Size): void {
    this.scene.cameras.main.setSize(size.width, size.height);
    this.scene.cameras.main.setZoom(this.targetZoom());
    this.applyViewShift();
  }
}
