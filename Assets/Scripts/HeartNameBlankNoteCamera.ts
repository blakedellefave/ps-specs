import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {IMAGE_MATERIAL_ASSET} from "SpectaclesUIKit.lspkg/Scripts/Utility/Assets"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {HeartNameBlankNoteVoice} from "./HeartNameBlankNoteVoice"

const PHOTO_MAX_WIDTH = 9.6
const PHOTO_MAX_HEIGHT = 7.2
const PHOTO_MIN_HEIGHT = 2.8
const PHOTO_GAP = 0.6
const PAPER_EDGE_GAP = 0.55
const EMPTY_NOTE_TOP_GAP = 1.2
const PHOTO_SCALE = 0.85
const FRAME_SIDE_BORDER = 0.45
const FRAME_TOP_BORDER = 0.45
const FRAME_BOTTOM_BORDER = 0.85
const TAPE_WIDTH = 1.55
const TAPE_HEIGHT = 0.42

type TapePiece = {
  object: SceneObject
  visual: RoundedRectangle
  angleRadians: number
  side: number
  verticalSide: number
}

/** Opens a live Specs viewfinder and freezes a photo into the generated note. */
@component
export class HeartNameBlankNoteCamera extends BaseScriptComponent {
  private static readonly cameraModule = require("LensStudio:CameraModule") as CameraModule
  private static cameraTexture: Texture | null = null
  private static cameraProvider: CameraTextureProvider | null = null
  private static frameRegistration: EventRegistration | null = null
  private static hasCameraFrame = false
  private static activeViewfinder: HeartNameBlankNoteCamera | null = null

