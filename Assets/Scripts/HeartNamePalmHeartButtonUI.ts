/**
 * HeartNamePalmHeartButtonUI — owns the left-palm heart launcher presentation.
 * Main controls availability and receives placement intent through onPlaceHeart.
 * Must not own placement state or create anchored content.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import {PalmState} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {CIRCULAR_BUTTON_SIZE} from "./HeartNameNotePaper"

const HEART_ICON = requireAsset("../Icons/favorite.png") as Texture
const PASS_ICON = requireAsset("../Icons/send.png") as Texture
const PALM_BUTTON_GAP = 1.2
const PALM_SURFACE_OFFSET = 0.8
const MIN_RAISED_PALM_PITCH = -45
const EDITOR_PREVIEW_DISTANCE = 70
const EDITOR_PREVIEW_LEFT_OFFSET = 12
const EDITOR_PREVIEW_DOWN_OFFSET = 8

@component
export class HeartNamePalmHeartButtonUI extends BaseScriptComponent {
  private readonly leftHand = HandInputData.getInstance().getHand("left")
  private readonly placeHeartEvent = new Event<void>()
  private readonly passEvent = new Event<void>()
  private cameraTransform!: Transform
  private buttonGroupObject!: SceneObject
  private heartButtonObject!: SceneObject
  private passButtonObject!: SceneObject
  private heartButton!: Button
  private passButton!: Button
  private available = false
  private initialized = false
  private initializedButtonCount = 0
  private placementAvailable = true
  private passAvailable = true

  public get onPlaceHeart(): PublicApi<void> {
    return this.placeHeartEvent.publicApi()
  }

  public get onPass(): PublicApi<void> {
    return this.passEvent.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.cameraTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform()

    this.buttonGroupObject = global.scene.createSceneObject("Left Palm Session Buttons")
    this.buttonGroupObject.setParent(this.sceneObject)
    const row = this.buttonGroupObject.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.autoDiscoverItemsOnStart = false
    row.width = CIRCULAR_BUTTON_SIZE * 2 + PALM_BUTTON_GAP
    row.height = CIRCULAR_BUTTON_SIZE
    row.direction = FlexDirection.Row
    row.alignItems = FlexAlign.Center
    row.justifyContent = FlexJustify.Center
    row.columnGap = PALM_BUTTON_GAP

    const heart = this.createPalmButton("Left Palm Heart Button", HEART_ICON)
    const pass = this.createPalmButton("Left Palm Pass Button", PASS_ICON)
    this.heartButtonObject = heart.object
    this.passButtonObject = pass.object
    this.heartButton = heart.button
    this.passButton = pass.button
    row.addItems([heart.item, pass.item])

    this.createEvent("OnStartEvent").bind(() => {
      this.heartButton.onTriggerUp.add(() => {
        if (!this.available || !this.placementAvailable) return
        this.setAvailable(false)
        this.placeHeartEvent.invoke()
      })
      this.passButton.onTriggerUp.add(() => {
        if (!this.available || !this.passAvailable) return
        this.passEvent.invoke()
      })
    })
    this.createEvent("UpdateEvent").bind(() => this.updatePalmButton())
  }

  public setAvailable(available: boolean): void {
    this.available = available
    if (!available && this.initialized) this.buttonGroupObject.enabled = false
  }

  public setActionsAvailable(placementAvailable: boolean, passAvailable: boolean): void {
    this.placementAvailable = placementAvailable
    this.passAvailable = passAvailable
    if (!this.initialized) return
    this.heartButtonObject.enabled = placementAvailable
    this.passButtonObject.enabled = passAvailable
    if (!placementAvailable && !passAvailable) this.buttonGroupObject.enabled = false
  }

  private updatePalmButton(): void {
    if (!this.available || !this.initialized) return

    if (global.deviceInfoSystem.isEditor()) {
      this.updateEditorPreviewPose()
      this.buttonGroupObject.enabled = true
      return
    }

    const palmCenter = this.leftHand.getPalmCenter()
    const palmPitch = this.leftHand.getPalmPitchAngle()
    const shouldShow =
      this.leftHand.isTracked() &&
      this.leftHand.isFacingCamera() &&
      this.leftHand.palmState === PalmState.Flat &&
      palmCenter !== null &&
      palmPitch !== null &&
      palmPitch >= MIN_RAISED_PALM_PITCH

    if (!shouldShow || palmCenter === null) {
      this.buttonGroupObject.enabled = false
      return
    }

    const cameraPosition = this.cameraTransform.getWorldPosition()
    const towardCamera = cameraPosition.sub(palmCenter).normalize()
    const position = palmCenter.add(towardCamera.uniformScale(PALM_SURFACE_OFFSET))
    this.setButtonPose(position, towardCamera)
    this.buttonGroupObject.enabled = true
  }

  private updateEditorPreviewPose(): void {
    const cameraPosition = this.cameraTransform.getWorldPosition()
    const position = cameraPosition
      // Lens Camera.forward points opposite the viewing direction.
      .add(this.cameraTransform.forward.uniformScale(-EDITOR_PREVIEW_DISTANCE))
      .add(this.cameraTransform.right.uniformScale(-EDITOR_PREVIEW_LEFT_OFFSET))
      .add(this.cameraTransform.up.uniformScale(-EDITOR_PREVIEW_DOWN_OFFSET))
    const towardCamera = cameraPosition.sub(position).normalize()
    this.setButtonPose(position, towardCamera)
  }

  private setButtonPose(position: vec3, towardCamera: vec3): void {
    const transform = this.sceneObject.getTransform()
    transform.setWorldPosition(position)
    transform.setWorldRotation(quat.lookAt(towardCamera, vec3.up()))
  }

  private createPalmButton(
    name: string,
    texture: Texture,
  ): {object: SceneObject; button: Button; item: FlexItem} {
    const object = global.scene.createSceneObject(name)
    object.setParent(this.buttonGroupObject)
    const button = object.createComponent(Button.getTypeName()) as Button
    button.setVariant({theme: "SnapOS2", shape: "Round", style: "Primary"})
    button.size = new vec3(CIRCULAR_BUTTON_SIZE, CIRCULAR_BUTTON_SIZE, 1)
    button.opacity = 0

    const icon = object.createComponent(ElementContent.getTypeName()) as ElementContent
    icon.leadingIcon = texture
    icon.leadingIconSize = 2
    icon.sizeOverride = new vec2(CIRCULAR_BUTTON_SIZE, CIRCULAR_BUTTON_SIZE)
    icon.contentAlignment = "center"

    const item = object.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.overrideWidth = CIRCULAR_BUTTON_SIZE
    item.overrideHeight = CIRCULAR_BUTTON_SIZE
    button.onInitialized.add(() => {
      button.opacity = 0.72
      this.initializedButtonCount++
      if (this.initializedButtonCount < 2) return
      this.initialized = true
      this.heartButtonObject.enabled = this.placementAvailable
      this.passButtonObject.enabled = this.passAvailable
      this.buttonGroupObject.enabled = false
    })
    return {object, button, item}
  }
}
