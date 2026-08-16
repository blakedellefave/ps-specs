/**
 * HeartNamePlacementController — previews and places exact visual copies of
 * the authored glowing heart on real-world surfaces using World Query.
 */
import {Interactor, InteractorInputType, InteractorTriggerType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {AnchorComponent} from "Spatial Anchors.lspkg/AnchorComponent"
import {AnchorModule} from "Spatial Anchors.lspkg/AnchorModule"
import {UserAnchor} from "Spatial Anchors.lspkg/Anchor"
import {AnchorSession, AnchorSessionOptions} from "Spatial Anchors.lspkg/AnchorSession"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {createHeartNameBlankNote, HeartNameBlankNoteHandle} from "./HeartNameBlankNoteFactory"
import {DEFAULT_NOTE_HEIGHT, DEFAULT_NOTE_WIDTH} from "./HeartNameNotePaper"
import {HeartNameSessionState} from "./HeartNameSceneContracts"

const WorldQuery = require("LensStudio:WorldQueryModule") as WorldQueryModule

type PulsingHeart = {
  object: SceneObject
  anchorRoot: SceneObject
  baseScale: vec3
  phase: number
  index: number
  age: number
  popping: boolean
  popElapsed: number
  entry: PlacedHeartEntry
}

type PlacedHeartEntry = {
  object: SceneObject
  anchorRoot: SceneObject
  baseScale: vec3
  index: number
  anchor: UserAnchor | null
  note: HeartNameBlankNoteHandle | null
}

@component
export class HeartNamePlacementController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">HeartNamePlacementController – room placement</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Authored glowing heart whose live mesh and materials are copied exactly")
  sourceHeart!: SceneObject

  @input
  @hint("Spatial Anchors module used to lock committed hearts to the physical room")
  anchorModule!: AnchorModule
  @ui.group_end

  @ui.group_start("Settings")
  @input
  @hint("Distance in centimeters that the placed heart floats off a detected surface")
  @widget(new SliderWidget(1, 8, 0.5))
  surfaceOffset: number = 3

  @input
  @hint("Amount of continuous heart pulse as a fraction of its authored scale")
  @widget(new SliderWidget(0.04, 0.2, 0.01))
  pulseAmount: number = 0.1

  @input
  @hint("Heart pulse cycles per second")
  @widget(new SliderWidget(0.5, 2.5, 0.1))
  pulseSpeed: number = 1.25

  @input
  @hint("Immediate marker distance from the user while a room surface is being acquired")
  @widget(new SliderWidget(60, 160, 5))
  previewDistance: number = 95
  @ui.group_end

  private hitSession!: HitTestSession
  private anchorSessionPromise: Promise<AnchorSession | null> | null = null
  private cameraTransform!: Transform
  private marker: SceneObject | null = null
  private sourceBaseScale = vec3.one()
  private markerBaseScale = vec3.one()
  private pulsingHearts: PulsingHeart[] = []
  private placedHearts: PlacedHeartEntry[] = []
  private active = false
  private hitPending = false
  private hasPlacement = false
  private armedForPlacement = false
  private armDelay = 0
  private elapsed = 0
  private placedCount = 0
  private blankNoteWidth = DEFAULT_NOTE_WIDTH
  private blankNoteHeight = DEFAULT_NOTE_HEIGHT
  private blankNoteReferencePosition = new vec3(0, -10, -108)
  private blankNoteReferenceScale = vec3.one()
  private readonly heartPlacedEvent = new Event<void>()
  private readonly sessionStateChangedEvent = new Event<HeartNameSessionState>()
  private readonly sessionResetEvent = new Event<void>()
  private sessionState = HeartNameSessionState.PERSON_A_CREATE

  public get onHeartPlaced(): PublicApi<void> {
    return this.heartPlacedEvent.publicApi()
  }

  public get onSessionStateChanged(): PublicApi<HeartNameSessionState> {
    return this.sessionStateChangedEvent.publicApi()
  }

  public get onSessionReset(): PublicApi<void> {
    return this.sessionResetEvent.publicApi()
  }

  public get currentSessionState(): HeartNameSessionState {
    return this.sessionState
  }

  public configureBlankNoteSize(width: number, height: number): void {
    this.blankNoteWidth = width
    this.blankNoteHeight = height
  }

  public configureBlankNoteReference(position: vec3, scale: vec3): void {
    this.blankNoteReferencePosition = position
    this.blankNoteReferenceScale = scale
  }

  onAwake(): void {
    const options = HitTestSessionOptions.create()
    options.filter = true
    this.hitSession = WorldQuery.createHitTestSessionWithOptions(options)
    this.hitSession.start()

    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("OnDestroyEvent").bind(() => this.hitSession.stop())
  }

  public beginPlacement(): void {
    if (this.sessionState !== HeartNameSessionState.PERSON_A_CREATE) return
    if (this.active) return
    if (!this.sourceHeart) {
      console.error("[HeartNamePlacement] Source heart is not wired")
      return
    }
    if (!this.marker) {
      this.marker = this.createHeartVisual("P.S. Placement Heart Marker")
      this.markerBaseScale = this.sourceBaseScale
      this.marker.getTransform().setWorldScale(this.markerBaseScale)
    }
    this.active = true
    this.hasPlacement = false
    this.armedForPlacement = false
    this.armDelay = 0.35
    this.showCameraForwardMarker()
    console.log("[HeartNamePlacement] Placement mode started")
  }

  public passSession(): void {
    if (this.sessionState === HeartNameSessionState.PERSON_A_CREATE) {
      this.finishPendingNotes(false)
      for (const entry of this.placedHearts) entry.note?.closeForPass()
      this.sessionState = HeartNameSessionState.PERSON_B_REPLY
      for (const entry of this.placedHearts) entry.note?.setSessionState(this.sessionState)
      this.sessionStateChangedEvent.invoke(this.sessionState)
      console.log("[HeartNamePlacement] First Pass complete: PERSON_B_REPLY")
      return
    }
    if (this.sessionState === HeartNameSessionState.PERSON_B_REPLY) {
      for (const entry of this.placedHearts) entry.note?.closeForPass()
      this.sessionState = HeartNameSessionState.PERSON_A_FINAL_READ
      for (const entry of this.placedHearts) entry.note?.setSessionState(this.sessionState)
      this.sessionStateChangedEvent.invoke(this.sessionState)
      console.log("[HeartNamePlacement] Second Pass complete: PERSON_A_FINAL_READ")
    }
  }

  public resetSession(): void {
    if (this.marker) this.marker.destroy()
    this.marker = null
    this.active = false
    this.hasPlacement = false
    this.armedForPlacement = false
    this.pulsingHearts = []
    for (const entry of this.placedHearts) entry.anchorRoot.destroy()
    this.placedHearts = []
    this.placedCount = 0
    this.sessionState = HeartNameSessionState.PERSON_A_CREATE
    this.resetSpatialAnchorArea()
    this.sessionResetEvent.invoke()
    this.sessionStateChangedEvent.invoke(this.sessionState)
    console.log("[HeartNamePlacement] Session fully reset")
  }

  private onStart(): void {
    const camera = WorldCameraFinderProvider.getInstance().getComponent()
    this.cameraTransform = camera.getTransform()
    // Preserve the authored size before the source heart's pop animation
    // scales that original object to zero.
    this.sourceBaseScale = this.sourceHeart.getTransform().getLocalScale()
    this.anchorSessionPromise = this.initializeAnchorSession()

    // Interactor-level events also fire for free-space pinches where there is
    // no virtual Interactable. They provide a deterministic placement commit
    // signal while UpdateEvent continues to drive the World Query marker.
    const interactors = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All)
    for (const interactor of interactors) {
      interactor.onTriggerStart.add(() => this.onPlacementTriggerStart(interactor))
      interactor.onTriggerEnd.add(() => this.onPlacementTriggerEnd())
      interactor.onTriggerCanceled.add(() => this.onPlacementTriggerEnd())
    }
  }

  private onPlacementTriggerStart(interactor: Interactor): void {
    if (!this.active || !this.marker || this.armDelay > 0) return
    this.armedForPlacement = true
    if ((interactor.inputType & InteractorInputType.Mouse) !== 0 && interactor.endPoint) {
      this.updateMarker(interactor.endPoint)
    }
  }

  private onPlacementTriggerEnd(): void {
    if (this.active && this.armedForPlacement && this.hasPlacement) this.commitPlacement()
  }

  private onUpdate(): void {
    const delta = getDeltaTime()
    this.elapsed += delta
    this.updatePulses(delta)
    if (!this.active || !this.marker) return

    this.armDelay = Math.max(0, this.armDelay - delta)
    const interactor = this.getPrimaryInteractor()
    if (!interactor || !interactor.startPoint || !interactor.endPoint) {
      // Keep the immediate marker visible. Hand tracking can briefly lose its
      // ray after the UI pinch releases, and hiding here made a successful
      // button tap look like it did nothing.
      this.hasPlacement = false
      return
    }

    if (this.armDelay <= 0 && interactor.currentTrigger === InteractorTriggerType.None) {
      this.armedForPlacement = true
    }

    const released =
      interactor.previousTrigger !== InteractorTriggerType.None &&
      interactor.currentTrigger === InteractorTriggerType.None
    if (released && this.armedForPlacement && this.hasPlacement) {
      this.commitPlacement()
      return
    }

    // World Query does not consistently return callbacks in desktop Preview.
    // The MouseInteractor already exposes the cursor endpoint in world space,
    // so use that directly for an editor-only placement marker.
    if ((interactor.inputType & InteractorInputType.Mouse) !== 0) {
      this.updateMarker(interactor.endPoint)
      return
    }

    // Give instant, continuous feedback while World Query resolves. A real
    // surface hit below replaces this ray preview and enables placement.
    const rayPreview = this.getRayPreviewPosition(interactor.startPoint, interactor.endPoint)
    this.updateMarker(rayPreview, false)

    if (this.hitPending) return
    this.hitPending = true
    const rayStart = interactor.startPoint
    const rayEnd = interactor.endPoint
    this.hitSession.hitTest(rayStart, rayEnd, (hit: WorldQueryHitTestResult | null) => {
      this.hitPending = false
      if (!this.active || !this.marker) return
      if (hit) {
        this.updateMarker(hit.position.add(hit.normal.normalize().uniformScale(this.surfaceOffset)))
        return
      }

      this.updateMarker(rayPreview, false)
      this.hasPlacement = false
    })
  }

  private getPrimaryInteractor(): Interactor | null {
    const interactors = SIK.InteractionManager.getTargetingInteractors()
    for (const interactor of interactors) {
      if (interactor.isActive() && interactor.isTargeting()) return interactor
    }
    // A free-space mouse pinch in Editor can be active without reporting a
    // virtual target. Accept any active interactor that still provides a ray;
    // on Specs this also keeps surface placement usable when the hand points at
    // physical geometry with no virtual Interactable in front of it.
    const activeInteractors = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All)
    for (const interactor of activeInteractors) {
      if (interactor.isActive() && interactor.startPoint && interactor.endPoint) return interactor
    }
    return null
  }

  private updateMarker(position: vec3, canPlace: boolean = true): void {
    if (!this.marker) return
    const toCamera = this.cameraTransform.getWorldPosition().sub(position)
    const facing = toCamera.length > 0.001 ? toCamera.normalize() : vec3.forward()
    const transform = this.marker.getTransform()
    transform.setWorldPosition(position)
    transform.setWorldRotation(quat.lookAt(facing, vec3.up()))
    this.marker.enabled = true
    this.hasPlacement = canPlace
  }

  private showCameraForwardMarker(): void {
    if (!this.marker || !this.cameraTransform) return
    // Transform.forward is opposite the Lens camera's viewing direction.
    const position = this.cameraTransform.getWorldPosition().add(
      this.cameraTransform.forward.normalize().uniformScale(-this.previewDistance),
    )
    this.updateMarker(position, false)
  }

  private getRayPreviewPosition(start: vec3, end: vec3): vec3 {
    const ray = end.sub(start)
    const length = ray.length
    if (length < 0.001) return end
    return start.add(ray.normalize().uniformScale(Math.min(length, this.previewDistance)))
  }

  private commitPlacement(): void {
    if (!this.marker) return
    const placedHeart = this.marker
    const placedTransform = placedHeart.getTransform()
    const anchorPosition = placedTransform.getWorldPosition()
    const anchorRotation = placedTransform.getWorldRotation()
    this.placedCount++
    placedHeart.name = "Placed P.S. Heart " + this.placedCount
    const anchorRoot = global.scene.createSceneObject("P.S. Placement Anchor " + this.placedCount)
    anchorRoot.setParent(this.sceneObject)
    anchorRoot.getTransform().setWorldPosition(anchorPosition)
    anchorRoot.getTransform().setWorldRotation(anchorRotation)
    placedHeart.setParent(anchorRoot)
    placedHeart.getTransform().setLocalPosition(vec3.zero())
    placedHeart.getTransform().setLocalRotation(quat.quatIdentity())
    placedHeart.getTransform().setLocalScale(this.markerBaseScale)
    const entry: PlacedHeartEntry = {
      object: placedHeart,
      anchorRoot,
      baseScale: this.markerBaseScale,
      index: this.placedCount,
      anchor: null,
      note: null,
    }
    this.placedHearts.push(entry)
    this.pulsingHearts.push({
      object: placedHeart,
      anchorRoot,
      baseScale: this.markerBaseScale,
      phase: this.placedCount * 0.7,
      index: this.placedCount,
      age: 0,
      popping: false,
      popElapsed: 0,
      entry,
    })
    this.marker = null
    this.active = false
    this.hasPlacement = false
    this.armedForPlacement = false
    this.attachToSpatialAnchor(entry, anchorPosition, anchorRotation)
    this.heartPlacedEvent.invoke()
    console.log("[HeartNamePlacement] Heart placed")
  }

  private async initializeAnchorSession(): Promise<AnchorSession | null> {
    // Spatial mapping is device-only. Opening it in desktop Preview currently
    // produces package-level tracking-cancelled rejections, so Preview keeps
    // the existing world-space fallback while Specs uses true spatial anchors.
    if (global.deviceInfoSystem.isEditor()) {
      console.log("[HeartNamePlacement] Preview uses world tracking fallback; spatial anchors activate on Specs")
      return null
    }
    if (!this.anchorModule) {
      console.warn("[HeartNamePlacement] Spatial Anchor module is not wired; using world tracking fallback")
      return null
    }
    try {
      const options = new AnchorSessionOptions()
      options.area = "ps-heart-placement"
      options.scanForWorldAnchors = false
      const session = await this.anchorModule.openSession(options)
      console.log("[HeartNamePlacement] Spatial Anchor session ready")
      return session
    } catch (error) {
      console.warn("[HeartNamePlacement] Spatial Anchors unavailable; using world tracking fallback: " + error)
      return null
    }
  }

  private async attachToSpatialAnchor(
    entry: PlacedHeartEntry,
    position: vec3,
    rotation: quat,
  ): Promise<void> {
    const session = await this.anchorSessionPromise
    if (!session || !entry.anchorRoot) return
    try {
      const anchor = await session.createWorldAnchor(mat4.compose(position, rotation, vec3.one()))
      entry.anchor = anchor
      const anchorComponent = entry.anchorRoot.createComponent(AnchorComponent.getTypeName()) as AnchorComponent
      anchorComponent.anchor = anchor
      console.log("[HeartNamePlacement] Heart spatially anchored")
    } catch (error) {
      console.warn("[HeartNamePlacement] Could not spatially anchor heart; retaining world pose: " + error)
      entry.anchorRoot.setParent(this.sceneObject)
      entry.anchorRoot.getTransform().setWorldPosition(position)
      entry.anchorRoot.getTransform().setWorldRotation(rotation)
    }
  }

  private updatePulses(delta: number): void {
    if (this.marker && this.marker.enabled) {
      this.applyPulse(this.marker, this.markerBaseScale, 0)
    }
    for (let i = this.pulsingHearts.length - 1; i >= 0; i--) {
      const heart = this.pulsingHearts[i]
      if (!heart.object || !heart.object.enabled) continue
      heart.age += delta
      if (!heart.popping && heart.age >= 3) {
        heart.popping = true
        heart.popElapsed = 0
      }
      if (!heart.popping) {
        this.applyPulse(heart.object, heart.baseScale, heart.phase)
        continue
      }

      heart.popElapsed += delta
      const t = Math.min(1, heart.popElapsed / 0.34)
      const scale = t < 0.28
        ? 1 + 0.22 * (t / 0.28)
        : 1.22 * Math.pow(1 - (t - 0.28) / 0.72, 2)
      heart.object.getTransform().setWorldScale(new vec3(
        heart.baseScale.x * scale,
        heart.baseScale.y * scale,
        heart.baseScale.z * scale,
      ))
      if (t < 1) continue

      this.createNoteForHeart(heart, true)
      this.pulsingHearts.splice(i, 1)
      console.log("[HeartNamePlacement] Placed heart transformed into a blank P.S. note")
    }
  }

  private createNoteForHeart(heart: PulsingHeart, startOpen: boolean): void {
    if (heart.entry.note) return
    heart.object.getTransform().setLocalScale(heart.baseScale)
    heart.entry.note = createHeartNameBlankNote(
      heart.anchorRoot,
      this.blankNoteWidth,
      this.blankNoteHeight,
      heart.index,
      this.getDistanceCompensatedNoteScale(heart.anchorRoot.getTransform().getWorldPosition()),
      heart.object,
      heart.baseScale,
      this.sessionState,
      () => this.resetSession(),
      startOpen,
    )
    heart.object.enabled = !startOpen
  }

  private finishPendingNotes(startOpen: boolean): void {
    for (const heart of this.pulsingHearts) this.createNoteForHeart(heart, startOpen)
    this.pulsingHearts = []
  }

  private async resetSpatialAnchorArea(): Promise<void> {
    const session = await this.anchorSessionPromise
    if (!session) return
    try {
      await session.reset()
      console.log("[HeartNamePlacement] Spatial anchor area cleared")
    } catch (error) {
      console.warn("[HeartNamePlacement] Spatial anchor reset failed: " + error)
    }
  }

  private getDistanceCompensatedNoteScale(notePosition: vec3): vec3 {
    const cameraPosition = this.cameraTransform.getWorldPosition()
    const referenceDistance = this.blankNoteReferencePosition.sub(cameraPosition).length
    const noteDistance = notePosition.sub(cameraPosition).length
    const distanceScale = referenceDistance > 0.001
      ? Math.max(0.5, Math.min(3, noteDistance / referenceDistance))
      : 1
    return new vec3(
      this.blankNoteReferenceScale.x * distanceScale,
      this.blankNoteReferenceScale.y * distanceScale,
      this.blankNoteReferenceScale.z * distanceScale,
    )
  }

  private applyPulse(object: SceneObject, baseScale: vec3, phase: number): void {
    const wave = 0.5 + 0.5 * Math.sin((this.elapsed * this.pulseSpeed + phase) * Math.PI * 2)
    const scale = 1 + wave * this.pulseAmount
    object.getTransform().setWorldScale(new vec3(
      baseScale.x * scale,
      baseScale.y * scale,
      baseScale.z * scale,
    ))
  }

  private createHeartVisual(name: string): SceneObject {
    const sourceCore = this.sourceHeart.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null
    if (!sourceCore || !sourceCore.mesh || !sourceCore.mainMaterial) {
      throw new Error("[HeartNamePlacement] Source heart core visual is unavailable")
    }

    const heart = global.scene.createSceneObject(name)
    heart.setParent(this.sceneObject)
    const core = heart.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    core.mesh = sourceCore.mesh
    core.mainMaterial = sourceCore.mainMaterial

    const sourceHaloObject = this.findChild(this.sourceHeart, "Heart Halo")
    const sourceHalo = sourceHaloObject?.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null
    if (sourceHalo && sourceHalo.mesh && sourceHalo.mainMaterial) {
      const haloObject = global.scene.createSceneObject("Heart Halo")
      haloObject.setParent(heart)
      haloObject.getTransform().setLocalScale(new vec3(1.13, 1.13, 1.13))
      const halo = haloObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      halo.mesh = sourceHalo.mesh
      halo.mainMaterial = sourceHalo.mainMaterial
    }
    heart.enabled = false
    return heart
  }

  private findChild(parent: SceneObject, name: string): SceneObject | null {
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      const child = parent.getChild(i)
      if (child.name === name) return child
    }
    return null
  }

}