  private noteText: Text | null = null
  private voice: HeartNameBlankNoteVoice | null = null
  private cameraButton: Button | null = null
  private photoObject: SceneObject | null = null
  private photoImageObject: SceneObject | null = null
  private photoImage: Image | null = null
  private photoBackingObject: SceneObject | null = null
  private photoBacking: RoundedRectangle | null = null
  private tapePieces: TapePiece[] = []
  private capturedTexture: Texture | null = null
  private viewfinderOpen = false
  private pendingLayoutFrames = 0
  private contentChangedListeners: (() => void)[] = []

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("OnDestroyEvent").bind(() => this.onDestroyCamera())
  }

  public initialize(noteText: Text, voice: HeartNameBlankNoteVoice, cameraButton: Button): void {
    this.noteText = noteText
    this.voice = voice
    this.cameraButton = cameraButton
    this.buildPhotoSurface(noteText.getSceneObject())
    cameraButton.onTriggerUp.add(() => this.onCameraButtonTapped())
  }

  public onContentChanged(): void {
    if (this.photoObject?.enabled) this.pendingLayoutFrames = 2
  }

  public addContentChangedListener(listener: () => void): void {
    this.contentChangedListeners.push(listener)
  }

  public hasContent(): boolean {
    return this.capturedTexture !== null
  }

  public captureContent(): Texture | null {
    this.prepareForHide()
    return this.capturedTexture
  }

  public restoreContent(texture: Texture | null): void {
    this.prepareForHide()
    this.capturedTexture = texture
    if (this.photoImage && texture) this.photoImage.mainPass.baseTex = texture
    if (this.photoObject) this.photoObject.enabled = texture !== null
    this.pendingLayoutFrames = texture ? 2 : 0
  }

  public clearContent(): void {
    this.restoreContent(null)
  }

  public prepareForHide(): void {
    if (!this.viewfinderOpen) return
    this.closeViewfinderWithoutCapture()
    if (HeartNameBlankNoteCamera.activeViewfinder === this) {
      HeartNameBlankNoteCamera.activeViewfinder = null
      HeartNameBlankNoteCamera.releaseCameraStream()
    }
  }

  private onCameraButtonTapped(): void {
    // Finalize any active voice attachment before either opening or capturing.
    this.voice?.finishRecordingIfActive()
    if (this.viewfinderOpen) {
      this.capturePhoto()
      return
    }
    this.openViewfinder()
  }

  private openViewfinder(): void {
    if (!this.photoObject || !this.photoImage) return
    try {
      if (
        HeartNameBlankNoteCamera.activeViewfinder &&
        HeartNameBlankNoteCamera.activeViewfinder !== this
      ) {
        HeartNameBlankNoteCamera.activeViewfinder.closeViewfinderWithoutCapture()
      }
      HeartNameBlankNoteCamera.activeViewfinder = this
      const texture = HeartNameBlankNoteCamera.ensureCameraStream()
      this.photoImage.mainPass.baseTex = texture
      this.photoObject.enabled = true
      this.viewfinderOpen = true
      this.pendingLayoutFrames = 2
      if (this.cameraButton) this.cameraButton.opacity = 1
      console.log("[HeartNameBlankNoteCamera] Viewfinder opened; tap the camera button again to capture")
    } catch (error) {
      console.error("[HeartNameBlankNoteCamera] Could not open camera: " + error)
      if (this.cameraButton) this.cameraButton.opacity = 0.72
    }
  }

  private capturePhoto(): void {
    if (!this.photoImage || !HeartNameBlankNoteCamera.cameraTexture) return
    if (!HeartNameBlankNoteCamera.hasCameraFrame) {
      console.log("[HeartNameBlankNoteCamera] Waiting for the first camera frame")
      return
    }
    try {
      this.capturedTexture = HeartNameBlankNoteCamera.cameraTexture.copyFrame()
      this.photoImage.mainPass.baseTex = this.capturedTexture
      this.viewfinderOpen = false
      if (this.cameraButton) this.cameraButton.opacity = 0.72
      if (HeartNameBlankNoteCamera.activeViewfinder === this) {
        HeartNameBlankNoteCamera.activeViewfinder = null
        HeartNameBlankNoteCamera.releaseCameraStream()
      }
      for (const listener of this.contentChangedListeners) listener()
      console.log("[HeartNameBlankNoteCamera] Photo captured on note")
    } catch (error) {
      console.error("[HeartNameBlankNoteCamera] Photo capture failed: " + error)
    }
  }

  private static ensureCameraStream(): Texture {
    if (this.cameraTexture) return this.cameraTexture
    const request = CameraModule.createCameraRequest()
    request.cameraId = CameraModule.CameraId.Default_Color
    this.cameraTexture = this.cameraModule.requestCamera(request)
    this.cameraProvider = this.cameraTexture.control as CameraTextureProvider
    this.frameRegistration = this.cameraProvider.onNewFrame.add(() => {
      this.hasCameraFrame = true
    })
    return this.cameraTexture
  }

  private static releaseCameraStream(): void {
    if (this.cameraProvider && this.frameRegistration) {
      this.cameraProvider.onNewFrame.remove(this.frameRegistration)
    }
    this.frameRegistration = null
    this.cameraProvider = null
    this.cameraTexture = null
    this.hasCameraFrame = false
  }

  private closeViewfinderWithoutCapture(): void {
    this.viewfinderOpen = false
    if (this.cameraButton) this.cameraButton.opacity = 0.72
    if (this.photoObject && this.photoImage) {
      if (this.capturedTexture) {
        this.photoImage.mainPass.baseTex = this.capturedTexture
      } else {
        this.photoObject.enabled = false
      }
    }
  }

  private onDestroyCamera(): void {
    if (HeartNameBlankNoteCamera.activeViewfinder !== this) return
    HeartNameBlankNoteCamera.activeViewfinder = null
    HeartNameBlankNoteCamera.releaseCameraStream()
  }

  private buildPhotoSurface(parent: SceneObject): void {
    const object = global.scene.createSceneObject("P.S. Note Photo")
    object.setParent(parent)
    object.getTransform().setLocalPosition(new vec3(0, 0, 0.72))

    const backingObject = global.scene.createSceneObject("Instant Photo White Border")
    backingObject.setParent(object)
    backingObject.getTransform().setLocalPosition(new vec3(0, 0, -0.08))
    const backing = backingObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    backing.cornerRadius = 0.18
    backing.backgroundColor = new vec4(1, 1, 0.985, 0.98)
    backing.border = false
    backing.opacity = 1
    backing.renderOrder = 31

    const imageObject = global.scene.createSceneObject("Captured Photo Image")
    imageObject.setParent(object)
    imageObject.getTransform().setLocalPosition(new vec3(0, 0, 0.02))
    const image = imageObject.createComponent("Component.Image") as Image
    image.mainMaterial = IMAGE_MATERIAL_ASSET.clone()
    image.stretchMode = StretchMode.Stretch
    image.horizontalAlignment = HorizontalAlignment.Center
    image.verticalAlignment = VerticalAlignment.Center
    image.mainPass.depthTest = true
    image.renderOrder = 32

    this.createTapePiece(object, "Clear Tape Top Left", -18, -1, 1)
    this.createTapePiece(object, "Clear Tape Top Right", 15, 1, 1)
    this.createTapePiece(object, "Clear Tape Bottom Left", 14, -1, -1)
    this.createTapePiece(object, "Clear Tape Bottom Right", -17, 1, -1)

    this.photoObject = object
    this.photoImageObject = imageObject
    this.photoImage = image
    this.photoBackingObject = backingObject
    this.photoBacking = backing
    object.enabled = false
  }

  private createTapePiece(
    parent: SceneObject,
    name: string,
    angleDegrees: number,
    side: number,
    verticalSide: number,
  ): void {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    const angleRadians = angleDegrees * Math.PI / 180
    object.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, angleRadians))
    const visual = object.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    visual.size = new vec2(TAPE_WIDTH, TAPE_HEIGHT)
    visual.cornerRadius = 0.08
    visual.backgroundColor = new vec4(1, 0.99, 0.94, 0.22)
    visual.border = false
    visual.opacity = 1
    visual.renderOrder = 33
    this.tapePieces.push({object, visual, angleRadians, side, verticalSide})
  }

  private onUpdate(): void {
    if (this.pendingLayoutFrames <= 0) return
    this.pendingLayoutFrames--
    if (this.pendingLayoutFrames === 0) this.layoutPhoto()
  }

  private layoutPhoto(): void {
    if (!this.noteText || !this.photoObject) return
    const rect = this.noteText.layoutRect
    let contentBottom = rect.top - EMPTY_NOTE_TOP_GAP

    if (this.noteText.text.length > 0) {
      const bounds = this.noteText.getBoundingBox(0, this.noteText.text.length)
      contentBottom = bounds.bottom
    }
    const photoTop = contentBottom - PHOTO_GAP
    const availableHeight = Math.max(0, photoTop - (rect.bottom + PAPER_EDGE_GAP))
    const originalHeight = Math.max(PHOTO_MIN_HEIGHT, Math.min(PHOTO_MAX_HEIGHT, availableHeight))
    const originalWidth = Math.min(PHOTO_MAX_WIDTH, originalHeight * 4 / 3)
    const height = originalHeight * PHOTO_SCALE
    const width = originalWidth * PHOTO_SCALE
    const bottomBound = rect.bottom + PAPER_EDGE_GAP
    // Preserve the photograph's existing center even though its image is now 15% smaller.
    const centerY = Math.max(
      bottomBound + originalHeight * 0.5,
      photoTop - originalHeight * 0.5,
    )

    // The text column is offset to respect the red margin; cancel that offset
    // so the photograph itself is centered on the full sheet of paper.
    const textColumnX = this.noteText.getSceneObject().getTransform().getLocalPosition().x
    this.photoObject.getTransform().setLocalPosition(new vec3(-textColumnX, centerY, 0.72))
    this.photoObject.getTransform().setLocalRotation(quat.quatIdentity())

    this.photoImageObject?.getTransform().setLocalScale(new vec3(width, height, 1))

    const frameWidth = width + FRAME_SIDE_BORDER * 2
    const frameHeight = height + FRAME_TOP_BORDER + FRAME_BOTTOM_BORDER
    const frameCenterY = (FRAME_TOP_BORDER - FRAME_BOTTOM_BORDER) * 0.5
    if (this.photoBacking && this.photoBackingObject) {
      this.photoBacking.size = new vec2(frameWidth, frameHeight)
      this.photoBackingObject.getTransform().setLocalPosition(new vec3(0, frameCenterY, -0.08))
    }

    const tapeX = frameWidth * 0.5 - 0.12
    const tapeY = frameHeight * 0.5 - 0.12
    for (const tape of this.tapePieces) {
      tape.object.getTransform().setLocalPosition(new vec3(
        tape.side * tapeX,
        frameCenterY + tape.verticalSide * tapeY,
        0.1,
      ))
      tape.object.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, tape.angleRadians))
    }
  }
}
