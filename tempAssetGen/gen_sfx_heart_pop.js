const fs = require("fs")
const path = require("path")

const ENGINE = "/Users/blakedellefave/.codex/plugins/cache/ls-extensions/ls-clad/local/skills/build-sfx/tools"
const audio = require(ENGINE)
const PROJECT_ASSETS_SFX = "/Users/blakedellefave/Documents/P.S. Demo 1/Assets/GeneratedSFX"

fs.mkdirSync(PROJECT_ASSETS_SFX, {recursive: true})

const result = audio.sfx_presets.uiPop({pitch: -1})
audio.mix_bus.masterChain(result, {normalize: "peak"})
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, "HeartBubblePop.wav"))
