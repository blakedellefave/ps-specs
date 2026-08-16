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
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"

const PLAYBACK_PILL_WIDTH = 8.6
export const VOICE_PLAYBACK_PILL_HEIGHT = 2.4
const PLAYBACK_ROW_WIDTH = 7.25
const PLAYBACK_ICON_CELL_WIDTH = 1.45
const PLAYBACK_ICON_SIZE = 1.05
const PLAYBACK_PROGRESS_WIDTH = 5.25
const PLAYBACK_PROGRESS_HEIGHT = 0.34
const PLAYBACK_ROW_GAP = 0.55
const MAX_RECORDING_SECONDS = 30
const VOICE_SAMPLE_RATE = 16000
const PLAY_ICON = requireAsset("../Icons/play_arrow.png") as Texture
const PAUSE_ICON = requireAsset("../Icons/pause.png") as Texture

export type HeartNameVoiceSnapshot = {
  samples: Float32Array | null
  shape: vec3
}

/** Records one in-memory voice attachment and presents playback below the input toolbar. */
@component
export class HeartNameBlankNoteVoice extends BaseScriptComponent {
  private static activeRecorder: HeartNameBlankNoteVoice | null = null
  private static activePlayer: HeartNameBlankNoteVoice | null = null

  private micContent: ElementContent | null = null
  private micIdleIcon: Texture | null = null
  private micRecordingIcon: Texture | null = null
  private microphoneProvider: MicrophoneAudioProvider | null = null
  private outputProvider: AudioOutputProvider | null = null
  private audioComponent: AudioComponent | null = null
  private microphoneFrame: Float32Array | null = null
  private recordedChunks: Float32Array[] = []
  private recordedSamples: Float32Array | null = null
  private sampleCount = 0
  private recordedShape = new vec3(0, 1, 1)
  private recording = false
  private playing = false
  private playbackIndex = 0
  private playbackDrain = 0
  private playbackObject: SceneObject | null = null
  private playbackContent: ElementContent | null = null
  private progressSlider: Slider | null = null
  private pillButtonReady = false
  private progressReady = false
  private playbackReady = false
  private contentChangedListeners: (() => void)[] = []

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("OnDestroyEvent").bind(() => this.cleanup())
  }

  public initialize(
    micButton: Button,
    micContent: ElementContent,
    micIdleIcon: Texture,
    micRecordingIcon: Texture,
    microphoneAsset: AudioTrackAsset,
    playbackAsset: AudioTrackAsset,
    playbackMount: SceneObject,
  ): void {
    this.micContent = micContent
    this.micIdleIcon = micIdleIcon
    this.micRecordingIcon = micRecordingIcon
    this.microphoneProvider = microphoneAsset.control as MicrophoneAudioProvider
    this.outputProvider = playbackAsset.control as AudioOutputProvider
    this.microphoneProvider.sampleRate = VOICE_SAMPLE_RATE
    this.outputProvider.sampleRate = VOICE_SAMPLE_RATE

    this.audioComponent = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    this.audioComponent.audioTrack = playbackAsset
    this.audioComponent.volume = 1
    this.audioComponent.playbackMode = Audio.PlaybackMode.LowLatency

    this.buildPlaybackPill(playbackMount)
    micButton.onTriggerUp.add(() => this.toggleRecording())
  }

  public addContentChangedListener(listener: () => void): void {
    this.contentChangedListeners.push(listener)
  }

  public hasContent(): boolean {
    return this.recordedSamples !== null && this.recordedSamples.length > 0
  }

  public finishRecordingIfActive(): void {
    if (this.recording) this.stopRecording()
  }

  public captureContent(): HeartNameVoiceSnapshot {
    this.finishRecordingIfActive()
    return {
      samples: this.recordedSamples,
      shape: new vec3(this.recordedShape.x, this.recordedShape.y, this.recordedShape.z),
    }
  }

  public restoreContent(snapshot: HeartNameVoiceSnapshot): void {
    this.stopPlayback()
    this.finishRecordingIfActive()
    this.recordedChunks = []
    this.sampleCount = snapshot.samples?.length ?? 0
    this.recordedSamples = snapshot.samples
    this.recordedShape = new vec3(snapshot.shape.x, snapshot.shape.y, snapshot.shape.z)
    this.setPlaybackIcon(false)
    this.setProgress(0)
    this.syncPlaybackVisibility()
  }

  public clearContent(): void {
    this.restoreContent({samples: null, shape: new vec3(0, 1, 1)})
  }

  public prepareForHide(): void {
    this.finishRecordingIfActive()
    this.stopPlayback()
  }

  private toggleRecording(): void {
    if (this.recording) {
      this.stopRecording()
      return
    }
    this.startRecording()
  }

  private startRecording(): void {
    if (!this.microphoneProvider || !this.playbackObject) return
    HeartNameBlankNoteVoice.activeRecorder?.stopRecording()
    HeartNameBlankNoteVoice.activePlayer?.stopPlayback()
    HeartNameBlankNoteVoice.activeRecorder = this

    this.recordedChunks = []
    this.recordedSamples = null
    this.sampleCount = 0
    this.recordedShape = new vec3(0, 1, 1)
    this.microphoneFrame = null
    this.recording = true
    this.setMicrophoneRecordingVisual(true)
    this.setProgress(0)
    this.syncPlaybackVisibility()
    this.microphoneProvider.start()
    for (const listener of this.contentChangedListeners) listener()
    console.log("[HeartNameBlankNoteVoice] Recording started")
  }

  private stopRecording(): void {
    if (!this.recording) return
    this.recording = false
    this.microphoneProvider?.stop()
    if (HeartNameBlankNoteVoice.activeRecorder === this) HeartNameBlankNoteVoice.activeRecorder = null
    this.setMicrophoneRecordingVisual(false)
    this.flattenRecording()
    this.setPlaybackIcon(false)
    this.setProgress(0)
    this.syncPlaybackVisibility()
    for (const listener of this.contentChangedListeners) listener()
    if (!this.hasContent()) {
      console.warn(
        "[HeartNameBlankNoteVoice] No microphone frames captured; enable microphone input in Preview or grant microphone permission on Specs",
      )
    }
    console.log(
      "[HeartNameBlankNoteVoice] Recording stopped (" +
        (this.recordedSamples ? (this.recordedSamples.length / VOICE_SAMPLE_RATE).toFixed(1) : "0.0") +
        "s)",
    )
  }

  private togglePlayback(): void {
    if (!this.recordedSamples || this.recordedSamples.length === 0) return
    if (this.playing) {
      this.stopPlayback()
      return
    }
    HeartNameBlankNoteVoice.activePlayer?.stopPlayback()
    HeartNameBlankNoteVoice.activeRecorder?.stopRecording()
    HeartNameBlankNoteVoice.activePlayer = this
    this.playbackIndex = 0
    this.playbackDrain = 0
    this.playing = true
    this.setProgress(0)
    this.setPlaybackIcon(true)
    this.audioComponent?.play(-1)
    console.log("[HeartNameBlankNoteVoice] Playback started")
  }

  private onPlaybackButtonTriggered(): void {
    if (this.recording) {
      this.stopRecording()
      return
    }
    this.togglePlayback()
  }

  private stopPlayback(): void {
    const ownsActivePlayback = HeartNameBlankNoteVoice.activePlayer === this
    if (!this.playing && this.playbackDrain <= 0 && !ownsActivePlayback) return
    this.playing = false
    this.playbackDrain = 0
    this.audioComponent?.stop(false)
    this.setPlaybackIcon(false)
    if (HeartNameBlankNoteVoice.activePlayer === this) HeartNameBlankNoteVoice.activePlayer = null
    console.log("[HeartNameBlankNoteVoice] Playback stopped")
  }

  private onUpdate(): void {
    if (this.recording) this.captureMicrophoneFrame()
    if (this.playing) this.enqueuePlaybackFrame()
    if (this.playbackDrain > 0) {
      this.playbackDrain -= getDeltaTime()
      if (this.playbackDrain <= 0) this.stopPlayback()
    }
  }

  private captureMicrophoneFrame(): void {
    if (!this.microphoneProvider) return
    const maxFrameSize = this.microphoneProvider.maxFrameSize
    if (maxFrameSize <= 0) return
    if (!this.microphoneFrame || this.microphoneFrame.length !== maxFrameSize) {
      this.microphoneFrame = new Float32Array(maxFrameSize)
    }
    const shape = this.microphoneProvider.getAudioFrame(this.microphoneFrame)
    const count = Math.max(0, Math.min(this.microphoneFrame.length, Math.floor(shape.x)))
    if (count === 0) return

    const copy = new Float32Array(count)
    copy.set(this.microphoneFrame.subarray(0, count))
    this.recordedChunks.push(copy)
    this.sampleCount += count
    this.recordedShape = new vec3(count, Math.max(1, shape.y), Math.max(1, shape.z))
    if (this.sampleCount >= VOICE_SAMPLE_RATE * MAX_RECORDING_SECONDS) this.stopRecording()
  }

  private enqueuePlaybackFrame(): void {
    if (!this.outputProvider || !this.recordedSamples) return
    const preferred = this.outputProvider.getPreferredFrameSize()
    if (preferred <= 0) return

    const remaining = this.recordedSamples.length - this.playbackIndex
    const count = Math.min(preferred, remaining)
    const frame = new Float32Array(preferred)
    if (count > 0) {
      frame.set(this.recordedSamples.subarray(this.playbackIndex, this.playbackIndex + count))
      this.playbackIndex += count
    }
    this.outputProvider.enqueueAudioFrame(
      frame,
      new vec3(preferred, this.recordedShape.y, this.recordedShape.z),
    )
    this.setProgress(this.playbackIndex / this.recordedSamples.length)

    if (this.playbackIndex >= this.recordedSamples.length) {
      this.setProgress(1)
      this.playing = false
      this.playbackDrain = 0.18
    }
  }

  private flattenRecording(): void {
    if (this.sampleCount === 0) {
      this.recordedSamples = null
      return
    }
    const samples = new Float32Array(this.sampleCount)
    let offset = 0
    for (const chunk of this.recordedChunks) {
      samples.set(chunk, offset)
      offset += chunk.length
    }
    this.recordedSamples = samples
    this.recordedChunks = []
  }

  private buildPlaybackPill(parent: SceneObject): void {
    const playback = global.scene.createSceneObject("Voice Message Playback Pill")
    playback.setParent(parent)
    playback.getTransform().setLocalPosition(vec3.zero())
    playback.getTransform().setLocalScale(vec3.zero())
    this.playbackObject = playback

    const button = playback.createComponent(Button.getTypeName()) as Button
    button.setVariant({theme: "SnapOS2", shape: "Capsule", style: "Secondary"})
    button.size = new vec3(PLAYBACK_PILL_WIDTH, VOICE_PLAYBACK_PILL_HEIGHT, 0.5)
    button.opacity = 0.36
    button.onTriggerUp.add(() => this.onPlaybackButtonTriggered())

    const rowObject = global.scene.createSceneObject("Voice Playback Pill Content")
    rowObject.setParent(playback)
    rowObject.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    const row = rowObject.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.autoDiscoverItemsOnStart = false
    row.width = PLAYBACK_ROW_WIDTH
    row.height = VOICE_PLAYBACK_PILL_HEIGHT
    row.direction = FlexDirection.Row
    row.alignItems = FlexAlign.Center
    row.justifyContent = FlexJustify.Center
    row.columnGap = PLAYBACK_ROW_GAP

    const iconObject = global.scene.createSceneObject("Voice Playback Play Pause Icon")
    iconObject.setParent(rowObject)
    const content = iconObject.createComponent(ElementContent.getTypeName()) as ElementContent
    content.leadingIcon = PLAY_ICON
    content.leadingIconSize = PLAYBACK_ICON_SIZE
    content.sizeOverride = new vec2(PLAYBACK_ICON_CELL_WIDTH, VOICE_PLAYBACK_PILL_HEIGHT)
    content.contentAlignment = "center"
    this.playbackContent = content
    const iconItem = iconObject.createComponent(FlexItem.getTypeName()) as FlexItem
    iconItem.alignSelf = FlexAlignSelf.Center
    iconItem.overrideWidth = PLAYBACK_ICON_CELL_WIDTH
    iconItem.overrideHeight = VOICE_PLAYBACK_PILL_HEIGHT

    const progressObject = global.scene.createSceneObject("Voice Playback Progress")
    progressObject.setParent(rowObject)
    const progress = progressObject.createComponent(Slider.getTypeName()) as Slider
    progress.size = new vec3(PLAYBACK_PROGRESS_WIDTH, PLAYBACK_PROGRESS_HEIGHT, 0.16)
    progress.hasTrackVisual = true
    progress.customKnobSize = true
    progress.knobSize = new vec2(0.01, 0.01)
    progress.currentValue = 0
    this.progressSlider = progress
    const progressItem = progressObject.createComponent(FlexItem.getTypeName()) as FlexItem
    progressItem.alignSelf = FlexAlignSelf.Center
    progressItem.overrideWidth = PLAYBACK_PROGRESS_WIDTH
    progressItem.overrideHeight = PLAYBACK_PROGRESS_HEIGHT
    row.addItems([iconItem, progressItem])

    button.onInitialized.add(() => {
      this.pillButtonReady = true
      this.finalizePlaybackPillIfReady()
    })
    progress.onInitialized.add(() => {
      progress.knobVisual.sceneObject.enabled = false
      progress.interactable.enabled = false
      progress.collider.enabled = false
      this.progressReady = true
      this.finalizePlaybackPillIfReady()
    })
  }

  private finalizePlaybackPillIfReady(): void {
    if (!this.playbackObject || !this.pillButtonReady || !this.progressReady) return
    this.playbackReady = true
    this.playbackObject.getTransform().setLocalScale(vec3.one())
    this.syncPlaybackVisibility()
  }

  private syncPlaybackVisibility(): void {
    if (!this.playbackObject || !this.playbackReady) return
    this.playbackObject.enabled = this.hasContent()
  }

  private setPlaybackIcon(isPlaying: boolean): void {
    if (this.playbackContent) this.playbackContent.leadingIcon = isPlaying ? PAUSE_ICON : PLAY_ICON
  }

  private setMicrophoneRecordingVisual(isRecording: boolean): void {
    if (!this.micContent || !this.micIdleIcon || !this.micRecordingIcon) return
    this.micContent.leadingIcon = isRecording ? this.micRecordingIcon : this.micIdleIcon
  }

  private setProgress(value: number): void {
    if (!this.progressSlider) return
    const clamped = Math.max(0, Math.min(1, value))
    if (Math.abs(this.progressSlider.currentValue - clamped) < 0.002) return
    this.progressSlider.updateCurrentValue(clamped, false)
  }

  private cleanup(): void {
    if (this.recording) this.microphoneProvider?.stop()
    if (this.playing || this.playbackDrain > 0) this.audioComponent?.stop(false)
    if (HeartNameBlankNoteVoice.activeRecorder === this) HeartNameBlankNoteVoice.activeRecorder = null
    if (HeartNameBlankNoteVoice.activePlayer === this) HeartNameBlankNoteVoice.activePlayer = null
  }
}
