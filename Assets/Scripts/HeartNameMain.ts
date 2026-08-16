/**
 * HeartNameMain — coordinates the floating heart, tap-to-pop transition, UI state, and pop SFX.
 * Inputs: authored heart root, typed tap interaction, prompt UI, and welcome-note UI.
 * Must not create or lay out visible text.
 */
import {HeartNameTapInteraction} from "./HeartNameTapInteraction"
import {HeartNameTapPromptUI} from "./HeartNameTapPromptUI"
import {HeartNameWelcomeNoteUI} from "./HeartNameWelcomeNoteUI"
import {HeartNamePlacementController} from "./HeartNamePlacementController"
import {HeartNamePalmHeartButtonUI} from "./HeartNamePalmHeartButtonUI"
import {HeartNameSessionState} from "./HeartNameSceneContracts"

const POP_AUDIO = requireAsset("../GeneratedSFX/HeartBubblePop.wav") as AudioTrackAsset

@component
export class HeartNameMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">HeartNameMain – experience controller</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Authored root containing the procedural glowing heart")
  heartRoot!: SceneObject

  @input
  @hint("SIK tap interaction attached to the authored heart")
  heartTap!: HeartNameTapInteraction

  @input
  @hint("Typed UIKit touch button shown beneath the heart")
  tapPrompt!: HeartNameTapPromptUI

  @input
  @hint("Typed UIKit welcome note revealed after the pop")
  welcomeNote!: HeartNameWelcomeNoteUI

  @input
  @hint("Places new P.S. hearts against room surfaces")
  placement!: HeartNamePlacementController

  @input
  @hint("Heart placement launcher shown on the user's raised left palm")
  palmHeartButton!: HeartNamePalmHeartButtonUI
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Vertical floating distance in centimeters")
  @widget(new SliderWidget(0.2, 2.0, 0.1))
  bobHeight: number = 0.8

  @input
  @hint("Heart floating cycles per second")
  @widget(new SliderWidget(0.1, 1.2, 0.05))
  bobSpeed: number = 0.35

  @input
  @hint("Show any collider wireframes in this experience")
  debugColliders: boolean = false
  @ui.group_end

  private basePosition = vec3.zero()
  private baseScale = vec3.one()
  private elapsed = 0
  private popElapsed = 0
  private popping = false
  private popped = false
  private initialPlacementComplete = false
  private popAudio: AudioComponent | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    if (
      !this.heartRoot ||
      !this.heartTap ||
      !this.tapPrompt ||
      !this.welcomeNote ||
      !this.placement ||
      !this.palmHeartButton
    ) {
      console.error("[HeartNameMain] Required Phase B references are not wired")
      return
    }
    this.basePosition = this.heartRoot.getTransform().getLocalPosition()
    this.baseScale = this.heartRoot.getTransform().getLocalScale()
    this.popAudio = this.makeAudio("Heart Bubble Pop Audio", POP_AUDIO, 0.48)
    this.heartTap.onTap.add(() => this.beginPop())
    this.tapPrompt.onTap.add(() => this.beginPop())
    this.welcomeNote.onLeavePs.add(() => this.placement.beginPlacement())
    this.palmHeartButton.setAvailable(false)
    this.palmHeartButton.setActionsAvailable(true, true)
    this.palmHeartButton.onPlaceHeart.add(() => this.placement.beginPlacement())
    this.palmHeartButton.onPass.add(() => this.placement.passSession())
    this.placement.configureBlankNoteSize(this.welcomeNote.panelWidth, this.welcomeNote.panelHeight)
    this.placement.configureBlankNoteReference(
      this.welcomeNote.getWorldPosition(),
      this.welcomeNote.getWorldScale(),
    )
    this.placement.onHeartPlaced.add(() => {
      if (!this.initialPlacementComplete) {
        // Capture the card's final moved pose before it fades so a farther-away
        // anchored note can preserve the same apparent size for the user.
        this.placement.configureBlankNoteReference(
          this.welcomeNote.getWorldPosition(),
          this.welcomeNote.getWorldScale(),
        )
        this.welcomeNote.fadeOut(0.45)
        this.initialPlacementComplete = true
      }
      if (this.placement.currentSessionState === HeartNameSessionState.PERSON_A_CREATE) {
        this.palmHeartButton.setActionsAvailable(true, true)
        this.palmHeartButton.setAvailable(true)
      }
    })
    this.placement.onSessionStateChanged.add((state) => this.onSessionStateChanged(state))
    this.placement.onSessionReset.add(() => this.resetToIntro())
    this.setColliderDebugAll(this.sceneObject, this.debugColliders)
  }

  private onSessionStateChanged(state: HeartNameSessionState): void {
    if (state === HeartNameSessionState.PERSON_A_CREATE) return
    if (state === HeartNameSessionState.PERSON_B_REPLY) {
      this.palmHeartButton.setActionsAvailable(false, true)
      this.palmHeartButton.setAvailable(true)
      return
    }
    this.palmHeartButton.setActionsAvailable(false, false)
    this.palmHeartButton.setAvailable(false)
  }

  private resetToIntro(): void {
    global.textInputSystem.dismissKeyboard()
    this.elapsed = 0
    this.popElapsed = 0
    this.popping = false
    this.popped = false
    this.initialPlacementComplete = false
    this.heartRoot.enabled = true
    this.heartRoot.getTransform().setLocalPosition(this.basePosition)
    this.heartRoot.getTransform().setLocalScale(this.baseScale)
    this.tapPrompt.show()
    this.welcomeNote.resetToStartup()
    this.palmHeartButton.setActionsAvailable(true, true)
    this.palmHeartButton.setAvailable(false)
    console.log("[HeartNameMain] Fresh intro restored")
  }

  private onUpdate(): void {
    if (!this.heartRoot || this.popped) return
    const delta = getDeltaTime()
    if (this.popping) {
      this.updatePop(delta)
      return
    }
    this.elapsed += delta
    const phase = this.elapsed * Math.PI * 2 * this.bobSpeed
    const y = this.basePosition.y + Math.sin(phase) * this.bobHeight
    this.heartRoot.getTransform().setLocalPosition(new vec3(this.basePosition.x, y, this.basePosition.z))
    const heartbeat = Math.max(0, Math.sin(phase * 2)) * 0.035
    this.setHeartScale(1 + heartbeat)
  }

  private beginPop(): void {
    if (this.popping || this.popped) return
    this.popping = true
    this.popElapsed = 0
    this.tapPrompt.hide()
    this.play(this.popAudio)
  }

  private updatePop(delta: number): void {
    const duration = 0.34
    this.popElapsed += delta
    const t = Math.min(1, this.popElapsed / duration)
    let scale = 0
    if (t < 0.28) {
      scale = 1 + 0.22 * (t / 0.28)
    } else {
      const collapse = (t - 0.28) / 0.72
      scale = 1.22 * Math.pow(1 - collapse, 2)
    }
    this.setHeartScale(scale)
    if (t >= 1) {
      this.popping = false
      this.popped = true
      this.heartRoot.enabled = false
      this.welcomeNote.showNote()
    }
  }

  private setHeartScale(multiplier: number): void {
    this.heartRoot.getTransform().setLocalScale(new vec3(
      this.baseScale.x * multiplier,
      this.baseScale.y * multiplier,
      this.baseScale.z * multiplier,
    ))
  }

  private makeAudio(name: string, track: AudioTrackAsset, volume: number): AudioComponent {
    const object = global.scene.createSceneObject(name)
    object.setParent(this.sceneObject)
    const audio = object.createComponent("Component.AudioComponent") as AudioComponent
    audio.audioTrack = track
    audio.volume = volume
    audio.playbackMode = Audio.PlaybackMode.LowLatency
    return audio
  }

  private play(audio: AudioComponent | null): void {
    if (!audio) return
    if (audio.isPlaying()) audio.stop(false)
    audio.play(1)
  }

  private setColliderDebugAll(root: SceneObject, enabled: boolean): void {
    const collider = root.getComponent("Physics.ColliderComponent") as ColliderComponent | null
    if (collider) collider.debugDrawEnabled = enabled
    for (let i = 0; i < root.getChildrenCount(); i++) {
      this.setColliderDebugAll(root.getChild(i), enabled)
    }
  }
}
